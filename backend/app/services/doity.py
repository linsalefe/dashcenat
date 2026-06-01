"""Cliente Doity (API pública v1) + helpers de normalização.

A API é somente leitura (sem webhook), instável sob janela larga, com regras duras:
- chamar /participantes sem filtro retorna 500 — SEMPRE passar data_atualizacao;
- data_atualizacao é só limite inferior (>=);
- teto de ~8 páginas por janela (página 9 vira 500);
- token é por CONTA Doity, não por evento (eventos de contas diferentes precisam de
  tokens diferentes — guardamos cifrado por evento).
"""
from __future__ import annotations

import asyncio
import random
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings


class DoityError(Exception):
    pass


# Códigos de situação observados em dados reais (validados):
#   1  Autorizado    (pago)
#   4  Concluído     (pago)
#   9  Gratuito      (não pago — registro grátis)
#  13  Em Contestação (chargeback — NÃO contar como pago; estado próprio)
SITUACAO_EM_CONTESTACAO = 13
DEFAULT_SITUACOES_PAGAS: tuple[int, ...] = (1, 4)

# A API instabiliza a partir da página 8/9. Param antes.
MAX_PAGINAS_POR_RODADA = 8
DEFAULT_PER_PAGE = 50


class DoityClient:
    """Cliente assíncrono pra API pública Doity.

    Uso:
        async with DoityClient(token) as c:
            payload = await c.listar_participantes(event_id, data_atualizacao="2025-06-01 00:00:00", page=1)
    """

    def __init__(
        self,
        token: str,
        *,
        base_url: str | None = None,
        timeout: float = 30.0,
    ):
        if not token:
            raise DoityError("Doity: token obrigatório")
        self._token = token
        self.base_url = (base_url or settings.DOITY_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "DoityClient":
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/json",
            },
        )
        return self

    async def __aexit__(self, *exc) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    async def listar_participantes(
        self,
        doity_event_id: int,
        *,
        data_atualizacao: str,
        page: int = 1,
        limit: int = DEFAULT_PER_PAGE,
        sort: str = "modified",
        direction: str = "asc",
        ativo: int = 1,
    ) -> dict[str, Any]:
        """GET /eventos/{id}/participantes — uma página por chamada.

        `data_atualizacao` deve ser a string `YYYY-MM-DD HH:MM:SS` em horário BR
        (a API trata como naive/local; mandar com `Z` quebra).
        """
        if self._http is None:
            raise DoityError("Cliente Doity precisa ser usado com `async with`")

        params = {
            "ativo": ativo,
            "sort": sort,
            "direction": direction,
            "data_atualizacao": data_atualizacao,
            "page": page,
            "limit": limit,
        }
        path = f"/eventos/{doity_event_id}/participantes"
        return await self._get_with_retry(path, params)

    async def _get_with_retry(
        self,
        path: str,
        params: dict[str, Any],
        *,
        max_attempts: int = 5,
    ) -> dict[str, Any]:
        delays = (2.0, 5.0, 15.0, 30.0)
        last_exc: Exception | None = None
        for attempt in range(max_attempts):
            try:
                assert self._http is not None
                r = await self._http.get(path, params=params)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                last_exc = e
                await self._sleep_backoff(delays, attempt)
                continue
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError as e:
                    raise DoityError(f"Doity: resposta não-JSON ({r.status_code})") from e
            if r.status_code in (429, 500, 502, 503, 504):
                retry_after = _parse_retry_after(r.headers.get("Retry-After"))
                if retry_after is not None:
                    await asyncio.sleep(retry_after)
                else:
                    await self._sleep_backoff(delays, attempt)
                last_exc = DoityError(
                    f"Doity {r.status_code} em {path} (tentativa {attempt + 1})"
                )
                continue
            # 4xx não-transitório (401/403/404 etc.)
            raise DoityError(
                f"Doity {r.status_code} em {path}: {r.text[:300]}"
            )
        raise DoityError(
            f"Doity: esgotou tentativas em {path}: {last_exc}"
        )

    @staticmethod
    async def _sleep_backoff(delays: tuple[float, ...], attempt: int) -> None:
        base = delays[attempt] if attempt < len(delays) else delays[-1]
        jitter = random.uniform(0, base * 0.25)
        await asyncio.sleep(base + jitter)


def _parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


# ============================================================
# Normalização
# ============================================================

def normalizar_telefone_br(raw: str | None) -> str | None:
    """Normaliza um telefone BR para o formato `55DDDNUMERO`.

    - mantém só dígitos
    - acrescenta '55' se faltar
    - garante 9º dígito em celular (DDD + 8 dígitos onde o 1º é 6/7/8/9 → injeta 9)
    """
    if not raw:
        return None
    digits = re.sub(r"\D+", "", raw)
    if not digits:
        return None
    # remove zero à esquerda no DDD (ex: "11 9..." vs "011 9...")
    if digits.startswith("0"):
        digits = digits.lstrip("0")
    # se já começa com 55 e o resto faz sentido, mantém; senão prefixa 55
    if not digits.startswith("55"):
        digits = "55" + digits
    # Após o "55": esperado DDD (2) + número (8 ou 9). Se 8 e 1º do número
    # for 6/7/8/9 (faixas de celular), injeta o "9".
    if len(digits) == 12 and digits[4] in "6789":
        digits = digits[:4] + "9" + digits[4:]
    return digits


