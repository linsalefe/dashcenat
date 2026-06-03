"""Schemas Pydantic do Doity."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DoityConfigIn(BaseModel):
    doity_event_id: int = Field(..., gt=0)
    token: str = Field(..., min_length=10)
    situacoes_pagas: list[int] | None = None
    campo_whatsapp: str | None = None


class DoityConfigUpdateIn(BaseModel):
    doity_event_id: int | None = None
    token: str | None = None
    situacoes_pagas: list[int] | None = None
    campo_whatsapp: str | None = None
    ativar: bool | None = None


class DoityConfigOut(BaseModel):
    evento_id: UUID
    evento_nome: str
    doity_event_id: int | None
    configurado: bool
    token_mask: str | None
    situacoes_pagas: list[int]
    campo_whatsapp: str | None
    cursor: datetime | None
    ultimo_sync: datetime | None
    ultimo_sync_status: str | None
    ultimo_sync_erro: str | None
    ultimo_sync_total: int


class DoitySyncOut(BaseModel):
    ok: bool
    evento_id: UUID
    doity_event_id: int | None
    total: int = 0
    novos: int = 0
    rodadas: int = 0
    paginas_lidas: int = 0
    cursor: str | None = None
    erro: str | None = None


class VendaDoityOut(BaseModel):
    id: UUID
    evento_id: UUID
    doity_participante_id: int
    nome: str | None
    pago: bool
    em_contestacao: bool
    situacao_codigo: int | None
    situacao_descricao: str | None
    valor_pago: Decimal | None
    valor_recebido: Decimal | None
    forma_pagamento: str | None
    data_inscricao: date | None
    comprador_email: str | None
    comprador_telefone: str | None
    whatsapp: str | None
    cidade: str | None
    estado: str | None
    profissao: str | None
    genero: str | None
    lote_id: int | None
    lote_nome: str | None
    data_atualizacao_doity: datetime | None
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class DoityAnaliseTotais(BaseModel):
    inscricoes: int
    pagas: int
    em_contestacao: int
    gratuitas: int
    itens: int  # linhas cruas em mkt.vendas_doity (ingressos + oficinas) — transparência
    receita: Decimal
    ticket_medio: Decimal | None


class DoityAnaliseSerie(BaseModel):
    data: date
    inscricoes: int
    pagas: int
    receita: Decimal


class DoityAnaliseFacet(BaseModel):
    chave: str
    inscricoes: int
    pagas: int


class DoityAnaliseMeta(BaseModel):
    meta_inscritos: int | None
    meta_receita: Decimal | None
    pct_inscritos: float | None
    pct_receita: float | None


class DoityAnaliseOut(BaseModel):
    evento_id: UUID
    evento_nome: str
    totais: DoityAnaliseTotais
    serie_diaria: list[DoityAnaliseSerie]
    por_estado: list[DoityAnaliseFacet]
    por_cidade: list[DoityAnaliseFacet]
    por_profissao: list[DoityAnaliseFacet]
    por_genero: list[DoityAnaliseFacet]
    meta: DoityAnaliseMeta


# Para uso externo
__all__ = [
    "DoityConfigIn",
    "DoityConfigUpdateIn",
    "DoityConfigOut",
    "DoitySyncOut",
    "VendaDoityOut",
    "DoityAnaliseTotais",
    "DoityAnaliseSerie",
    "DoityAnaliseFacet",
    "DoityAnaliseMeta",
    "DoityAnaliseOut",
]


# Eco-friendly: avoid unused-import warning when stubs reference Any.
_ = Any
