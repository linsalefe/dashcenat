"""Helpers compartilhados pelos parsers de ETL."""
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Any


def normalize(s: str | None) -> str:
    """lowercase + sem acento + sem espaços extras. Pra comparação."""
    if not s:
        return ""
    s = str(s).strip().lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return " ".join(s.split())


def to_decimal(v: Any) -> Decimal | None:
    """Tolerante a #REF!, #DIV/0!, %, vazio."""
    if v is None or v == "":
        return None
    if isinstance(v, str):
        s = v.strip().replace("#REF!", "").replace("#DIV/0!", "")
        if not s:
            return None
        s = s.rstrip("%").replace(",", ".")
        try:
            return Decimal(s)
        except (InvalidOperation, ValueError):
            return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError, TypeError):
        return None
