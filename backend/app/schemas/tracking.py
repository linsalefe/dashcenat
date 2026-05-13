"""Schemas Pydantic para tracking (utm_links + eventos)."""
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------- UTM Links ----------

class UtmLinkBase(BaseModel):
    nome: str
    url_destino: str
    utm_source: str
    utm_medium: str
    utm_campaign: str
    utm_term: str | None = None
    utm_content: str | None = None
    produto_nome: str | None = None
    produto_id: UUID | None = None
    canal_id: UUID | None = None
    short_link: bool = True


class UtmLinkCreate(UtmLinkBase):
    pass


class UtmLinkOut(UtmLinkBase):
    id: UUID
    slug: str
    clicks: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- Eventos (ingestão pública) ----------

class TrackEventIn(BaseModel):
    """Payload enviado pelo snippet JS (público)."""
    tipo: str = Field(..., pattern="^(pageview|click|conversion)$")
    site: str | None = None
    anon_id: str | None = None
    session_id: str | None = None
    url: str | None = None
    path: str | None = None
    referrer: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_term: str | None = None
    utm_content: str | None = None
    produto_id: UUID | None = None
    produto_nome: str | None = None
    evento_nome: str | None = None
    valor: Decimal | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TrackEventOut(BaseModel):
    ok: bool = True


# ---------- Stats (dashboard) ----------

class StatTotais(BaseModel):
    pageviews: int
    cliques: int
    conversoes: int
    receita: Decimal
    taxa_conversao: float
    visitantes_unicos: int


class StatLinha(BaseModel):
    chave: str
    pageviews: int
    cliques: int
    conversoes: int
    receita: Decimal


class StatSerie(BaseModel):
    data: str  # YYYY-MM-DD
    pageviews: int
    cliques: int
    conversoes: int
    receita: Decimal


class StatsResponse(BaseModel):
    totais: StatTotais
    por_source: list[StatLinha]
    por_campaign: list[StatLinha]
    por_produto: list[StatLinha]
    serie_diaria: list[StatSerie]
