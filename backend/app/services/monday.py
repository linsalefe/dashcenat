"""Cliente monday.com (GraphQL v2) + auto-classificação + normalização.

Espelha o formato do DoityClient. v1 é somente leitura do monday.

Regras da API (validadas na Fase 0, 2026-07-07):
- POST https://api.monday.com/v2, header Authorization: <token> (sem "Bearer") +
  header API-Version (fixado em settings.MONDAY_API_VERSION = "2026-07", kind=current).
- boards(limit, page): paginação por página (não cursor) — paginar até página vazia.
- items_page(limit<=500, cursor) + next_items_page(cursor): paginação por cursor.
- Rate limit por minuto + complexity budget: backoff em 429 e erro de complexidade;
  sincronizar boards EM SÉRIE (nunca em paralelo).

Zero-config: `classificar_board` deduz o mapa (colunas de status/prazo/responsável +
categorização dos rótulos) pelo type da coluna + heurística no título/rótulo. O mapa
efetivo usado no sync é `auto ⊕ overrides` (ver `mapa_efetivo`).
"""
from __future__ import annotations

import asyncio
import json
import random
import re
from datetime import date, datetime, timezone
from typing import Any, AsyncIterator

import httpx

from app.core.config import settings


class MondayError(Exception):
    pass


# ============================================================
# Heurísticas de auto-classificação (escopo de módulo)
# ============================================================
RE_STATUS = re.compile(r"status|situa|fase|est[aá]gio|progress", re.I)
RE_PRAZO = re.compile(r"prazo|deadline|vencim|entrega|data.?fim|due", re.I)
RE_RESP = re.compile(r"respons|owner|dono|atribu|assign", re.I)
# 'complet' cobre o inglês "Completed" (gap identificado na Fase 0).
RE_CONCLUIDO = re.compile(r"conclu|complet|feito|entregue|done|finaliz|pronto", re.I)
RE_OUTRO = re.compile(r"cancel|arquiv|descart|pausad|espera|hold", re.I)

# Boards de subitens que o monday auto-gera (double-count do board-pai) → fora por padrão.
RE_SUBELEMENTO = re.compile(r"^(subelementos de|subitems of)\b", re.I)


def _pick_status(cols: list[dict]) -> tuple[dict | None, str]:
    cands = [c for c in cols if c.get("type") == "status"]
    if not cands:
        return None, "n/a"
    if len(cands) == 1:
        return cands[0], "alta"
    titled = [c for c in cands if RE_STATUS.search(c.get("title") or "")]
    if titled:
        return titled[0], ("alta" if len(titled) == 1 else "baixa")
    return cands[0], "baixa"


def _pick_prazo(cols: list[dict]) -> tuple[dict | None, str]:
    cands = [c for c in cols if c.get("type") in ("date", "timeline")]
    if not cands:
        return None, "n/a"
    titled = [c for c in cands if RE_PRAZO.search(c.get("title") or "")]
    if titled:
        return titled[0], ("alta" if len(titled) == 1 else "baixa")
    if len(cands) == 1:
        return cands[0], "media"
    return cands[0], "baixa"


def _pick_resp(cols: list[dict]) -> tuple[dict | None, str]:
    cands = [c for c in cols if c.get("type") == "people"]
    if not cands:
        return None, "n/a"
    titled = [c for c in cands if RE_RESP.search(c.get("title") or "")]
    if titled:
        return titled[0], "alta"
    if len(cands) == 1:
        return cands[0], "alta"
    return cands[0], "baixa"


def _categorizar_rotulos(status_col: dict | None) -> dict[str, list[str]]:
    """Extrai os rótulos de settings_str e categoriza em concluido/outro/andamento."""
    out: dict[str, list[str]] = {"concluido": [], "outro": [], "andamento": []}
    if not status_col:
        return out
    try:
        settings_obj = json.loads(status_col.get("settings_str") or "{}")
    except (json.JSONDecodeError, TypeError):
        return out
    labels = settings_obj.get("labels") or {}
    items = labels.items() if isinstance(labels, dict) else enumerate(labels)
    for _idx, txt in items:
        if not txt:
            continue
        txt = str(txt)
        if RE_CONCLUIDO.search(txt):
            out["concluido"].append(txt)
        elif RE_OUTRO.search(txt):
            out["outro"].append(txt)
        else:
            out["andamento"].append(txt)
    return out


