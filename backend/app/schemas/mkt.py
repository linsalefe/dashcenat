"""Schemas Pydantic do domínio mkt (Sprint APR1)."""
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ===== MetaAdsCampanha =====
class MetaAdsCampanhaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    ano: int
    mes: int
    nome_campanha: str
    investimento: Decimal
    impressoes: int
    alcance: int
    cliques: int
    cpm: Decimal | None = None
    cpc: Decimal | None = None
    ctr: Decimal | None = None
    leads: int
    leads_imersao: int
    compras: int
    valor_resultados: Decimal
    indicador_resultado: str | None = None


# ===== VendaHotmart =====
class VendaHotmartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    transacao: str
    produto: str
    preco_total: Decimal
    faturamento_liquido: Decimal
    status: str | None = None
    data_venda: datetime | None = None
    cliente_nome: str | None = None


# ===== Lancamento =====
class LancamentoBase(BaseModel):
    ano: int = Field(ge=2025, le=2099)
    mes: int = Field(ge=1, le=12)
    nome: str = Field(min_length=2, max_length=200)
    investimento_meta: Decimal | None = None
    investimento_resultado: Decimal | None = None
    leads_meta: int | None = None
    leads_organico: int = 0
    leads_pago: int = 0
    leads_total: int = 0
    cpl_meta: Decimal | None = None
    cpl_resultado: Decimal | None = None
    mqls_meta: int | None = None
    mqls_resultado: int | None = None
    alunos_meta: int | None = None
    alunos_resultado: int | None = None
    receita_meta: Decimal | None = None
    receita_resultado: Decimal | None = None
    engajamento: dict[str, Any] = Field(default_factory=dict)
    observacao: str | None = None


class LancamentoCreate(LancamentoBase):
    pass


class LancamentoUpdate(BaseModel):
    investimento_meta: Decimal | None = None
    investimento_resultado: Decimal | None = None
    leads_meta: int | None = None
    leads_organico: int | None = None
    leads_pago: int | None = None
    leads_total: int | None = None
    cpl_meta: Decimal | None = None
    cpl_resultado: Decimal | None = None
    mqls_meta: int | None = None
    mqls_resultado: int | None = None
    alunos_meta: int | None = None
    alunos_resultado: int | None = None
    receita_meta: Decimal | None = None
    receita_resultado: Decimal | None = None
    engajamento: dict[str, Any] | None = None
    observacao: str | None = None


class LancamentoOut(LancamentoBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    criado_em: datetime
    atualizado_em: datetime


# ===== ETL Result =====
class ETLResult(BaseModel):
    """Retorno de qualquer endpoint POST /etl/* — uniforme."""
    rows_processed: int
    rows_inserted: int
    rows_updated: int
    rows_skipped: int = 0
    warnings: list[str] = Field(default_factory=list)
    period_detected: str | None = None


# ===== Overview consolidado =====
class FrenteReceita(BaseModel):
    label: str
    valor: Decimal
    quantidade: int = 0
    detalhe: str | None = None
    meta_atingimento: Decimal | None = None


class FunilEtapa(BaseModel):
    nome: str
    resultado: int
    meta: int | None = None
    taxa_anterior: Decimal | None = None


class TopCampanha(BaseModel):
    nome: str
    investimento: Decimal
    receita: Decimal
    roas: Decimal


class TopEvento(BaseModel):
    nome: str
    inscritos: int
    receita: Decimal


class MetaAdsResumo(BaseModel):
    investimento: Decimal
    impressoes: int
    alcance: int
    cliques: int
    ctr: Decimal | None = None
    cpm: Decimal | None = None
    cpc: Decimal | None = None
    leads: int
    leads_imersao: int
    compras_pixel: int
    receita_pixel: Decimal
    roas_pixel: Decimal | None = None
    n_campanhas: int


class ImersaoDetalhe(BaseModel):
    nome: str
    investimento_resultado: Decimal | None = None
    receita_resultado: Decimal | None = None
    leads_total: int
    leads_organico: int
    leads_pago: int
    cpl_resultado: Decimal | None = None
    mqls_resultado: int | None = None
    engajamento: dict[str, Any] = Field(default_factory=dict)


class OverviewMensal(BaseModel):
    """JSON único agregando tudo pra tela /overview."""
    ano: int
    mes: int
    has_data: bool
    receita_total: Decimal
    roas_bruto: Decimal | None = None
    frentes: list[FrenteReceita]
    funil_comercial: list[FunilEtapa]
    funil_taxas: dict[str, Decimal]
    meta_ads: MetaAdsResumo | None = None
    top_campanhas: list[TopCampanha] = Field(default_factory=list)
    top_eventos: list[TopEvento] = Field(default_factory=list)
    imersao: ImersaoDetalhe | None = None
