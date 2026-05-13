"""Cifra/decifra de credenciais sensíveis usando Fernet (cryptography).

Chave: variável de ambiente `FERNET_KEY` (gerada com `Fernet.generate_key()`).
Se ausente, deriva uma chave do JWT_SECRET (pra dev). Em produção, sempre setar FERNET_KEY.
"""
from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _get_key() -> bytes:
    raw = getattr(settings, "FERNET_KEY", None)
    if raw:
        # Aceita tanto chave Fernet bruta quanto algo derivável.
        try:
            Fernet(raw.encode() if isinstance(raw, str) else raw)
            return raw.encode() if isinstance(raw, str) else raw
        except Exception:
            pass
    # fallback: derivar de JWT_SECRET (NÃO USAR EM PRODUÇÃO)
    digest = hashlib.sha256(settings.JWT_SECRET.encode()).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_get_key())


def encrypt_json(data: dict[str, Any]) -> str:
    raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
    return _fernet.encrypt(raw).decode("utf-8")


def decrypt_json(token: str | None) -> dict[str, Any]:
    if not token:
        return {}
    try:
        raw = _fernet.decrypt(token.encode("utf-8"))
        return json.loads(raw.decode("utf-8"))
    except (InvalidToken, ValueError):
        return {}


def mask(value: str | None, show: int = 4) -> str | None:
    """Mascara uma string sensível pra exibir parcialmente (ex: '••••abcd')."""
    if not value:
        return None
    if len(value) <= show:
        return "•" * len(value)
    return "•" * (len(value) - show) + value[-show:]