def _slim_col(col: dict | None) -> dict | None:
    if not col:
        return None
    return {"id": col.get("id"), "title": col.get("title"), "type": col.get("type")}


def classificar_board(board: dict) -> tuple[dict[str, Any], dict[str, Any], str]:
    """Deduz (colunas_map, status_map, confianca) de um board da query de descoberta.

    colunas_map = {"status": {id,title,type}|None, "prazo": {...}|None, "responsavel": {...}|None}
    status_map  = {"concluido": [...], "andamento": [...], "outro": [...]}
    confianca   = "alta" | "baixa" | "media (sem prazo)" | "n/a (sem status)"
    """
    cols = board.get("columns") or []
    scol, sconf = _pick_status(cols)
    pcol, pconf = _pick_prazo(cols)
    rcol, rconf = _pick_resp(cols)

    colunas_map = {
        "status": _slim_col(scol),
        "prazo": _slim_col(pcol),
        "responsavel": _slim_col(rcol),
    }
    status_map = _categorizar_rotulos(scol)

    if scol is None:
        confianca = "n/a (sem status)"
    elif "baixa" in (sconf, rconf) or pconf == "baixa":
        confianca = "baixa"
    elif pconf == "n/a":
        confianca = "media (sem prazo)"
    else:
        confianca = "alta"
    return colunas_map, status_map, confianca


def eh_projeto(board: dict) -> bool:
    """Board 'de projeto' = tem ≥1 coluna de status."""
    return any(c.get("type") == "status" for c in (board.get("columns") or []))


def eh_subelemento(nome: str | None) -> bool:
    return bool(RE_SUBELEMENTO.search(nome or ""))


def mapa_efetivo(colunas_map: dict, status_map: dict, overrides: dict | None) -> tuple[dict, dict]:
    """Mapa efetivo = auto ⊕ overrides. Overrides nunca é tocado pela re-descoberta.

    overrides = {
      "colunas": {"prazo": {id,title,type}, ...},   # substitui coluna individual
      "status_map": {"concluido": [...], ...},        # substitui categoria(s) de rótulo
    }
    """
    cols = dict(colunas_map or {})
    smap = dict(status_map or {})
    ov = overrides or {}
    for chave, val in (ov.get("colunas") or {}).items():
        cols[chave] = val
    for cat, rotulos in (ov.get("status_map") or {}).items():
        smap[cat] = rotulos
    return cols, smap


