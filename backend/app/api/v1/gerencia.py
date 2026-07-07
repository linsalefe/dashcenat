"""Endpoints de Gerência (monday). Prefixo /gerencia, todos autenticados.

board_id é SEMPRE opcional; omitido → agrega todos os boards incluido=true & ativo=true.
Agregação de responsável é SEMPRE por person_id (nunca por nome).
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.gerencia import Board, Item
from app.models.user import User
from app.schemas.gerencia import (
    BoardOut,
    BoardPatch,
    PorResponsavelOut,
    ProjetoOut,
    ProjetosPage,
    ResponsavelRef,
    ResumoOut,
    SyncResultOut,
    TendenciaPonto,
)

router = APIRouter(prefix="/gerencia", tags=["gerencia"])

# "hoje" no fuso BR, calculado no banco — bate com o cálculo de `atrasado` no sync.
_HOJE_BR = "(now() AT TIME ZONE 'America/Sao_Paulo')::date"

# Filtro de escopo comum: board específico OU todos os incluídos+ativos.
def _where_escopo(board_id: str | None) -> tuple[str, dict]:
    if board_id:
        return "b.id = :bid AND b.ativo", {"bid": board_id}
    return "b.incluido AND b.ativo", {}


@router.get("/boards", response_model=list[BoardOut])
async def listar_boards(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    incluido: Annotated[bool | None, Query()] = None,
    ativo: Annotated[bool | None, Query()] = True,
):
    """Catálogo descoberto. Por padrão só ativos; filtre por incluido se quiser."""
    q = select(
        Board,
        select(func.count())
        .select_from(Item)
        .where(Item.board_id == Board.id)
        .scalar_subquery()
        .label("total_itens"),
    )
    if ativo is not None:
        q = q.where(Board.ativo.is_(ativo))
    if incluido is not None:
        q = q.where(Board.incluido.is_(incluido))
    q = q.order_by(Board.incluido.desc(), Board.nome)
    rows = (await db.execute(q)).all()
    return [
        BoardOut(
            id=str(b.id),
            monday_board_id=b.monday_board_id,
            nome=b.nome,
            workspace=b.workspace,
            board_kind=b.board_kind,
            incluido=b.incluido,
            confianca_classificacao=b.confianca_classificacao,
            ativo=b.ativo,
            colunas_map=b.colunas_map or {},
            status_map=b.status_map or {},
            overrides=b.overrides or {},
            ultimo_sync=b.ultimo_sync,
            ultimo_sync_status=b.ultimo_sync_status,
            ultimo_sync_total=b.ultimo_sync_total,
            total_itens=total_itens,
        )
        for b, total_itens in rows
    ]


@router.patch("/boards/{board_id}", response_model=BoardOut)
async def editar_board(
    board_id: str,
    body: BoardPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Único ponto de ajuste manual: liga/desliga o board (incluido) e corrige a
    classificação (overrides). A re-descoberta nunca sobrescreve estes campos."""
    try:
        bid = uuid.UUID(board_id)
    except ValueError:
        raise HTTPException(400, "board_id inválido")
    board = (await db.execute(select(Board).where(Board.id == bid))).scalar_one_or_none()
    if not board:
        raise HTTPException(404, "board não encontrado")
    if body.incluido is not None:
        board.incluido = body.incluido
    if body.overrides is not None:
        if not isinstance(body.overrides, dict):
            raise HTTPException(400, "overrides deve ser um objeto")
        board.overrides = body.overrides
    await db.commit()
    await db.refresh(board)
    total = (
        await db.execute(select(func.count()).select_from(Item).where(Item.board_id == board.id))
    ).scalar() or 0
    return BoardOut(
        id=str(board.id),
        monday_board_id=board.monday_board_id,
        nome=board.nome,
        workspace=board.workspace,
        board_kind=board.board_kind,
        incluido=board.incluido,
        confianca_classificacao=board.confianca_classificacao,
        ativo=board.ativo,
        colunas_map=board.colunas_map or {},
        status_map=board.status_map or {},
        overrides=board.overrides or {},
        ultimo_sync=board.ultimo_sync,
        ultimo_sync_status=board.ultimo_sync_status,
        ultimo_sync_total=board.ultimo_sync_total,
        total_itens=total,
    )


@router.get("/resumo", response_model=ResumoOut)
async def resumo(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    board_id: Annotated[str | None, Query()] = None,
):
    escopo, params = _where_escopo(board_id)
    sql = text(f"""
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE i.concluido) AS concluidas,
          count(*) FILTER (WHERE i.atrasado) AS atrasadas,
          count(*) FILTER (WHERE NOT i.concluido AND i.status IS NOT NULL
                           AND (b.status_map->'andamento') ? i.status) AS em_andamento,
          count(*) FILTER (WHERE jsonb_array_length(i.responsaveis) = 0) AS sem_responsavel,
          count(*) FILTER (WHERE i.prazo_fim IS NULL) AS sem_prazo,
          count(DISTINCT b.id) AS boards
        FROM gerencia.itens i
        JOIN gerencia.boards b ON b.id = i.board_id
        WHERE {escopo}
    """)
    r = (await db.execute(sql, params)).one()
    return ResumoOut(
        total=r.total, em_andamento=r.em_andamento, atrasadas=r.atrasadas,
        concluidas=r.concluidas, sem_responsavel=r.sem_responsavel,
        sem_prazo=r.sem_prazo, boards=r.boards,
    )


def _projeto_from_row(r) -> ProjetoOut:
    resp = [ResponsavelRef(**x) for x in (r.responsaveis or []) if isinstance(x, dict)]
    return ProjetoOut(
        id=str(r.id), board_id=str(r.board_id), board_nome=r.board_nome,
        monday_item_id=r.monday_item_id, nome=r.nome, grupo=r.grupo, status=r.status,
        responsaveis=resp, prazo_inicio=r.prazo_inicio, prazo_fim=r.prazo_fim,
        concluido=r.concluido, atrasado=r.atrasado,
        dias_atraso=int(r.dias_atraso) if getattr(r, "dias_atraso", None) is not None else None,
    )


@router.get("/projetos", response_model=ProjetosPage)
async def projetos(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    board_id: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    responsavel: Annotated[int | None, Query(description="person_id")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=200)] = 50,
):
    escopo, params = _where_escopo(board_id)
    filtros = ""
    if status:
        filtros += " AND i.status = :status"
        params["status"] = status
    if responsavel is not None:
        filtros += " AND EXISTS (SELECT 1 FROM jsonb_array_elements(i.responsaveis) p" \
                   " WHERE (p->>'person_id')::bigint = :resp)"
        params["resp"] = responsavel

    base = f"""
        FROM gerencia.itens i
        JOIN gerencia.boards b ON b.id = i.board_id
        WHERE {escopo}{filtros}
    """
    total = (await db.execute(text(f"SELECT count(*) {base}"), params)).scalar() or 0
    params_p = {**params, "lim": per_page, "off": (page - 1) * per_page}
    sql = text(f"""
        SELECT i.id, i.board_id, b.nome AS board_nome, i.monday_item_id, i.nome, i.grupo,
               i.status, i.responsaveis, i.prazo_inicio, i.prazo_fim, i.concluido, i.atrasado,
               CASE WHEN i.prazo_fim IS NOT NULL AND NOT i.concluido
                    THEN {_HOJE_BR} - i.prazo_fim END AS dias_atraso
        {base}
        ORDER BY i.atrasado DESC, i.prazo_fim NULLS LAST, i.nome
        LIMIT :lim OFFSET :off
    """)
    rows = (await db.execute(sql, params_p)).all()
    return ProjetosPage(
        items=[_projeto_from_row(r) for r in rows], total=total, page=page, per_page=per_page
    )


