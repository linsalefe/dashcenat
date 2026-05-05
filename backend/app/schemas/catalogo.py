import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


# --- Produto ---

class ProdutoCreate(BaseModel):
    tipo: str
    nome: str
    turma: str | None = None
    codigo: str | None = None


class ProdutoUpdate(BaseModel):
    tipo: str | None = None
    nome: str | None = None
    turma: str | None = None
    codigo: str | None = None
    ativo: bool | None = None


class ProdutoOut(BaseModel):
    id: uuid.UUID
    tipo: str
    nome: str
    turma: str | None
    codigo: str | None
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


# --- Canal ---

class CanalCreate(BaseModel):
    nome: str
    slug: str
    categoria: str | None = None


class CanalOut(BaseModel):
    id: uuid.UUID
    nome: str
    slug: str
    categoria: str | None
    ativo: bool

    model_config = {"from_attributes": True}


# --- Evento ---

class EventoCreate(BaseModel):
    nome: str
    produto_id: uuid.UUID | None = None
    meta_inscritos: int | None = None
    meta_receita: Decimal | None = None
    valor_inscricao: Decimal | None = None
    data_final: date | None = None
    meta_cpl: Decimal | None = None
    orcamento: Decimal | None = None


class EventoUpdate(BaseModel):
    nome: str | None = None
    produto_id: uuid.UUID | None = None
    meta_inscritos: int | None = None
    meta_receita: Decimal | None = None
    valor_inscricao: Decimal | None = None
    data_final: date | None = None
    meta_cpl: Decimal | None = None
    orcamento: Decimal | None = None
    ativo: bool | None = None


class EventoOut(BaseModel):
    id: uuid.UUID
    nome: str
    produto_id: uuid.UUID | None
    meta_inscritos: int | None
    meta_receita: Decimal | None
    valor_inscricao: Decimal | None
    data_final: date | None
    data_finalizacao: datetime | None
    meta_cpl: Decimal | None
    orcamento: Decimal | None
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}
