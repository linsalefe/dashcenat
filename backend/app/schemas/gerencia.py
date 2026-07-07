"""Schemas Pydantic do módulo Gerência (monday). Só saída (Out) + patch de board."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class BoardOut(BaseModel):
    id: str
    monday_board_id: int
    nome: str
    workspace: str | None = None
    board_kind: str | None = None
    incluido: bool
    confianca_classificacao: str | None = None
    ativo: bool
    colunas_map: dict[str, Any] = {}
    status_map: dict[str, Any] = {}
    overrides: dict[str, Any] = {}
    ultimo_sync: datetime | None = None
    ultimo_sync_status: str | None = None
    ultimo_sync_total: int = 0
    total_itens: int = 0


class BoardPatch(BaseModel):
    incluido: bool | None = None
    overrides: dict[str, Any] | None = None


class ResumoOut(BaseModel):
    total: int
    em_andamento: int
    atrasadas: int
    concluidas: int
    sem_responsavel: int
    sem_prazo: int
    boards: int  # quantos boards entraram na agregação


class ResponsavelRef(BaseModel):
    person_id: int | None = None
    nome: str | None = None
    kind: str | None = None


class ProjetoOut(BaseModel):
    id: str
    board_id: str
    board_nome: str
    monday_item_id: int
    nome: str | None = None
    grupo: str | None = None
    status: str | None = None
    responsaveis: list[ResponsavelRef] = []
    prazo_inicio: date | None = None
    prazo_fim: date | None = None
    concluido: bool
    atrasado: bool
    dias_atraso: int | None = None


class ProjetosPage(BaseModel):
    items: list[ProjetoOut]
    total: int
    page: int
    per_page: int


class PorResponsavelOut(BaseModel):
    person_id: int | None = None
    nome: str
    total: int
    em_andamento: int
    atrasadas: int
    concluidas: int


class TendenciaPonto(BaseModel):
    data: date
    total: int
    em_andamento: int
    atrasadas: int
    concluidas: int


class SyncResultOut(BaseModel):
    ok: bool
    boards: int = 0
    boards_ok: int = 0
    boards_erro: int = 0
    total_itens: int = 0
    detalhe: dict[str, Any] = {}