# ============================================================
# Cliente
# ============================================================
class MondayClient:
    """Cliente assíncrono para a API GraphQL do monday.

    Uso:
        async with MondayClient(token) as c:
            boards = await c.listar_boards()
            async for item in c.iterar_itens(board_id):
                ...
    """

    def __init__(
        self,
        token: str,
        *,
        api_version: str | None = None,
        base_url: str | None = None,
        timeout: float = 60.0,
    ):
        if not token:
            raise MondayError("monday: token obrigatório")
        self._token = token
        self.api_version = api_version or settings.MONDAY_API_VERSION
        self.base_url = (base_url or settings.MONDAY_API_URL).rstrip("/")
        self.timeout = timeout
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "MondayClient":
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Authorization": self._token,  # monday NÃO usa "Bearer"
                "API-Version": self.api_version,
                "Content-Type": "application/json",
            },
        )
        return self

    async def __aexit__(self, *exc) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    async def execute(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
        *,
        max_attempts: int = 6,
    ) -> dict[str, Any]:
        if self._http is None:
            raise MondayError("MondayClient precisa ser usado com `async with`")
        body: dict[str, Any] = {"query": query}
        if variables:
            body["variables"] = variables

        delays = (2.0, 5.0, 15.0, 30.0, 45.0)
        last_exc: Exception | None = None
        for attempt in range(max_attempts):
            try:
                r = await self._http.post("", json=body)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                last_exc = e
                await self._sleep_backoff(delays, attempt)
                continue

            if r.status_code == 429:
                retry_after = _parse_retry_after(r.headers.get("Retry-After"))
                if retry_after is not None:
                    await asyncio.sleep(retry_after)
                else:
                    await self._sleep_backoff(delays, attempt)
                last_exc = MondayError("monday 429 (rate limit)")
                continue

            if r.status_code != 200:
                # monday costuma responder 200 mesmo com erro GraphQL; !=200 é raro.
                if r.status_code in (500, 502, 503, 504):
                    last_exc = MondayError(f"monday {r.status_code}")
                    await self._sleep_backoff(delays, attempt)
                    continue
                raise MondayError(f"monday HTTP {r.status_code}: {r.text[:300]}")

            try:
                data = r.json()
            except ValueError as e:
                raise MondayError("monday: resposta não-JSON") from e

            errors = data.get("errors") or data.get("error_message")
            if errors:
                blob = json.dumps(errors) if not isinstance(errors, str) else errors
                low = blob.lower()
                # Complexity budget / rate exceeded → backoff e tenta de novo.
                if "complexity" in low or "budget" in low or "minute rate" in low or "rate limit" in low:
                    last_exc = MondayError(f"monday complexity/rate: {blob[:200]}")
                    await self._sleep_backoff(delays, attempt)
                    continue
                raise MondayError(f"monday GraphQL: {blob[:400]}")

            return data
        raise MondayError(f"monday: esgotou tentativas: {last_exc}")

    @staticmethod
    async def _sleep_backoff(delays: tuple[float, ...], attempt: int) -> None:
        base = delays[attempt] if attempt < len(delays) else delays[-1]
        jitter = random.uniform(0, base * 0.25)
        await asyncio.sleep(base + jitter)

    # -------- descoberta: listar boards (paginação limit/page) --------
    _BOARDS_Q = """
    query ($limit: Int!, $page: Int!) {
      boards (limit: $limit, page: $page, state: active, order_by: used_at) {
        id name state board_kind
        workspace { id name }
        columns { id title type settings_str }
        items_count
      }
    }
    """

    async def listar_boards(self, *, per_page: int = 50) -> list[dict[str, Any]]:
        boards: list[dict[str, Any]] = []
        page = 1
        while True:
            data = await self.execute(self._BOARDS_Q, {"limit": per_page, "page": page})
            batch = (data.get("data") or {}).get("boards") or []
            if not batch:
                break
            boards.extend(batch)
            if len(batch) < per_page:
                break
            page += 1
        return boards

    # -------- itens (paginação por cursor) --------
    _ITEM_FIELDS = """
      id name created_at updated_at
      group { id title }
      column_values { id type text value }
    """
    _ITEMS_FIRST_Q = (
        "query ($board: [ID!], $limit: Int!) { boards(ids: $board) { "
        "items_page(limit: $limit) { cursor items { %s } } } }" % _ITEM_FIELDS
    )
    _ITEMS_NEXT_Q = (
        "query ($cursor: String!, $limit: Int!) { "
        "next_items_page(cursor: $cursor, limit: $limit) { cursor items { %s } } }" % _ITEM_FIELDS
    )

    async def iterar_itens(
        self, board_id: int | str, *, per_page: int = 500
    ) -> AsyncIterator[dict[str, Any]]:
        """Async generator: itera TODOS os itens de um board via cursor (limit máx 500)."""
        data = await self.execute(
            self._ITEMS_FIRST_Q, {"board": [str(board_id)], "limit": per_page}
        )
        boards = (data.get("data") or {}).get("boards") or []
        if not boards:
            return
        page = boards[0].get("items_page") or {}
        for it in page.get("items") or []:
            yield it
        cursor = page.get("cursor")
        while cursor:
            data = await self.execute(
                self._ITEMS_NEXT_Q, {"cursor": cursor, "limit": per_page}
            )
            page = (data.get("data") or {}).get("next_items_page") or {}
            for it in page.get("items") or []:
                yield it
            cursor = page.get("cursor")


