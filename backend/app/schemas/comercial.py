"""Schemas Pydantic do domínio comercial."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


# ─── Funil ───
class FunilEtapaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nome: str
    ordem: int


class FunilResultadoCreate(BaseModel):
    produto_id: uuid.UUID
    etapa_id: int
    ano: int
    mes: int
    meta: Decimal | None = None
    resultado: Decimal | None = None
    observacao: str | None = None


class FunilResultadoBulkItem(BaseModel):
    etapa_id: int
    meta: Decimal | None = None
    resultado: Decimal | None = None


class FunilResultadoBulk(BaseModel):
    produto_id: uuid.UUID
    ano: int
    mes: int
    etapas: list[FunilResultadoBulkItem]


class FunilResultadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    produto_id: uuid.UUID
    etapa_id: int
    ano: int
    mes: int
    meta: Decimal | None
    resultado: Decimal | None
    observacao: str | None
    atualizado_em: datetime


# ─── Vendas ───
class VendaCreate(BaseModel):
    produto_id: uuid.UUID
    aluno_nome: str
    aluno_email: str | None = None
    data_venda: date
    valor: Decimal
    prazo_recebimento_meses: int | None = None
    a_vista: bool = False
    vendedor: str | None = None
    observacao: str | None = None


class VendaUpdate(BaseModel):
    aluno_nome: str | None = None
    aluno_email: str | None = None
    data_venda: date | None = None
    valor: Decimal | None = None
    prazo_recebimento_meses: int | None = None
    a_vista: bool | None = None
    vendedor: str | None = None
    observacao: str | None = None


class VendaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    produto_id: uuid.UUID
    aluno_nome: str
    aluno_email: str | None
    data_venda: date
    valor: Decimal
    prazo_recebimento_meses: int | None
    a_vista: bool
    vendedor: str | None
    observacao: str | None
    criado_em: datetime


# ─── Reuniões ───
class ReuniaoCreate(BaseModel):
    produto_id: uuid.UUID
    aluno_nome: str | None = None
    aluno_email: str | None = None
    vendedor: str | None = None
    data_agendada: date
    observacao: str | None = None


class ReuniaoUpdate(BaseModel):
    """Aceita marcação de status: data_realizada, no_show, resultou_em_venda."""
    data_realizada: date | None = None
    no_show: bool | None = None
    resultou_em_venda: bool | None = None
    aluno_nome: str | None = None
    aluno_email: str | None = None
    vendedor: str | None = None
    observacao: str | None = None


class ReuniaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    produto_id: uuid.UUID
    aluno_nome: str | None
    aluno_email: str | None
    vendedor: str | None
    data_agendada: date
    data_realizada: date | None
    no_show: bool
    resultou_em_venda: bool
    observacao: str | None
    criado_em: datetime


# ─── Dashboards ───
class FunilDashboardEtapa(BaseModel):
    etapa_id: int
    codigo: str
    nome: str
    ordem: int
    meta: Decimal | None
    resultado: Decimal | None


class FunilDashboardOut(BaseModel):
    produto_id: uuid.UUID | None
    ano: int
    mes: int
    etapas: list[FunilDashboardEtapa]
    taxa_lead_ligacao: float | None
    taxa_ligacao_sql: float | None
    taxa_sql_reuniao: float | None
    taxa_reuniao_venda: float | None
    taxa_lead_venda: float | None


class TicketMedioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    produto_id: uuid.UUID
    ano: int
    mes: int
    qtd_vendas: int
    receita_total: Decimal
    ticket_medio: Decimal
    prazo_medio: float | None
    pct_a_vista: float | None


class NoShowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    produto_id: uuid.UUID
    ano: int
    mes: int
    reunioes_agendadas: int
    no_shows: int
    realizadas: int
    vendas_via_reuniao: int
    taxa_no_show: float | None
    taxa_reuniao_venda: float | None


# ─── Intercambio (Sprint APR1) ───
from pydantic import Field as _Field


class IntercambioBase(BaseModel):
    nome_aluno: str = _Field(min_length=2, max_length=300)
    valor: Decimal = _Field(gt=0)
    data_venda: date
    observacao: str | None = None


class IntercambioCreate(IntercambioBase):
    pass


class IntercambioUpdate(BaseModel):
    nome_aluno: str | None = None
    valor: Decimal | None = None
    data_venda: date | None = None
    observacao: str | None = None


class IntercambioOut(IntercambioBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    criado_em: datetime
    atualizado_em: datetime