@router.get("/tarefas-atrasadas", response_model=list[ProjetoOut])
async def tarefas_atrasadas(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    board_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    escopo, params = _where_escopo(board_id)
    params["lim"] = limit
    sql = text(f"""
        SELECT i.id, i.board_id, b.nome AS board_nome, i.monday_item_id, i.nome, i.grupo,
               i.status, i.responsaveis, i.prazo_inicio, i.prazo_fim, i.concluido, i.atrasado,
               {_HOJE_BR} - i.prazo_fim AS dias_atraso
        FROM gerencia.itens i
        JOIN gerencia.boards b ON b.id = i.board_id
        WHERE {escopo} AND i.atrasado
        ORDER BY dias_atraso DESC, i.prazo_fim
        LIMIT :lim
    """)
    rows = (await db.execute(sql, params)).all()
    return [_projeto_from_row(r) for r in rows]


@router.get("/por-responsavel", response_model=list[PorResponsavelOut])
async def por_responsavel(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    board_id: Annotated[str | None, Query()] = None,
):
    """Carga por pessoa — agregada por person_id (nome só rótulo). + bucket 'sem responsável'."""
    escopo, params = _where_escopo(board_id)
    # Por pessoa (unnest do JSONB responsaveis).
    sql = text(f"""
        SELECT (p->>'person_id')::bigint AS person_id,
               max(p->>'nome') AS nome,
               count(*) AS total,
               count(*) FILTER (WHERE NOT i.concluido AND i.status IS NOT NULL
                                AND (b.status_map->'andamento') ? i.status) AS em_andamento,
               count(*) FILTER (WHERE i.atrasado) AS atrasadas,
               count(*) FILTER (WHERE i.concluido) AS concluidas
        FROM gerencia.itens i
        JOIN gerencia.boards b ON b.id = i.board_id
        CROSS JOIN LATERAL jsonb_array_elements(i.responsaveis) p
        WHERE {escopo}
        GROUP BY (p->>'person_id')::bigint
        ORDER BY total DESC
    """)
    rows = (await db.execute(sql, params)).all()
    out = [
        PorResponsavelOut(
            person_id=r.person_id, nome=r.nome or f"#{r.person_id}", total=r.total,
            em_andamento=r.em_andamento, atrasadas=r.atrasadas, concluidas=r.concluidas,
        )
        for r in rows
    ]
    # bucket "sem responsável"
    sql_sem = text(f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE NOT i.concluido AND i.status IS NOT NULL
                                AND (b.status_map->'andamento') ? i.status) AS em_andamento,
               count(*) FILTER (WHERE i.atrasado) AS atrasadas,
               count(*) FILTER (WHERE i.concluido) AS concluidas
        FROM gerencia.itens i
        JOIN gerencia.boards b ON b.id = i.board_id
        WHERE {escopo} AND jsonb_array_length(i.responsaveis) = 0
    """)
    s = (await db.execute(sql_sem, params)).one()
    if s.total:
        out.append(PorResponsavelOut(
            person_id=None, nome="Sem responsável", total=s.total,
            em_andamento=s.em_andamento, atrasadas=s.atrasadas, concluidas=s.concluidas,
        ))
    return out


@router.get("/tendencia", response_model=list[TendenciaPonto])
async def tendencia(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    board_id: Annotated[str | None, Query()] = None,
    de: Annotated[date | None, Query()] = None,
    ate: Annotated[date | None, Query()] = None,
):
    escopo, params = _where_escopo(board_id)
    extra = ""
    if de:
        extra += " AND s.data >= :de"
        params["de"] = de
    if ate:
        extra += " AND s.data <= :ate"
        params["ate"] = ate
    sql = text(f"""
        SELECT s.data,
               sum(s.total) AS total,
               sum(s.em_andamento) AS em_andamento,
               sum(s.atrasadas) AS atrasadas,
               sum(s.concluidas) AS concluidas
        FROM gerencia.snapshots_diarios s
        JOIN gerencia.boards b ON b.id = s.board_id
        WHERE {escopo}{extra}
        GROUP BY s.data
        ORDER BY s.data
    """)
    rows = (await db.execute(sql, params)).all()
    return [
        TendenciaPonto(
            data=r.data, total=r.total, em_andamento=r.em_andamento,
            atrasadas=r.atrasadas, concluidas=r.concluidas,
        )
        for r in rows
    ]


@router.post("/sync", response_model=SyncResultOut)
async def sincronizar(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    board_id: Annotated[str | None, Query()] = None,
):
    """Sync sob demanda. Omitido → todos os incluídos (em série)."""
    from app.etl.monday_sync import sync_board, sync_todos

    if board_id:
        try:
            bid = uuid.UUID(board_id)
        except ValueError:
            raise HTTPException(400, "board_id inválido")
        board = (await db.execute(select(Board).where(Board.id == bid))).scalar_one_or_none()
        if not board:
            raise HTTPException(404, "board não encontrado")
        r = await sync_board(db, board)
        return SyncResultOut(
            ok=bool(r.get("ok")), boards=1, boards_ok=1 if r.get("ok") else 0,
            boards_erro=0 if r.get("ok") else 1, total_itens=r.get("total", 0), detalhe=r,
        )
    r = await sync_todos(db)
    return SyncResultOut(
        ok=bool(r.get("ok")), boards=r.get("boards", 0), boards_ok=r.get("boards_ok", 0),
        boards_erro=r.get("boards_erro", 0), total_itens=r.get("total_itens", 0),
        detalhe={k: v for k, v in r.items() if k != "resultados"},
    )
