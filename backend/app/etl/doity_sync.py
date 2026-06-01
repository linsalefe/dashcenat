"""Sync incremental de inscrições/vendas Doity por evento.

Estratégia (validada nos testes da API):
- a API estabiliza com `data_atualizacao` (>=) + páginas pequenas (perPage=50, máx 8 págs);
- coleta forward por cursor: cada rodada lê até 8 páginas a partir do cursor atual,
  avança o cursor para o maior `data_atualizacao` visto, e repete até `novos=0`;
- "fim" só vale se houve ≥1 página lida com sucesso (500 transitório NÃO é fim);
- UPSERT idempotente por (evento_id, doity_participante_id);
- cursor só avança em sucesso. Erro → registra status='erro' sem mexer no cursor.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogo import Evento
from app.models.mkt import VendaDoity
from app.services.crypto import decrypt_json
from app.services.doity import (
    DEFAULT_PER_PAGE,
    DEFAULT_SITUACOES_PAGAS,
    MAX_PAGINAS_POR_RODADA,
    SITUACAO_EM_CONTESTACAO,
    DoityClient,
    DoityError,
    esta_pago,
    formatar_data_atualizacao_para_doity,
    mapear_campos_personalizados,
    normalizar_telefone_br,
    parse_doity_datetime_br,
)

log = logging.getLogger("doity_sync")


def _decifrar_token(evento: Evento) -> str | None:
    if not evento.doity_credentials_cifradas:
        return None
    creds = decrypt_json(evento.doity_credentials_cifradas)
    token = creds.get("token") if isinstance(creds, dict) else None
    return token or None


def _mapear_participante(
    evento_id: Any,
    participante: dict[str, Any],
    situacoes_pagas: tuple[int, ...],
) -> dict[str, Any] | None:
    """Converte 1 participante da API em dict pronto pra UPSERT em mkt.vendas_doity.
    Retorna None se faltar `id`.
    """
    pid_raw = participante.get("id")
    try:
        pid = int(pid_raw) if pid_raw is not None else None
    except (TypeError, ValueError):
        pid = None
    if pid is None:
        return None

    compra = participante.get("compra") or {}
    situacao = compra.get("situacao") or {}
    comprador = compra.get("comprador") or {}
    endereco = comprador.get("endereco") or {}
    identificacao = comprador.get("identificacao") or {}
    lote = participante.get("lote") or {}

    codigo = situacao.get("codigo")
    try:
        codigo_int = int(codigo) if codigo is not None else None
    except (TypeError, ValueError):
        codigo_int = None

    em_contestacao = codigo_int == SITUACAO_EM_CONTESTACAO
    pago = esta_pago(participante, situacoes_pagas)

    custom = mapear_campos_personalizados(participante)

    data_inscricao_str = participante.get("data")
    data_inscricao = None
    if data_inscricao_str:
        dt = parse_doity_datetime_br(data_inscricao_str)
        if dt is not None:
            data_inscricao = dt.date()

    data_atualizacao_raw = (
        participante.get("data_atualizacao")
        or participante.get("modified")
        or participante.get("atualizado_em")
    )
    data_atualizacao_dt = parse_doity_datetime_br(data_atualizacao_raw)

    telefone_norm = normalizar_telefone_br(comprador.get("telefone"))

    return {
        "evento_id": evento_id,
        "doity_participante_id": pid,
        "nome": (participante.get("nome") or comprador.get("nome") or None),
        "pago": bool(pago),
        "em_contestacao": bool(em_contestacao),
        "situacao_codigo": codigo_int,
        "situacao_descricao": situacao.get("descricao"),
        "valor_pago": _num_or_none(participante.get("valor_pago")),
        "valor_recebido": _num_or_none(participante.get("valor_recebido")),
        "forma_pagamento": compra.get("forma_pagamento") or None,
        "data_inscricao": data_inscricao,
        "comprador_email": (comprador.get("email") or "").strip().lower() or None,
        "comprador_telefone": telefone_norm,
        "comprador_cpf": identificacao.get("numero") or None,
        "whatsapp": custom["whatsapp"],
        "cidade": (endereco.get("cidade") or custom["cidade"]) or None,
        "estado": (endereco.get("estado") or custom["estado"]) or None,
        "profissao": custom["profissao"],
        "genero": custom["genero"],
        "lote_id": _int_or_none(lote.get("id")),
        "lote_nome": lote.get("nome"),
        "raw": participante,
        "data_atualizacao_doity": data_atualizacao_dt,
    }


def _num_or_none(v: Any) -> float | None:
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _int_or_none(v: Any) -> int | None:
    if v in (None, ""):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


async def _upsert_venda(db: AsyncSession, valores: dict[str, Any]) -> None:
    update_cols = {k: v for k, v in valores.items() if k not in ("evento_id", "doity_participante_id")}
    stmt = pg_insert(VendaDoity).values(**valores)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_vendas_doity_evento_part",
        set_={**update_cols, "atualizado_em": datetime.now(tz=timezone.utc)},
    )
    await db.execute(stmt)


async def sync_doity_evento(
    db: AsyncSession,
    evento: Evento,
    *,
    desde: datetime | None = None,
) -> dict[str, Any]:
    """Sincroniza vendas/inscrições Doity de UM evento.

    Cursor multi-rodada: cada rodada lê até `MAX_PAGINAS_POR_RODADA` páginas a partir
    do cursor atual; avança o cursor pro maior data_atualizacao visto; para quando
    não vier nenhum participante novo numa rodada com ≥1 página lida.
    """
    # Captura tudo no início — após commits/rollback, o objeto ORM pode estar
    # expired e acessar atributos triggera I/O síncrono (MissingGreenlet).
    evento_id = evento.id
    doity_event_id = evento.doity_event_id

    if not doity_event_id:
        await _gravar_status(db, evento, status="sem_event_id", erro=None, total=None)
        await db.commit()
        return {"ok": False, "motivo": "sem doity_event_id"}

    token = _decifrar_token(evento)
    if not token:
        await _gravar_status(db, evento, status="sem_token", erro=None, total=None)
        await db.commit()
        return {"ok": False, "motivo": "sem token cifrado"}

    situacoes_pagas = tuple(int(c) for c in (evento.doity_situacoes_pagas or list(DEFAULT_SITUACOES_PAGAS)))

    cursor = evento.doity_cursor or desde
    if cursor is None:
        # primeira carga sem hint: pega últimas ~24h
        cursor = datetime.now(tz=timezone.utc) - timedelta(days=1)
    if cursor.tzinfo is None:
        cursor = cursor.replace(tzinfo=timezone.utc)

    total_processados = 0
    novos_total = 0
    rodadas = 0
    paginas_lidas_total = 0
    # IDs já processados nesta execução — desambigua "rodada repete tudo
    # porque vários registros têm data_atualizacao no mesmo segundo".
    processados_global: set[int] = set()

    try:
        async with DoityClient(token) as client:
            while True:
                rodadas += 1
                if rodadas > 200:
                    raise DoityError("Doity: trava anti-loop disparou (>200 rodadas)")

                cursor_str = formatar_data_atualizacao_para_doity(cursor)
                paginas_lidas_rodada = 0
                novos_unicos_rodada = 0  # IDs novos nesta execução
                maior_atualizacao_rodada: datetime | None = None
                vistos_ids: set[int] = set()

                for page in range(1, MAX_PAGINAS_POR_RODADA + 1):
                    payload = await client.listar_participantes(
                        doity_event_id,
                        data_atualizacao=cursor_str,
                        page=page,
                        limit=DEFAULT_PER_PAGE,
                    )
                    paginas_lidas_rodada += 1
                    paginas_lidas_total += 1
                    itens = _extrair_itens(payload)
                    if not itens:
                        break
                    for participante in itens:
                        pid = participante.get("id")
                        try:
                            pid_int = int(pid)
                        except (TypeError, ValueError):
                            continue
                        if pid_int in vistos_ids:
                            continue
                        vistos_ids.add(pid_int)
                        valores = _mapear_participante(evento_id, participante, situacoes_pagas)
                        if valores is None:
                            continue
                        await _upsert_venda(db, valores)
                        total_processados += 1
                        dt = valores.get("data_atualizacao_doity")
                        if dt and (maior_atualizacao_rodada is None or dt > maior_atualizacao_rodada):
                            maior_atualizacao_rodada = dt
                        if pid_int not in processados_global:
                            processados_global.add(pid_int)
                            novos_unicos_rodada += 1
                    if len(itens) < DEFAULT_PER_PAGE:
                        break

                novos_total += novos_unicos_rodada

                # Commit por rodada — evita perder trabalho se a próxima rodada
                # falhar (token revogado no meio, timeout, etc).
                await db.commit()

                # Fim: nenhum item lido nesta rodada.
                if len(vistos_ids) == 0:
                    break

                # Se nada novo (todos já tinham sido processados nesta execução)
                # E o cursor não avança → terminou.
                if novos_unicos_rodada == 0 and (
                    maior_atualizacao_rodada is None or maior_atualizacao_rodada <= cursor
                ):
                    break

                if maior_atualizacao_rodada is None:
                    raise DoityError(
                        "Doity: rodada com itens mas sem data_atualizacao — abortando"
                    )
                if maior_atualizacao_rodada > cursor:
                    cursor = maior_atualizacao_rodada
                else:
                    # Empate: vários participantes com mesmo data_atualizacao.
                    # Já processamos todos deste segundo (in-memory dedup) → avança 1s.
                    cursor = cursor + timedelta(seconds=1)

        await db.execute(
            update(Evento)
            .where(Evento.id == evento_id)
            .values(
                doity_cursor=cursor,
                doity_ultimo_sync=datetime.now(tz=timezone.utc),
                doity_ultimo_sync_status="ok",
                doity_ultimo_sync_erro=None,
                doity_ultimo_sync_total=total_processados,
            )
        )
        await db.commit()
        return {
            "ok": True,
            "evento_id": str(evento_id),
            "doity_event_id": doity_event_id,
            "total": total_processados,
            "novos": novos_total,
            "rodadas": rodadas,
            "paginas_lidas": paginas_lidas_total,
            "cursor": cursor.isoformat(),
        }
    except Exception as e:
        log.exception("doity_sync falhou no evento %s", evento_id)
        await db.rollback()
        await db.execute(
            update(Evento)
            .where(Evento.id == evento_id)
            .values(
                doity_ultimo_sync=datetime.now(tz=timezone.utc),
                doity_ultimo_sync_status="erro",
                doity_ultimo_sync_erro=str(e)[:500],
            )
        )
        await db.commit()
        return {
            "ok": False,
            "evento_id": str(evento_id),
            "doity_event_id": doity_event_id,
            "erro": str(e)[:500],
            "total": total_processados,
            "novos": novos_total,
            "rodadas": rodadas,
        }


def _extrair_itens(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    # estruturas vistas: {"data": [...]} ou {"items": [...]} ou {"participantes": [...]} ou lista direta
    for chave in ("data", "items", "participantes"):
        v = payload.get(chave)
        if isinstance(v, list):
            return v
    # alguns endpoints encapsulam { data: { data: [...] } }
    inner = payload.get("data") if isinstance(payload.get("data"), dict) else None
    if isinstance(inner, dict):
        for chave in ("data", "items", "participantes"):
            v = inner.get(chave)
            if isinstance(v, list):
                return v
    return []


async def _gravar_sucesso(
    db: AsyncSession,
    evento: Evento,
    *,
    novo_cursor: datetime,
    total: int,
) -> None:
    await db.execute(
        update(Evento)
        .where(Evento.id == evento.id)
        .values(
            doity_cursor=novo_cursor,
            doity_ultimo_sync=datetime.now(tz=timezone.utc),
            doity_ultimo_sync_status="ok",
            doity_ultimo_sync_erro=None,
            doity_ultimo_sync_total=total,
        )
    )


async def _gravar_status(
    db: AsyncSession,
    evento: Evento,
    *,
    status: str,
    erro: str | None,
    total: int | None,
) -> None:
    values: dict[str, Any] = {
        "doity_ultimo_sync": datetime.now(tz=timezone.utc),
        "doity_ultimo_sync_status": status,
        "doity_ultimo_sync_erro": erro,
    }
    if total is not None:
        values["doity_ultimo_sync_total"] = total
    await db.execute(update(Evento).where(Evento.id == evento.id).values(**values))


async def sync_doity_todos(db: AsyncSession) -> dict[str, Any]:
    """Itera todos os eventos com doity_event_id e ativo=True. Um erro num evento
    não derruba os outros — cada um abre transação própria via sync_doity_evento.
    """
    q = (
        select(Evento)
        .where(Evento.doity_event_id.is_not(None))
        .where(Evento.ativo.is_(True))
        .order_by(Evento.criado_em)
    )
    res = await db.execute(q)
    eventos = list(res.scalars().all())

    resultados: list[dict[str, Any]] = []
    ok = 0
    erro = 0
    for evento in eventos:
        try:
            r = await sync_doity_evento(db, evento)
            resultados.append(r)
            if r.get("ok"):
                ok += 1
            else:
                erro += 1
        except Exception as e:  # defesa extra
            log.exception("doity_sync_todos: erro no evento %s", evento.id)
            erro += 1
            resultados.append({"ok": False, "evento_id": str(evento.id), "erro": str(e)[:300]})
    return {"total_eventos": len(eventos), "ok": ok, "erro": erro, "resultados": resultados}
