"""Descoberta automática dos boards do monday → UPSERT em gerencia.boards.

Zero-config: lista todos os boards que o token vê, auto-classifica (colunas de
status/prazo/responsável + categorização de rótulos) e grava/atualiza o catálogo.

REGRA DE OURO: descobrir NUNCA sobrescreve override manual. A re-descoberta atualiza
só a parte auto-detectada (colunas_map/status_map/confianca/nome/workspace/ativo);
`overrides` e `incluido` já definidos permanecem intactos (só o INSERT inicial define
o `incluido` default). Board novo entra; board que sumiu → ativo=false.

Escopo default do `incluido` (definido no bootstrap, config_extra.workspaces_incluidos):
incluido = é_projeto (tem status) AND não-subelemento AND workspace no escopo.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gerencia import Board
from app.models.integracoes import Integracao
from app.services.crypto import decrypt_json
from app.services.monday import (
    MondayClient,
    MondayError,
    classificar_board,
    eh_projeto,
    eh_subelemento,
)

log = logging.getLogger("monday_discovery")


async def _carregar_integracao(db: AsyncSession) -> Integracao | None:
    res = await db.execute(select(Integracao).where(Integracao.servico == "monday"))
    return res.scalar_one_or_none()


def _incluido_default(board: dict, workspaces_incluidos: list[str] | None) -> bool:
    if not eh_projeto(board):
        return False
    if eh_subelemento(board.get("name")):
        return False
    ws = (board.get("workspace") or {}).get("name")
    if workspaces_incluidos:
        return ws in workspaces_incluidos
    return True


async def descobrir_boards(db: AsyncSession) -> dict[str, Any]:
    """Lista todos os boards, auto-classifica e faz UPSERT idempotente em gerencia.boards."""
    integ = await _carregar_integracao(db)
    if not integ or not integ.ativo or not integ.credentials_cifradas:
        return {"ok": False, "motivo": "integração monday ausente/inativa"}

    creds = decrypt_json(integ.credentials_cifradas)
    token = creds.get("token") if isinstance(creds, dict) else None
    if not token:
        return {"ok": False, "motivo": "sem token cifrado"}

    config = dict(integ.config_extra or {})
    workspaces_incluidos = config.get("workspaces_incluidos") or None

    try:
        async with MondayClient(token) as client:
            boards = await client.listar_boards()
    except MondayError as e:
        log.exception("descobrir_boards falhou")
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "monday")
            .values(
                ultimo_sync=datetime.now(tz=timezone.utc),
                ultimo_sync_status="erro",
                ultimo_sync_erro=str(e)[:500],
            )
        )
        await db.commit()
        return {"ok": False, "erro": str(e)[:500]}

    novos = 0
    atualizados = 0
    incluidos_default = 0
    vistos: list[int] = []

    for b in boards:
        try:
            monday_id = int(b.get("id"))
        except (TypeError, ValueError):
            continue
        vistos.append(monday_id)
        colunas_map, status_map, confianca = classificar_board(b)
        incluido_def = _incluido_default(b, workspaces_incluidos)
        if incluido_def:
            incluidos_default += 1

        valores = {
            "monday_board_id": monday_id,
            "nome": (b.get("name") or "")[:512],
            "workspace": (b.get("workspace") or {}).get("name"),
            "board_kind": b.get("board_kind"),
            "colunas_map": colunas_map,
            "status_map": status_map,
            "confianca_classificacao": confianca,
            "incluido": incluido_def,  # só vale no INSERT (excluído do update abaixo)
            "ativo": True,
            "atualizado_em": datetime.now(tz=timezone.utc),
        }
        stmt = pg_insert(Board).values(**valores)
        # Update NUNCA toca em incluido nem overrides (regra de ouro).
        stmt = stmt.on_conflict_do_update(
            constraint="uq_gerencia_board_monday_id",
            set_={
                "nome": valores["nome"],
                "workspace": valores["workspace"],
                "board_kind": valores["board_kind"],
                "colunas_map": colunas_map,
                "status_map": status_map,
                "confianca_classificacao": confianca,
                "ativo": True,
                "atualizado_em": valores["atualizado_em"],
            },
        )
        res = await db.execute(stmt)
        # rowcount não distingue insert de update no PG; contamos via checagem simples depois.
        _ = res

    # Boards que sumiram → ativo=false (não deletar; preserva histórico/itens).
    if vistos:
        await db.execute(
            update(Board)
            .where(Board.monday_board_id.notin_(vistos))
            .where(Board.ativo.is_(True))
            .values(ativo=False, atualizado_em=datetime.now(tz=timezone.utc))
        )

    await db.execute(
        update(Integracao)
        .where(Integracao.servico == "monday")
        .values(
            ultimo_sync=datetime.now(tz=timezone.utc),
            ultimo_sync_status="ok",
            ultimo_sync_erro=None,
            ultimo_sync_total=len(vistos),
        )
    )
    await db.commit()

    # Contagem final direto do banco (fonte da verdade).
    total_res = await db.execute(select(Board).where(Board.ativo.is_(True)))
    total_ativos = len(total_res.scalars().all())
    incl_res = await db.execute(
        select(Board).where(Board.ativo.is_(True)).where(Board.incluido.is_(True))
    )
    total_incluidos = len(incl_res.scalars().all())

    return {
        "ok": True,
        "boards_vistos": len(vistos),
        "boards_ativos": total_ativos,
        "incluidos": total_incluidos,
        "incluidos_default_calc": incluidos_default,
    }
