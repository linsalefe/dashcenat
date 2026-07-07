from app.models.user import User
from app.models.catalogo import Produto, Canal, Evento
from app.models.comercial import FunilEtapa, FunilResultado, Venda, Reuniao
from app.models.mkt import (
    MetricaCanal,
    LeadEvento,
    InscricaoEvento,
    FrentePeriodo,
    VendaDoity,
)
from app.models.tracking import UtmLink, TrackingEvento
from app.models.integracoes import Integracao
from app.models.gerencia import Board, Item, SnapshotDiario

__all__ = [
    "User",
    "Produto",
    "Canal",
    "Evento",
    "FunilEtapa",
    "FunilResultado",
    "Venda",
    "Reuniao",
    "MetricaCanal",
    "LeadEvento",
    "InscricaoEvento",
    "FrentePeriodo",
    "VendaDoity",
    "UtmLink",
    "TrackingEvento",
    "Integracao",
    "Board",
    "Item",
    "SnapshotDiario",
]