def _parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


# ============================================================
# Normalização de itens guiada pelo mapa efetivo
# ============================================================
def _parse_monday_datetime(value: str | None) -> datetime | None:
    """created_at/updated_at vêm em ISO 8601 UTC (ex.: '2026-07-01T12:34:56Z')."""
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    s = str(value).strip()[:10]
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _col_por_id(item: dict) -> dict[str, dict]:
    out = {}
    for cv in item.get("column_values") or []:
        cid = cv.get("id")
        if cid:
            out[cid] = cv
    return out


def _extrair_responsaveis(cv: dict | None) -> list[dict[str, Any]]:
    """people column → [{person_id, nome, kind}]. Nome vem do `text` (ordem casa com value)."""
    if not cv:
        return []
    nomes: list[str] = []
    txt = cv.get("text")
    if txt:
        nomes = [n.strip() for n in str(txt).split(",") if n.strip()]
    pessoas: list[dict[str, Any]] = []
    val = cv.get("value")
    if val:
        try:
            parsed = json.loads(val) if isinstance(val, str) else val
        except (json.JSONDecodeError, TypeError):
            parsed = None
        pts = (parsed or {}).get("personsAndTeams") or [] if isinstance(parsed, dict) else []
        for i, p in enumerate(pts):
            pid = p.get("id")
            try:
                pid = int(pid) if pid is not None else None
            except (TypeError, ValueError):
                pid = None
            pessoas.append({
                "person_id": pid,
                "nome": nomes[i] if i < len(nomes) else None,
                "kind": p.get("kind"),
            })
    return pessoas


def _extrair_prazo(cv: dict | None, tipo: str | None) -> tuple[date | None, date | None]:
    """date → (None, fim). timeline → (from, to). Usa `to` como prazo_fim."""
    if not cv:
        return None, None
    if tipo == "timeline":
        val = cv.get("value")
        if val:
            try:
                parsed = json.loads(val) if isinstance(val, str) else val
            except (json.JSONDecodeError, TypeError):
                parsed = None
            if isinstance(parsed, dict):
                return _parse_date(parsed.get("from")), _parse_date(parsed.get("to"))
        # fallback: text "2026-01-01 - 2026-02-01"
        txt = cv.get("text") or ""
        partes = [p.strip() for p in str(txt).split(" - ")]
        if len(partes) == 2:
            return _parse_date(partes[0]), _parse_date(partes[1])
        return None, None
    # date
    return None, _parse_date(cv.get("text"))


def normalizar_item(item: dict, colunas_map: dict) -> dict[str, Any]:
    """Converte 1 item da API em dict de campos (sem concluido/atrasado — calculados no sync)."""
    por_id = _col_por_id(item)

    scol = (colunas_map or {}).get("status") or {}
    pcol = (colunas_map or {}).get("prazo") or {}
    rcol = (colunas_map or {}).get("responsavel") or {}

    status_cv = por_id.get(scol.get("id")) if scol else None
    status = (status_cv or {}).get("text") or None

    prazo_ini, prazo_fim = _extrair_prazo(
        por_id.get(pcol.get("id")) if pcol else None, pcol.get("type")
    )
    responsaveis = _extrair_responsaveis(por_id.get(rcol.get("id")) if rcol else None)

    mid_raw = item.get("id")
    try:
        mid = int(mid_raw) if mid_raw is not None else None
    except (TypeError, ValueError):
        mid = None

    return {
        "monday_item_id": mid,
        "nome": item.get("name"),
        "grupo": (item.get("group") or {}).get("title"),
        "status": status,
        "responsaveis": responsaveis,
        "prazo_inicio": prazo_ini,
        "prazo_fim": prazo_fim,
        "criado_monday": _parse_monday_datetime(item.get("created_at")),
        "atualizado_monday": _parse_monday_datetime(item.get("updated_at")),
        "raw": item,
    }
