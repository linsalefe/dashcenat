"""Sync dos itens de cada board monday → gerencia.itens + snapshot diário.

Espelha doity_sync: idempotente (UPSERT por (board_id, monday_item_id)), erro num
board não derruba os outros, boards sincronizados EM SÉRIE (rate/complexity budget).

Usa o mapa efetivo (auto ⊕ overrides). Métricas (fonte da verdade):
- concluido = status ∈ status_map.concluido
- atrasado  = prazo_fim < hoje (America/Sao_Paulo) E não concluído E prazo_fim existe
- sem_responsavel = responsaveis vazio · sem_prazo = prazo_fim IS NULL
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gerencia import Board, Item, SnapshotDiario
from app.models.integracoes import Integracao
from app.services.crypto import decrypt_json
from app.services.monday import (
    MondayClient,
    MondayError,
    mapa_efetivo,
    normalizar_item,
)

log = logging.getLogger("monday_sync")

_TZ_BR = ZoneInfo("America/Sao_Paulo")


async def _token(db: AsyncSession) -> str | None:
    res = await db.execute(select(Integracao).where(Integracao.servico == "monday"))
    integ = res.scalar_one_or_none()
    if not integ or not integ.ativo or not integ.credentials_cifradas:
        return None
    creds = decrypt_json(integ.credentials_cifradas)
    return creds.get("token") if isinstance(creds, dict) else None


async def _upsert_item(db: AsyncSession, board_id, valores: dict[str, Any]) -> None:
    stmt = pg_insert(Item).values(board_id=board_id, **valores)
    update_cols = {k: v for k, v in valores.items() if k != "monday_item_id"}
    stmt = stmt.on_conflict_do_update(
        constraint="uq_gerencia_item",
        set_={**update_cols, "sincronizado_em": datetime.now(tz=timezone.utc)},
    )
    await db.execute(stmt)


async def _gravar_snapshot(db: AsyncSession, board_id, hoje, m: dict[str, int]) -> None:
    valores = {
        "board_id": board_id,
        "data": hoje,
        "total": m["total"],
        "em_andamento": m["em_andamento"],
        "atrasadas": m["atrasadas"],
        "concluidas": m["concluidas"],
        "sem_responsavel": m["sem_responsavel"],
        "sem_prazo": m["sem_prazo"],
        "metricas": {},
    }
    stmt = pg_insert(SnapshotDiario).values(**valores)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_gerencia_snapshot",
        set_={k: v for k, v in valores.items() if k not in ("board_id", "data")},
    )
    await db.execute(stmt)


async def sync_board(db: AsyncSession, board: Board, *, token: str | None = None) -> dict[str, Any]:
    """Sincroniza os itens de UM board e grava o snapshot do dia. Erro não propaga."""
    # Captura tudo antes de qualquer commit (evita MissingGreenlet em objeto expired).
    board_id = board.id
    monday_board_id = board.monday_board_id
    nome = board.nome
    colunas_ef, status_ef = mapa_efetivo(board.colunas_map, board.status_map, board.overrides)
    concluido_labels = set(status_ef.get("concluido") or [])
    andamento_labels = set(status_ef.get("andamento") or [])

    tok = token or await _token(db)
    if not tok:
        await _marcar_board(db, board_id, "sem_token", "sem token cifrado", None)
        await db.commit()
        return {"ok": False, "board": nome, "motivo": "sem token"}

    hoje = datetime.now(tz=_TZ_BR).date()
    m = {"total": 0, "em_andamento": 0, "atrasadas": 0, "concluidas": 0,
         "sem_responsavel": 0, "sem_prazo": 0}
    vistos: list[int] = []

    try:
        async with MondayClient(tok) as client:
            async for item in client.iterar_itens(monday_board_id):
                dados = normalizar_item(item, colunas_ef)
                mid = dados.get("monday_item_id")
                if mid is None:
                    continue
                status = dados.get("status")
                concluido = status in concluido_labels if status else False
                prazo_fim = dados.get("prazo_fim")
                atrasado = bool(prazo_fim and not concluido and prazo_fim < hoje)

                await _upsert_item(db, board_id, {**dados, "concluido": concluido, "atrasado": atrasado})
                vistos.append(mid)

                m["total"] += 1
                if concluido:
                    m["concluidas"] += 1
                elif status in andamento_labels:
                    m["em_andamento"] += 1
                if atrasado:
                    m["atrasadas"] += 1
                if not dados.get("responsaveis"):
                    m["sem_responsavel"] += 1
                if prazo_fim is None:
                    m["sem_prazo"] += 1

        # Remove itens que sumiram do board (mantém o espelho fiel p/ métricas).
        if vistos:
            await db.execute(
                delete(Item).where(Item.board_id == board_id).where(Item.monday_item_id.notin_(vistos))
            )
        else:
            await db.execute(delete(Item).where(Item.board_id == board_id))

        await _gravar_snapshot(db, board_id, hoje, m)
        await db.execute(
            update(Board).where(Board.id == board_id).values(
                ultimo_sync=datetime.now(tz=timezone.utc),
                ultimo_sync_status="ok",
                ultimo_sync_erro=None,
                ultimo_sync_total=m["total"],
                atualizado_em=datetime.now(tz=timezone.utc),
            )
        )
        await db.commit()
        return {"ok": True, "board": nome, "monday_board_id": monday_board_id, **m}
    except Exception as e:
        log.exception("monday_sync falhou no board %s (%s)", monday_board_id, nome)
        await db.rollback()
        await _marcar_board(db, board_id, "erro", str(e)[:500], None)
        await db.commit()
        return {"ok": False, "board": nome, "monday_board_id": monday_board_id, "erro": str(e)[:500]}


async def _marcar_board(db, board_id, status, erro, total):
    values: dict[str, Any] = {
        "ultimo_sync": datetime.now(tz=timezone.utc),
        "ultimo_sync_status": status,
        "ultimo_sync_erro": erro,
        "atualizado_em": datetime.now(tz=timezone.utc),
    }
    if total is not None:
        values["ultimo_sync_total"] = total
    await db.execute(update(Board).where(Board.id == board_id).values(**values))


async def sync_todos(db: AsyncSession) -> dict[str, Any]:
    """Sincroniza todos os boards incluido=true AND ativo=true, EM SÉRIE."""
    tok = await _token(db)
    if not tok:
        return {"ok": False, "motivo": "sem token", "boards": 0}

    res = await db.execute(
        select(Board)
        .where(Board.incluido.is_(True))
        .where(Board.ativo.is_(True))
        .order_by(Board.nome)
    )
    boards = list(res.scalars().all())

    resultados: list[dict[str, Any]] = []
    ok = erro = 0
    tot_itens = 0
    agg = {"em_andamento": 0, "atrasadas": 0, "concluidas": 0}
    for board in boards:
        r = await sync_board(db, board, token=tok)
        resultados.append(r)
        if r.get("ok"):
            ok += 1
            tot_itens += r.get("total", 0)
            for k in agg:
                agg[k] += r.get(k, 0)
        else:
            erro += 1

    return {
        "ok": True,
        "boards": len(boards),
        "boards_ok": ok,
        "boards_erro": erro,
        "total_itens": tot_itens,
        **agg,
        "resultados": resultados,
    }