# Mapeamento por substring no nome do campo personalizado.
# O nome do campo é a pergunta inteira e varia por evento (validado em testes).
_SUBSTR_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("whatsapp", ("whatsapp",)),
    # "estado" pega "estado" e "estados"; "cidade" tratado separado pra não casar antes
    ("estado", ("estado",)),
    ("cidade", ("cidade",)),
    ("profissao", ("profiss",)),
    ("genero", ("gênero", "genero")),
)


def mapear_campos_personalizados(participante: dict[str, Any]) -> dict[str, str | None]:
    """Extrai whatsapp / estado / cidade / profissao / genero dos campos personalizados
    pelo nome (substring, case-insensitive). Retorna dict com todas as chaves (None se ausente).
    """
    out: dict[str, str | None] = {
        "whatsapp": None,
        "estado": None,
        "cidade": None,
        "profissao": None,
        "genero": None,
    }
    valores = participante.get("valores_campos_personalizados") or []
    if not isinstance(valores, list):
        return out
    for v in valores:
        if not isinstance(v, dict):
            continue
        campo = (v.get("campo_personalizado") or {}).get("nome") or ""
        valor = v.get("valor")
        if not campo or valor in (None, ""):
            continue
        cname = str(campo).strip().lower()
        for chave, substrs in _SUBSTR_RULES:
            if out[chave] is not None:
                continue
            if any(s in cname for s in substrs):
                out[chave] = str(valor).strip() or None
                break
    if out["whatsapp"]:
        out["whatsapp"] = normalizar_telefone_br(out["whatsapp"]) or out["whatsapp"]
    return out


def esta_pago(
    participante: dict[str, Any],
    situacoes_pagas: list[int] | tuple[int, ...] | None = None,
) -> bool:
    """Retorna True se a inscrição foi paga.

    Critério: `pago=True` no payload, OU `compra.situacao.codigo` está em
    `situacoes_pagas` (default [1, 4]). Chargeback (13) NÃO é pago.
    """
    codes = tuple(situacoes_pagas) if situacoes_pagas else DEFAULT_SITUACOES_PAGAS
    if participante.get("pago") is True:
        codigo = _situacao_codigo(participante)
        if codigo == SITUACAO_EM_CONTESTACAO:
            return False
        return True
    codigo = _situacao_codigo(participante)
    if codigo is None:
        return False
    if codigo == SITUACAO_EM_CONTESTACAO:
        return False
    return codigo in codes


def _situacao_codigo(participante: dict[str, Any]) -> int | None:
    compra = participante.get("compra") or {}
    situacao = compra.get("situacao") or {}
    cod = situacao.get("codigo")
    if cod is None:
        return None
    try:
        return int(cod)
    except (TypeError, ValueError):
        return None


# ============================================================
# Parse de timestamps Doity → datetime UTC
# ============================================================

# Doity manda timestamps locais (sem TZ explícito) representando America/Sao_Paulo (UTC-3).
# Ao gravar TIMESTAMPTZ, convertemos para UTC pra manter convenção do projeto.
_BR_TZ_OFFSET_HOURS = -3


def parse_doity_datetime_br(value: str | None) -> datetime | None:
    """Parsea uma string `YYYY-MM-DD HH:MM:SS` (ou ISO) de horário BR → UTC aware."""
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    # tenta formatos comuns
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s[: len(fmt) + 4] if "%S" in fmt and len(s) > len(fmt) else s, fmt)
            break
        except ValueError:
            dt = None
    else:
        dt = None
    if dt is None:
        # último recurso: fromisoformat
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    # Se veio com tzinfo, normaliza pra UTC; senão assume BR.
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)
    # naive → trata como horário BR (UTC-3) e converte pra UTC
    from datetime import timedelta as _td
    return (dt - _td(hours=_BR_TZ_OFFSET_HOURS)).replace(tzinfo=timezone.utc)


def formatar_data_atualizacao_para_doity(cursor_utc: datetime) -> str:
    """Converte um cursor UTC → string `YYYY-MM-DD HH:MM:SS` em horário BR (a API
    espera naive/local). NUNCA mandar com sufixo Z.
    """
    if cursor_utc.tzinfo is None:
        # supõe que veio em UTC mesmo sem tzinfo
        cursor_utc = cursor_utc.replace(tzinfo=timezone.utc)
    from datetime import timedelta as _td
    local = cursor_utc.astimezone(timezone.utc) + _td(hours=_BR_TZ_OFFSET_HOURS)
    return local.strftime("%Y-%m-%d %H:%M:%S")
