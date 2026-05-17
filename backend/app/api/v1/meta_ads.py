"""Rotas Meta Ads — config (admin), sync (admin), stats, insights, custom-conversions."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.etl.meta_ads_sync import sync_meta_ads
from app.models.integracoes import Integracao
from app.models.mkt import MetaAdsInsight, MetaCustomConversion
from app.models.user import User
from app.schemas.meta_ads import (
    AdAccountInfo,
    CampanhaKPI,
    CustomConversionOut,
    MetaAdsConfigIn,
    MetaAdsConfigOut,
    MetaAdsInsightOut,
    MetaAdsStats,
    MetaAdsSyncRequest,
    MetaAdsSyncResult,
)
from app.services.crypto import decrypt_json, encrypt_json, mask
from app.services.meta_ads import MetaAdsClient, MetaAdsError

router = APIRouter(prefix="/meta-ads", tags=["meta-ads"])


# Objetivos da Meta agrupados por nosso conceito de painel
OBJETIVOS_VENDAS = ("OUTCOME_SALES", "CONVERSIONS", "PURCHASES")
OBJETIVOS_LEADS = ("OUTCOME_LEADS", "LEAD_GENERATION")


def _exige_admin(user: User):
    if user.papel != "admin":
        raise HTTPException(
            status_code=403,
            detail="Apenas admins podem fazer esta operação",
        )


def _calcular_kpis(linha: dict) -> dict:
    """Calcula ROAS, CPA, taxas a partir dos totais agregados (no Python pra clareza)."""
    spend = float(linha["spend"] or 0)
    purchases = int(linha["purchases"] or 0)
    purchase_value = float(linha["purchase_value"] or 0)
    page_views = int(linha["landing_page_views"] or 0)
    checkouts = int(linha["initiate_checkout"] or 0)
    resultados = int(linha["resultados"] or 0)
    impressions = int(linha["impressions"] or 0)
    clicks = int(linha["clicks"] or 0)

    return {
        "roas": (purchase_value / spend) if spend > 0 else None,
        "cpa": (Decimal(str(spend)) / purchases) if purchases > 0 else None,
        "taxa_pagina_para_checkout": (
            (checkouts / page_views) if page_views > 0 else None
        ),
        "taxa_conversao_checkout": (
            (purchases / checkouts) if checkouts > 0 else None
        ),
        "custo_por_resultado": (
            (Decimal(str(spend)) / resultados) if resultados > 0 else None
        ),
        "taxa_cadastro": (resultados / page_views) if page_views > 0 else None,
        "ctr_calc": (clicks / impressions * 100) if impressions > 0 else 0.0,
        "cpc_calc": (Decimal(str(spend)) / clicks) if clicks > 0 else Decimal(0),
        "cpm_calc": (Decimal(str(spend)) / impressions * 1000) if impressions > 0 else Decimal(0),
    }


# ============================================================
# Config
# ============================================================

@router.get("/config", response_model=MetaAdsConfigOut)
async def get_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Integracao).where(Integracao.servico == "meta_ads"))
    integ = res.scalar_one_or_none()

    if not integ:
        return MetaAdsConfigOut(
            configurado=False,
            ativo=False,
            ad_account_ids=[],
            access_token_mask=None,
            token_expires_at=None,
            dias_para_expirar=None,
            ultimo_sync=None,
            ultimo_sync_status=None,
            ultimo_sync_erro=None,
            ultimo_sync_total=0,
        )

    creds = decrypt_json(integ.credentials_cifradas)
    token = creds.get("access_token")
    accounts = creds.get("ad_account_ids") or []

    config_extra = integ.config_extra or {}
    exp_str = config_extra.get("token_expires_at")
    exp_dt: datetime | None = None
    dias_exp: int | None = None
    if exp_str:
        try:
            exp_dt = datetime.fromisoformat(exp_str)
            agora = datetime.now(timezone.utc)
            dias_exp = (exp_dt - agora).days
        except (ValueError, TypeError):
            pass

    return MetaAdsConfigOut(
        configurado=bool(token and accounts),
        ativo=integ.ativo,
        ad_account_ids=list(accounts),
        access_token_mask=mask(token, show=4) if token else None,
        token_expires_at=exp_dt,
        dias_para_expirar=dias_exp,
        ultimo_sync=integ.ultimo_sync,
        ultimo_sync_status=integ.ultimo_sync_status,
        ultimo_sync_erro=integ.ultimo_sync_erro,
        ultimo_sync_total=integ.ultimo_sync_total or 0,
    )


@router.put("/config", response_model=MetaAdsConfigOut)
async def put_config(
    body: MetaAdsConfigIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _exige_admin(user)

    res = await db.execute(select(Integracao).where(Integracao.servico == "meta_ads"))
    integ = res.scalar_one_or_none()
    creds = decrypt_json(integ.credentials_cifradas) if integ else {}

    if body.access_token is not None and body.access_token.strip():
        creds["access_token"] = body.access_token.strip()
    if body.ad_account_ids is not None:
        # Normaliza: strip + filtra vazios + garante prefixo act_
        norm = []
        for raw in body.ad_account_ids:
            s = (raw or "").strip()
            if not s:
                continue
            if not s.startswith("act_"):
                s = f"act_{s}"
            norm.append(s)
        creds["ad_account_ids"] = norm

    cifrado = encrypt_json(creds) if creds else None
    ativo = body.ativo if body.ativo is not None else (integ.ativo if integ else True)

    if integ:
        integ.credentials_cifradas = cifrado
        integ.ativo = ativo
    else:
        integ = Integracao(
            servico="meta_ads", credentials_cifradas=cifrado, ativo=ativo
        )
        db.add(integ)

    await db.commit()
    return await get_config(db, user)


# ============================================================
# Helper de setup — listar ad accounts do token
# ============================================================

@router.get("/ad-accounts", response_model=list[AdAccountInfo])
async def list_ad_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _exige_admin(user)

    res = await db.execute(select(Integracao).where(Integracao.servico == "meta_ads"))
    integ = res.scalar_one_or_none()
    if not integ:
        raise HTTPException(400, "Meta Ads não configurado — salve o access_token primeiro")
    creds = decrypt_json(integ.credentials_cifradas)
    token = creds.get("access_token")
    if not token:
        raise HTTPException(400, "Access token não definido")

    try:
        client = MetaAdsClient(access_token=token)
        accounts = await client.list_ad_accounts()
    except MetaAdsError as e:
        raise HTTPException(400, f"Erro ao consultar Meta: {e}")

    return [
        AdAccountInfo(
            id=str(a.get("id") or ""),
            name=a.get("name"),
            account_status=a.get("account_status"),
            currency=a.get("currency"),
        )
        for a in accounts
    ]


# ============================================================
# Sync manual
# ============================================================

@router.post("/sync", response_model=MetaAdsSyncResult)
async def trigger_sync(
    body: MetaAdsSyncRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _exige_admin(user)

    resultado = await sync_meta_ads(db, since=body.since, until=body.until)
    return MetaAdsSyncResult(**resultado)


# ============================================================
# Insights — listagem paginada (drilldown)
# ============================================================

@router.get("/insights", response_model=list[MetaAdsInsightOut])
async def list_insights(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
    campaign_id: str | None = Query(None),
    ad_account_id: str | None = Query(None),
    objetivo: str | None = Query(None, pattern="^(vendas|leads|todos)?$"),
    limit: int = Query(500, le=2000),
    offset: int = Query(0, ge=0),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=30)

    filtros = [
        MetaAdsInsight.data >= since,
        MetaAdsInsight.data <= until,
    ]
    if campaign_id:
        filtros.append(MetaAdsInsight.campaign_id == campaign_id)
    if ad_account_id:
        filtros.append(MetaAdsInsight.ad_account_id == ad_account_id)
    if objetivo == "vendas":
        filtros.append(MetaAdsInsight.objetivo.in_(OBJETIVOS_VENDAS))
    elif objetivo == "leads":
        filtros.append(MetaAdsInsight.objetivo.in_(OBJETIVOS_LEADS))

    q = (
        select(MetaAdsInsight)
        .where(and_(*filtros))
        .order_by(MetaAdsInsight.data.desc(), MetaAdsInsight.campaign_name)
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(q)
    return res.scalars().all()


# ============================================================
# Custom conversions
# ============================================================

@router.get("/custom-conversions", response_model=list[CustomConversionOut])
async def list_custom_conversions(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(MetaCustomConversion).order_by(MetaCustomConversion.nome)
    )
    return res.scalars().all()


# ============================================================
# Stats agregado pro dashboard
# ============================================================

@router.get("/stats", response_model=MetaAdsStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
    objetivo: str = Query("todos", pattern="^(vendas|leads|todos)$"),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=30)

    # ----- Agregação por campanha -----
    q_camp = (
        select(
            MetaAdsInsight.campaign_id,
            MetaAdsInsight.campaign_name,
            MetaAdsInsight.objetivo,
            MetaAdsInsight.status,
            func.coalesce(func.sum(MetaAdsInsight.spend), 0).label("spend"),
            func.coalesce(func.sum(MetaAdsInsight.reach), 0).label("reach"),
            func.coalesce(func.sum(MetaAdsInsight.impressions), 0).label("impressions"),
            func.coalesce(func.sum(MetaAdsInsight.clicks), 0).label("clicks"),
            func.coalesce(func.sum(MetaAdsInsight.landing_page_views), 0).label("landing_page_views"),
            func.coalesce(func.sum(MetaAdsInsight.initiate_checkout), 0).label("initiate_checkout"),
            func.coalesce(func.sum(MetaAdsInsight.purchases), 0).label("purchases"),
            func.coalesce(func.sum(MetaAdsInsight.purchase_value), 0).label("purchase_value"),
            func.coalesce(func.sum(MetaAdsInsight.custom_conversions_total), 0).label("resultados"),
        )
        .where(
            and_(
                MetaAdsInsight.data >= since,
                MetaAdsInsight.data <= until,
            )
        )
        .group_by(
            MetaAdsInsight.campaign_id,
            MetaAdsInsight.campaign_name,
            MetaAdsInsight.objetivo,
            MetaAdsInsight.status,
        )
    )
    res = await db.execute(q_camp)
    rows = res.all()

    campanhas_vendas: list[CampanhaKPI] = []
    campanhas_leads: list[CampanhaKPI] = []

    spend_total = Decimal(0)
    purchase_value_total = Decimal(0)

    for r in rows:
        spend = Decimal(r.spend or 0)
        purchase_value = Decimal(r.purchase_value or 0)
        spend_total += spend
        purchase_value_total += purchase_value

        linha = {
            "spend": float(spend),
            "purchases": r.purchases or 0,
            "purchase_value": float(purchase_value),
            "landing_page_views": r.landing_page_views or 0,
            "initiate_checkout": r.initiate_checkout or 0,
            "resultados": r.resultados or 0,
            "impressions": r.impressions or 0,
            "clicks": r.clicks or 0,
        }
        kpis = _calcular_kpis(linha)

        kpi = CampanhaKPI(
            campaign_id=r.campaign_id,
            campaign_name=r.campaign_name,
            objetivo=r.objetivo,
            status=r.status,
            spend=spend,
            reach=r.reach or 0,
            impressions=r.impressions or 0,
            clicks=r.clicks or 0,
            ctr=kpis["ctr_calc"],
            cpc=kpis["cpc_calc"],
            cpm=kpis["cpm_calc"],
            landing_page_views=r.landing_page_views or 0,
            initiate_checkout=r.initiate_checkout or 0,
            purchases=r.purchases or 0,
            purchase_value=purchase_value,
            roas=kpis["roas"],
            taxa_pagina_para_checkout=kpis["taxa_pagina_para_checkout"],
            taxa_conversao_checkout=kpis["taxa_conversao_checkout"],
            cpa=kpis["cpa"],
            resultados=r.resultados or 0,
            custo_por_resultado=kpis["custo_por_resultado"],
            taxa_cadastro=kpis["taxa_cadastro"],
        )

        obj = (r.objetivo or "").upper()
        if obj in OBJETIVOS_VENDAS:
            campanhas_vendas.append(kpi)
        elif obj in OBJETIVOS_LEADS:
            campanhas_leads.append(kpi)
        else:
            # Sem objetivo classificado: heurística — se tem purchase_value, considera vendas;
            # se tem resultados (custom conv), considera leads; senão, vai pra vendas como fallback.
            if purchase_value > 0:
                campanhas_vendas.append(kpi)
            elif (r.resultados or 0) > 0:
                campanhas_leads.append(kpi)
            else:
                campanhas_vendas.append(kpi)

    # Ordena cada lista por spend desc
    campanhas_vendas.sort(key=lambda c: c.spend, reverse=True)
    campanhas_leads.sort(key=lambda c: c.spend, reverse=True)

    roas_geral = (
        float(purchase_value_total / spend_total) if spend_total > 0 else None
    )

    # ----- Série diária separada por objetivo -----
    q_diaria = (
        select(
            MetaAdsInsight.data,
            MetaAdsInsight.objetivo,
            func.coalesce(func.sum(MetaAdsInsight.spend), 0).label("spend"),
            func.coalesce(func.sum(MetaAdsInsight.purchases), 0).label("purchases"),
            func.coalesce(func.sum(MetaAdsInsight.purchase_value), 0).label("purchase_value"),
            func.coalesce(func.sum(MetaAdsInsight.custom_conversions_total), 0).label("resultados"),
        )
        .where(
            and_(
                MetaAdsInsight.data >= since,
                MetaAdsInsight.data <= until,
            )
        )
        .group_by(MetaAdsInsight.data, MetaAdsInsight.objetivo)
        .order_by(MetaAdsInsight.data)
    )
    res_dia = await db.execute(q_diaria)

    # Agrupa por (data, painel)
    vendas_dia: dict[date, dict] = defaultdict(
        lambda: {"spend": 0.0, "purchases": 0, "purchase_value": 0.0}
    )
    leads_dia: dict[date, dict] = defaultdict(
        lambda: {"spend": 0.0, "resultados": 0}
    )

    for x in res_dia.all():
        d = x.data
        obj = (x.objetivo or "").upper()
        if obj in OBJETIVOS_VENDAS:
            vendas_dia[d]["spend"] += float(x.spend or 0)
            vendas_dia[d]["purchases"] += int(x.purchases or 0)
            vendas_dia[d]["purchase_value"] += float(x.purchase_value or 0)
        elif obj in OBJETIVOS_LEADS:
            leads_dia[d]["spend"] += float(x.spend or 0)
            leads_dia[d]["resultados"] += int(x.resultados or 0)
        else:
            # heurística igual à de cima
            if float(x.purchase_value or 0) > 0:
                vendas_dia[d]["spend"] += float(x.spend or 0)
                vendas_dia[d]["purchases"] += int(x.purchases or 0)
                vendas_dia[d]["purchase_value"] += float(x.purchase_value or 0)
            else:
                leads_dia[d]["spend"] += float(x.spend or 0)
                leads_dia[d]["resultados"] += int(x.resultados or 0)

    serie_vendas = [
        {"data": d.isoformat(), **v} for d, v in sorted(vendas_dia.items())
    ]
    serie_leads = [
        {"data": d.isoformat(), **v} for d, v in sorted(leads_dia.items())
    ]

    return MetaAdsStats(
        periodo_inicio=since,
        periodo_fim=until,
        spend_total=spend_total,
        purchase_value_total=purchase_value_total,
        roas_geral=roas_geral,
        campanhas_vendas=campanhas_vendas,
        campanhas_leads=campanhas_leads,
        serie_diaria_vendas=serie_vendas,
        serie_diaria_leads=serie_leads,
    )
