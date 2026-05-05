"""Endpoints do domínio comercial: funil, vendas, reuniões, dashboards."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.models.comercial import FunilEtapa, FunilResultado, Reuniao, Venda
from app.schemas.comercial import (
    FunilDashboardEtapa,
    FunilDashboardOut,
    FunilEtapaOut,
    FunilResultadoBulk,
    FunilResultadoCreate,
    FunilResultadoOut,
    NoShowOut,
    ReuniaoCreate,
    ReuniaoOut,
    ReuniaoUpdate,
    TicketMedioOut,
    VendaCreate,
    VendaOut,
    VendaUpdate,
)

router = APIRouter(prefix="/comercial", tags=["comercial"])


# ────────────────────────────── Funil ─────────────────────────────────────────

@router.get("/funil/etapas", response_model=list[FunilEtapaOut])
async def listar_etapas(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return (await db.execute(select(FunilEtapa).order_by(FunilEtapa.ordem))).scalars().all()


@router.get("/funil/resultados", response_model=list[FunilResultadoOut])
async def listar_resultados(
    produto_id: uuid.UUID | None = None,
    ano: int | None = None,
    mes: int | None = Query(None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(FunilResultado)
    if produto_id:
        q = q.where(FunilResultado.produto_id == produto_id)
    if ano:
        q = q.where(FunilResultado.ano == ano)
    if mes:
        q = q.where(FunilResultado.mes == mes)
    q = q.order_by(FunilResultado.ano.desc(), FunilResultado.mes.desc(), FunilResultado.etapa_id)
    return (await db.execute(q)).scalars().all()


@router.post("/funil/resultados", response_model=FunilResultadoOut, status_code=status.HTTP_201_CREATED)
async def upsert_resultado(
    body: FunilResultadoCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = pg_insert(FunilResultado).values(
        produto_id=body.produto_id, etapa_id=body.etapa_id, ano=body.ano, mes=body.mes,
        meta=body.meta, resultado=body.resultado, observacao=body.observacao, usuario_id=user.id,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["produto_id", "etapa_id", "ano", "mes"],
        set_={
            "meta": stmt.excluded.meta,
            "resultado": stmt.excluded.resultado,
            "observacao": stmt.excluded.observacao,
            "usuario_id": user.id,
            "atualizado_em": text("NOW()"),
        },
    ).returning(FunilResultado)
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one()


@router.post("/funil/resultados/bulk", response_model=list[FunilResultadoOut])
async def upsert_bulk(
    body: FunilResultadoBulk,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mês inteiro de 1 produto (várias etapas em 1 call)."""
    out = []
    for item in body.etapas:
        stmt = pg_insert(FunilResultado).values(
            produto_id=body.produto_id, etapa_id=item.etapa_id,
            ano=body.ano, mes=body.mes,
            meta=item.meta, resultado=item.resultado, usuario_id=user.id,
        ).on_conflict_do_update(
            index_elements=["produto_id", "etapa_id", "ano", "mes"],
            set_={
                "meta": item.meta,
                "resultado": item.resultado,
                "usuario_id": user.id,
                "atualizado_em": text("NOW()"),
            },
        ).returning(FunilResultado)
        result = await db.execute(stmt)
        out.append(result.scalar_one())
    await db.commit()
    return out


# ────────────────────────────── Vendas ────────────────────────────────────────

@router.get("/vendas", response_model=list[VendaOut])
async def listar_vendas(
    produto_id: uuid.UUID | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    vendedor: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Venda)
    if produto_id:
        q = q.where(Venda.produto_id == produto_id)
    if data_inicio:
        q = q.where(Venda.data_venda >= data_inicio)
    if data_fim:
        q = q.where(Venda.data_venda <= data_fim)
    if vendedor:
        q = q.where(Venda.vendedor.ilike(f"%{vendedor}%"))
    q = q.order_by(Venda.data_venda.desc())
    return (await db.execute(q)).scalars().all()


