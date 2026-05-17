"""Schemas Pydantic do Meta Ads."""
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ============================================================
# Config
# ============================================================

class MetaAdsConfigIn(BaseModel):
    """Input pra salvar credenciais. Campos opcionais permitem atualização parcial."""
    access_token: str | None = None
    ad_account_ids: list[str] | None = None  # ['act_123', 'act_456']
    ativo: bool | None = None


class MetaAdsConfigOut(BaseModel):
    """Output mascarado pra UI."""
    configurado: bool
    ativo: bool
    ad_account_ids: list[str]
    access_token_mask: str | None
    token_expires_at: datetime | None
    dias_para_expirar: int | None
    ultimo_sync: datetime | None
    ultimo_sync_status: str | None
    ultimo_sync_erro: str | None
    ultimo_sync_total: int


# ============================================================
# Sync
# ============================================================

class MetaAdsSyncRequest(BaseModel):
    since: date | None = None
    until: date | None = None


class MetaAdsSyncResult(BaseModel):
    ok: bool
    total_linhas: int
    contas_processadas: int
    erro: str | None = None
    range: dict[str, str] = {}


# ============================================================
# Listagem / Insights
# ============================================================

class MetaAdsInsightOut(BaseModel):
    id: UUID
    data: date
    ad_account_id: str
    campaign_id: str
    campaign_name: str
    objetivo: str | None
    status: str | None
    spend: Decimal
    reach: int
    impressions: int
    clicks: int
    ctr: Decimal | None
    cpc: Decimal | None
    cpm: Decimal | None
    landing_page_views: int
    initiate_checkout: int
    purchases: int
    purchase_value: Decimal
    custom_conversions_total: int
    utm_campaign_inferido: str | None

    model_config = ConfigDict(from_attributes=True)


class CustomConversionOut(BaseModel):
    id: UUID
    custom_conversion_id: str
    ad_account_id: str
    nome: str
    descricao: str | None
    custom_event_type: str | None
    ativo: bool

    model_config = ConfigDict(from_attributes=True)


class AdAccountInfo(BaseModel):
    """Item de retorno do /me/adaccounts pra setup."""
    id: str
    name: str | None = None
    account_status: int | None = None
    currency: str | None = None


# ============================================================
# Stats agregado (dashboard)
# ============================================================

class CampanhaKPI(BaseModel):
    campaign_id: str
    campaign_name: str
    objetivo: str | None
    status: str | None = None

    spend: Decimal
    reach: int
    impressions: int
    clicks: int
    ctr: float
    cpc: Decimal
    cpm: Decimal

    landing_page_views: int

    # Vendas
    initiate_checkout: int
    purchases: int
    purchase_value: Decimal
    roas: float | None
    taxa_pagina_para_checkout: float | None
    taxa_conversao_checkout: float | None
    cpa: Decimal | None

    # Leads
    resultados: int
    custo_por_resultado: Decimal | None
    taxa_cadastro: float | None


class MetaAdsStats(BaseModel):
    periodo_inicio: date
    periodo_fim: date

    spend_total: Decimal
    purchase_value_total: Decimal
    roas_geral: float | None

    campanhas_vendas: list[CampanhaKPI]
    campanhas_leads: list[CampanhaKPI]

    # Cada item: {"data": "YYYY-MM-DD", "spend": float, "purchases": int, "purchase_value": float}
    serie_diaria_vendas: list[dict[str, Any]]
    # Cada item: {"data": "YYYY-MM-DD", "spend": float, "resultados": int}
    serie_diaria_leads: list[dict[str, Any]]
