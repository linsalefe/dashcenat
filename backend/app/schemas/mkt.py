"""Schemas Pydantic do domínio mkt (Sprint APR1)."""
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


Frente = Literal["pos", "congresso", "curso", "comunidade"]


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


# ============================================================
# Sprint Marketing Frentes — Pós / Congressos / Cursos / Comunidade
# ============================================================

class FrentePeriodoBase(BaseModel):
    """Campos editáveis pelo gestor via Dialog."""
    frente: Frente
    ano: int = Field(ge=2020, le=2100)
    mes: int = Field(ge=1, le=12)
    evento_nome: str = Field(min_length=1, max_length=500)
    evento_id: UUID | None = None

    investimento_ads: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)

    alcance: int = Field(default=0, ge=0)
    cliques: int = Field(default=0, ge=0)
    visitantes_lp: int = Field(default=0, ge=0)
    checkout: int = Field(default=0, ge=0)
    compras: int = Field(default=0, ge=0)

    meta_leads: int | None = Field(default=None, ge=0)
    leads: int | None = Field(default=None, ge=0)
    meta_ligacao: int | None = Field(default=None, ge=0)
    ligacao: int | None = Field(default=None, ge=0)
    meta_sql: int | None = Field(default=None, ge=0)
    sql_reuniao: int | None = Field(default=None, ge=0)
    meta_reuniao: int | None = Field(default=None, ge=0)
    reuniao_realizada: int | None = Field(default=None, ge=0)
    meta_vendas: int | None = Field(default=None, ge=0)
    vendas: int | None = Field(default=None, ge=0)

    meta_inscritos: int = Field(default=0, ge=0)
    inscritos: int = Field(default=0, ge=0)
    meta_receita: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    receita: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)

    ticket_medio: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    taxa_doity: Decimal | None = Field(default=None, ge=0, le=1)
    no_show_pct: Decimal | None = Field(default=None, ge=0, le=1)

    extras: dict[str, Any] = Field(default_factory=dict)


class FrentePeriodoCreate(FrentePeriodoBase):
    pass


class FrentePeriodoUpdate(BaseModel):
    """Patch parcial — não permite trocar (frente, ano, mes, evento_nome). Delete + cria de novo pra isso."""
    evento_id: UUID | None = None

    investimento_ads: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)

    alcance: int | None = Field(default=None, ge=0)
    cliques: int | None = Field(default=None, ge=0)
    visitantes_lp: int | None = Field(default=None, ge=0)
    checkout: int | None = Field(default=None, ge=0)
    compras: int | None = Field(default=None, ge=0)

    meta_leads: int | None = Field(default=None, ge=0)
    leads: int | None = Field(default=None, ge=0)
    meta_ligacao: int | None = Field(default=None, ge=0)
    ligacao: int | None = Field(default=None, ge=0)
    meta_sql: int | None = Field(default=None, ge=0)
    sql_reuniao: int | None = Field(default=None, ge=0)
    meta_reuniao: int | None = Field(default=None, ge=0)
    reuniao_realizada: int | None = Field(default=None, ge=0)
    meta_vendas: int | None = Field(default=None, ge=0)
    vendas: int | None = Field(default=None, ge=0)

    meta_inscritos: int | None = Field(default=None, ge=0)
    inscritos: int | None = Field(default=None, ge=0)
    meta_receita: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    receita: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)

    ticket_medio: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    taxa_doity: Decimal | None = Field(default=None, ge=0, le=1)
    no_show_pct: Decimal | None = Field(default=None, ge=0, le=1)

    extras: dict[str, Any] | None = None


class FrentePeriodoOut(FrentePeriodoBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ===== Dashboards agregados de cada frente =====

class FrenteFunilEtapa(BaseModel):
    """Etapa do funil exibida na tela de uma frente."""
    nome: str
    meta: Decimal | int | None = None
    realizado: Decimal | int | None = None
    pct_meta: Decimal | None = None      # 0..1


class FrenteDashboardKPI(BaseModel):
    label: str
    valor: Decimal | int | str
    meta: Decimal | int | None = None
    pct_meta: Decimal | None = None      # 0..1
    formato: Literal["numero", "moeda", "percentual"] = "numero"


class FrenteDashboardOut(BaseModel):
    frente: Frente
    ano: int
    mes: int
    kpis: list[FrenteDashboardKPI]
    funil: list[FrenteFunilEtapa]
    eventos: list[FrentePeriodoOut]


# ============================================================
# Sprint Funil Mensal — funil de mídia paga por (frente, ano, mes)
# ============================================================

class FunilMensalBase(BaseModel):
    frente: Frente
    ano: int = Field(ge=2020, le=2100)
    mes: int = Field(ge=1, le=12)

    investimento_ads: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    alcance: int = Field(default=0, ge=0)
    cliques: int = Field(default=0, ge=0)
    visitantes_lp: int = Field(default=0, ge=0)
    checkout: int = Field(default=0, ge=0)
    compras: int = Field(default=0, ge=0)
    extras: dict[str, Any] = Field(default_factory=dict)


class FunilMensalCreate(FunilMensalBase):
    pass


class FunilMensalUpdate(BaseModel):
    investimento_ads: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    alcance: int | None = Field(default=None, ge=0)
    cliques: int | None = Field(default=None, ge=0)
    visitantes_lp: int | None = Field(default=None, ge=0)
    checkout: int | None = Field(default=None, ge=0)
    compras: int | None = Field(default=None, ge=0)
    extras: dict[str, Any] | None = None


class FunilMensalOut(FunilMensalBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime
