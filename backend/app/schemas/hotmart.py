"""Schemas Pydantic do Hotmart."""
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HotmartConfigIn(BaseModel):
    """Input pra salvar credenciais. Campos opcionais permitem atualizar parcialmente."""
    client_id: str | None = None
    client_secret: str | None = None
    basic_token: str | None = None
    hottok: str | None = None  # token de validação do webhook
    ativo: bool | None = None


class HotmartConfigOut(BaseModel):
    """Output sempre mascarado pra UI."""
    configurado: bool
    ativo: bool
    client_id_mask: str | None
    has_secret: bool
    has_basic_token: bool
    has_hottok: bool
    ultimo_sync: datetime | None
    ultimo_sync_status: str | None
    ultimo_sync_erro: str | None
    ultimo_sync_total: int


class SyncRequest(BaseModel):
    start_date: datetime | None = None
    end_date: datetime | None = None
    # None → default do ETL (APPROVED + COMPLETE + REFUNDED). Lista pra forçar um subset.
    transaction_status: list[str] | str | None = None


class SyncResult(BaseModel):
    ok: bool
    total: int
    novos: int
    matched: int
    por_status: dict[str, int] = {}
    erros: list[str] = []
    range: dict[str, str]


class VendaHotmartOut(BaseModel):
    id: UUID
    transacao: str
    produto: str
    preco_total: Decimal
    faturamento_liquido: Decimal
    taxa_hotmart: Decimal | None
    data_venda: datetime | None
    status: str | None
    cliente_nome: str | None
    cliente_email: str | None
    meio_pagamento: str | None
    meio_pagamento_detalhe: str | None
    is_subscription: bool | None
    commission_as: str | None
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    matched_via: str | None
    cta: str | None = None

    model_config = ConfigDict(from_attributes=True)


class HotmartStats(BaseModel):
    receita_total: Decimal
    vendas_count: int
    ticket_medio: Decimal
    matched_pct: float
    receita_por_dia: list[dict[str, Any]]
    top_produtos: list[dict[str, Any]]
    top_campaigns: list[dict[str, Any]]
    top_ctas: list[dict[str, Any]] = []