@router.post("/vendas", response_model=VendaOut, status_code=status.HTTP_201_CREATED)
async def criar_venda(body: VendaCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    venda = Venda(**body.model_dump(), usuario_id=user.id)
    db.add(venda)
    await db.commit()
    await db.refresh(venda)
    return venda


@router.patch("/vendas/{venda_id}", response_model=VendaOut)
async def atualizar_venda(
    venda_id: uuid.UUID, body: VendaUpdate,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    venda = (await db.execute(select(Venda).where(Venda.id == venda_id))).scalar_one_or_none()
    if not venda:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(venda, k, v)
    await db.commit()
    await db.refresh(venda)
    return venda


# ────────────────────────────── Reuniões ──────────────────────────────────────

@router.get("/reunioes", response_model=list[ReuniaoOut])
async def listar_reunioes(
    produto_id: uuid.UUID | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    status_filtro: str | None = Query(None, alias="status", pattern="^(agendada|realizada|no_show|venda)$"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Reuniao)
    if produto_id:
        q = q.where(Reuniao.produto_id == produto_id)
    if data_inicio:
        q = q.where(Reuniao.data_agendada >= data_inicio)
    if data_fim:
        q = q.where(Reuniao.data_agendada <= data_fim)
    if status_filtro == "agendada":
        q = q.where(Reuniao.data_realizada.is_(None), Reuniao.no_show.is_(False))
    elif status_filtro == "realizada":
        q = q.where(Reuniao.data_realizada.is_not(None), Reuniao.no_show.is_(False))
    elif status_filtro == "no_show":
        q = q.where(Reuniao.no_show.is_(True))
    elif status_filtro == "venda":
        q = q.where(Reuniao.resultou_em_venda.is_(True))
    q = q.order_by(Reuniao.data_agendada.desc())
    return (await db.execute(q)).scalars().all()


@router.post("/reunioes", response_model=ReuniaoOut, status_code=status.HTTP_201_CREATED)
async def criar_reuniao(body: ReuniaoCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    r = Reuniao(**body.model_dump(), usuario_id=user.id)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


@router.patch("/reunioes/{reuniao_id}", response_model=ReuniaoOut)
async def atualizar_reuniao(
    reuniao_id: uuid.UUID, body: ReuniaoUpdate,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    r = (await db.execute(select(Reuniao).where(Reuniao.id == reuniao_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reunião não encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return r


# ────────────────────────────── Dashboards ───────────────────────────────────

@router.get("/dashboard/funil", response_model=FunilDashboardOut)
async def dashboard_funil(
    ano: int = Query(...),
    mes: int = Query(..., ge=1, le=12),
    produto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Funil de 5 etapas com meta+resultado e 5 taxas. Agrega se produto_id=None."""
    etapas = (await db.execute(select(FunilEtapa).order_by(FunilEtapa.ordem))).scalars().all()

    if produto_id:
        sql = text("""
            SELECT * FROM comercial.v_taxa_conversao
            WHERE produto_id = :produto_id AND ano = :ano AND mes = :mes
        """)
        row = (await db.execute(sql, {"produto_id": produto_id, "ano": ano, "mes": mes})).mappings().first()
    else:
        sql = text("""
            SELECT
                NULL::uuid AS produto_id,
                CAST(:ano AS INTEGER) AS ano,
                CAST(:mes AS INTEGER) AS mes,
                SUM(leads) AS leads, SUM(ligacao) AS ligacao,
                SUM(sql_reuniao) AS sql_reuniao,
                SUM(reuniao_realizada) AS reuniao_realizada,
                SUM(venda) AS venda,
                SUM(meta_leads) AS meta_leads, SUM(meta_ligacao) AS meta_ligacao,
                SUM(meta_sql_reuniao) AS meta_sql_reuniao,
                SUM(meta_reuniao_realizada) AS meta_reuniao_realizada,
                SUM(meta_venda) AS meta_venda
            FROM comercial.v_taxa_conversao
            WHERE ano = :ano AND mes = :mes
        """)
        row = (await db.execute(sql, {"ano": ano, "mes": mes})).mappings().first()

    if not row or row.get("leads") is None:
        return FunilDashboardOut(
            produto_id=produto_id, ano=ano, mes=mes,
            etapas=[FunilDashboardEtapa(etapa_id=e.id, codigo=e.codigo, nome=e.nome, ordem=e.ordem, meta=None, resultado=None) for e in etapas],
            taxa_lead_ligacao=None, taxa_ligacao_sql=None, taxa_sql_reuniao=None,
            taxa_reuniao_venda=None, taxa_lead_venda=None,
        )

    rmap = {
        1: (row["leads"], row["meta_leads"]),
        2: (row["ligacao"], row["meta_ligacao"]),
        3: (row["sql_reuniao"], row["meta_sql_reuniao"]),
        4: (row["reuniao_realizada"], row["meta_reuniao_realizada"]),
        5: (row["venda"], row["meta_venda"]),
    }

    def safe_div(a, b):
        if a is None or b is None or b == 0:
            return None
        return float(a) / float(b)

    if produto_id:
        taxas = (row.get("taxa_lead_ligacao"), row.get("taxa_ligacao_sql"),
                 row.get("taxa_sql_reuniao"), row.get("taxa_reuniao_venda"),
                 row.get("taxa_lead_venda"))
    else:
        taxas = (
            safe_div(row["ligacao"], row["leads"]),
            safe_div(row["sql_reuniao"], row["ligacao"]),
            safe_div(row["reuniao_realizada"], row["sql_reuniao"]),
            safe_div(row["venda"], row["reuniao_realizada"]),
            safe_div(row["venda"], row["leads"]),
        )

    return FunilDashboardOut(
        produto_id=row.get("produto_id"), ano=ano, mes=mes,
        etapas=[
            FunilDashboardEtapa(
                etapa_id=e.id, codigo=e.codigo, nome=e.nome, ordem=e.ordem,
                resultado=rmap[e.id][0], meta=rmap[e.id][1],
            ) for e in etapas
        ],
        taxa_lead_ligacao=float(taxas[0]) if taxas[0] is not None else None,
        taxa_ligacao_sql=float(taxas[1]) if taxas[1] is not None else None,
        taxa_sql_reuniao=float(taxas[2]) if taxas[2] is not None else None,
        taxa_reuniao_venda=float(taxas[3]) if taxas[3] is not None else None,
        taxa_lead_venda=float(taxas[4]) if taxas[4] is not None else None,
    )


@router.get("/dashboard/ticket-medio", response_model=list[TicketMedioOut])
async def dashboard_ticket_medio(
    ano: int = Query(...),
    mes: int | None = Query(None, ge=1, le=12),
    produto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sql = "SELECT * FROM comercial.v_ticket_medio WHERE ano = :ano"
    params: dict = {"ano": ano}
    if mes:
        sql += " AND mes = :mes"
        params["mes"] = mes
    if produto_id:
        sql += " AND produto_id = :produto_id"
        params["produto_id"] = produto_id
    sql += " ORDER BY ano DESC, mes DESC"
    rows = (await db.execute(text(sql), params)).mappings().all()
    return [TicketMedioOut.model_validate(dict(r)) for r in rows]


@router.get("/dashboard/no-show", response_model=list[NoShowOut])
async def dashboard_no_show(
    ano: int = Query(...),
    mes: int | None = Query(None, ge=1, le=12),
    produto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sql = "SELECT * FROM comercial.v_no_show WHERE ano = :ano"
    params: dict = {"ano": ano}
    if mes:
        sql += " AND mes = :mes"
        params["mes"] = mes
    if produto_id:
        sql += " AND produto_id = :produto_id"
        params["produto_id"] = produto_id
    sql += " ORDER BY ano DESC, mes DESC"
    rows = (await db.execute(text(sql), params)).mappings().all()
    return [NoShowOut.model_validate(dict(r)) for r in rows]
