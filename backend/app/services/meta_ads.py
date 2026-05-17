"""Cliente Meta Marketing API v21.0 — insights, custom conversions, campaigns, debug_token.

Autenticação por System User token de longa duração (sem OAuth flow). O token é
passado via query param `access_token=` (a Meta aceita assim).

NÃO logar o token em hipótese alguma — usar `mask()` se precisar identificar.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import unicodedata
from datetime import date, timedelta
from typing import Any

import httpx

log = logging.getLogger("meta_ads")

BASE_URL = "https://graph.facebook.com/v21.0"

# Campos do insights — manter explícito pra controlar o payload
INSIGHTS_FIELDS = ",".join(
    [
        "campaign_id",
        "campaign_name",
        "objective",
        "spend",
        "reach",
        "impressions",
        "inline_link_clicks",
        "ctr",
        "cpc",
        "cpm",
        "frequency",
        "actions",
        "action_values",
        "date_start",
        "date_stop",
    ]
)


class MetaAdsError(Exception):
    pass


# ============================================================
# Cliente HTTP
# ============================================================

class MetaAdsClient:
    """
    Uso:
        client = MetaAdsClient(access_token)
        accounts = await client.list_ad_accounts()
        rows = await client.fetch_insights('act_123', since, until)
    """

    def __init__(self, access_token: str, timeout: float = 60.0):
        if not access_token:
            raise MetaAdsError("Meta Ads: access_token é obrigatório")
        self.access_token = access_token
        self.timeout = timeout

    async def _get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_retries: int = 3,
    ) -> dict[str, Any]:
        """GET com retry em 429/5xx (backoff exponencial: 1s, 2s, 4s)."""
        q = dict(params or {})
        q["access_token"] = self.access_token

        url = f"{BASE_URL}{path}" if path.startswith("/") else f"{BASE_URL}/{path}"

        last_err = ""
        async with httpx.AsyncClient(timeout=self.timeout) as http:
            for tentativa in range(max_retries):
                try:
                    r = await http.get(url, params=q)
                except httpx.HTTPError as e:
                    last_err = f"http_error: {e}"
                    await asyncio.sleep(2 ** tentativa)
                    continue

                if r.status_code == 200:
                    return r.json()

                # Erros transientes → retry
                if r.status_code == 429 or r.status_code >= 500:
                    last_err = f"{r.status_code}: {r.text[:200]}"
                    await asyncio.sleep(2 ** tentativa)
                    continue

                # Erro permanente — não tem porque retry
                raise MetaAdsError(
                    f"Meta API {r.status_code} em {path}: {r.text[:300]}"
                )

        raise MetaAdsError(f"Meta API esgotou retries em {path}: {last_err}")

    async def _get_paginated(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_pages: int = 100,
    ) -> list[dict[str, Any]]:
        """Itera paginação cursor-based (`paging.next`) da Graph API."""
        items: list[dict[str, Any]] = []
        page = 0
        next_url: str | None = None

        async with httpx.AsyncClient(timeout=self.timeout) as http:
            while page < max_pages:
                page += 1

                if next_url:
                    # paging.next já vem com todos os params + access_token
                    r = await self._raw_get(http, next_url)
                else:
                    q = dict(params or {})
                    q["access_token"] = self.access_token
                    full_url = f"{BASE_URL}{path}" if path.startswith("/") else f"{BASE_URL}/{path}"
                    r = await self._raw_get_with_params(http, full_url, q)

                if r.status_code != 200:
                    raise MetaAdsError(
                        f"Meta API {r.status_code} em {path}: {r.text[:300]}"
                    )

                payload = r.json()
                data = payload.get("data") or []
                items.extend(data)

                paging = payload.get("paging") or {}
                next_url = paging.get("next")
                if not next_url:
                    break

        return items

    async def _raw_get(self, http: httpx.AsyncClient, url: str) -> httpx.Response:
        for tentativa in range(3):
            try:
                r = await http.get(url)
            except httpx.HTTPError:
                await asyncio.sleep(2 ** tentativa)
                continue
            if r.status_code == 200 or r.status_code < 500 and r.status_code != 429:
                return r
            await asyncio.sleep(2 ** tentativa)
        return r  # type: ignore[return-value]

    async def _raw_get_with_params(
        self, http: httpx.AsyncClient, url: str, params: dict[str, Any]
    ) -> httpx.Response:
        for tentativa in range(3):
            try:
                r = await http.get(url, params=params)
            except httpx.HTTPError:
                await asyncio.sleep(2 ** tentativa)
                continue
            if r.status_code == 200 or r.status_code < 500 and r.status_code != 429:
                return r
            await asyncio.sleep(2 ** tentativa)
        return r  # type: ignore[return-value]

    # ----- Endpoints -----

    async def list_ad_accounts(self) -> list[dict[str, Any]]:
        """GET /me/adaccounts?fields=id,name,account_status,currency"""
        items = await self._get_paginated(
            "/me/adaccounts",
            params={"fields": "id,name,account_status,currency", "limit": 100},
        )
        return items

    async def fetch_insights(
        self,
        ad_account_id: str,
        since: date,
        until: date,
        level: str = "campaign",
    ) -> list[dict[str, Any]]:
        """
        GET /{ad_account_id}/insights — 1 request por dia no intervalo.

        A combinação `time_increment=1` + `actions` no `fields` rejeita janelas
        multi-dia em contas de volume alto (error code 2 / subcode 1504044).
        Workaround: loop dia-a-dia com `time_range={since:D, until:D}` sem
        `time_increment`. Cada response tem `date_start == date_stop == D`,
        preservando a granularidade diária no banco.
        """
        if until < since:
            return []

        total_dias = (until - since).days + 1
        rows: list[dict[str, Any]] = []

        for i in range(total_dias):
            dia = since + timedelta(days=i)
            iso = dia.isoformat()
            time_range = json.dumps({"since": iso, "until": iso})

            page = await self._get_paginated(
                f"/{ad_account_id}/insights",
                params={
                    "fields": INSIGHTS_FIELDS,
                    "time_range": time_range,
                    "level": level,
                    "limit": 500,
                },
            )
            rows.extend(page)

            if (i + 1) % 5 == 0 or (i + 1) == total_dias:
                log.info(f"meta_ads insights: {i + 1}/{total_dias} dias processados")

            if i + 1 < total_dias:
                await asyncio.sleep(0.3)

        return rows

    async def fetch_custom_conversions(self, ad_account_id: str) -> list[dict[str, Any]]:
        """GET /{ad_account_id}/customconversions"""
        return await self._get_paginated(
            f"/{ad_account_id}/customconversions",
            params={
                "fields": "id,name,description,custom_event_type",
                "limit": 100,
            },
        )

    async def fetch_campaigns_meta(self, ad_account_id: str) -> dict[str, dict[str, Any]]:
        """Retorna dict campaign_id → {name, objective, status, effective_status}.

        Usado pra enriquecer linhas de insights que não trazem `objective` direto
        (depende do level e do escopo da query).
        """
        items = await self._get_paginated(
            f"/{ad_account_id}/campaigns",
            params={
                "fields": "id,name,objective,status,effective_status",
                "limit": 500,
            },
        )
        return {item["id"]: item for item in items if item.get("id")}

    async def fetch_token_info(self) -> dict[str, Any]:
        """GET /debug_token?input_token=<token>&access_token=<token>

        Retorna data['expires_at'] (epoch seconds, 0 = never expires),
        data['scopes'], data['app_id'], etc.
        """
        # debug_token tem assinatura própria — input_token e access_token são separados
        url = f"{BASE_URL}/debug_token"
        params = {"input_token": self.access_token, "access_token": self.access_token}
        async with httpx.AsyncClient(timeout=self.timeout) as http:
            r = await http.get(url, params=params)
        if r.status_code != 200:
            raise MetaAdsError(f"debug_token falhou ({r.status_code}): {r.text[:200]}")
        payload = r.json()
        return payload.get("data") or {}


# ============================================================
# Parsing de insights
# ============================================================

# Mapa de action_type → coluna no nosso modelo
ACTION_MAP = {
    "landing_page_view": "landing_page_views",
    "initiate_checkout": "initiate_checkout",
    "offsite_conversion.fb_pixel_initiate_checkout": "initiate_checkout",
    "purchase": "purchases",
    "offsite_conversion.fb_pixel_purchase": "purchases",
    "omni_purchase": "purchases",
    "complete_registration": "complete_registration",
    "offsite_conversion.fb_pixel_complete_registration": "complete_registration",
}

# Regex pra detectar custom conversion: "offsite_conversion.custom.<id>"
CUSTOM_CONV_RE = re.compile(r"^offsite_conversion\.custom\.(\d+)$")


def _to_int(v: Any) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def _to_float(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def parse_insight_row(
    row: dict[str, Any],
    custom_conv_map: dict[str, dict[str, Any]],
    ad_account_id: str,
    campaign_meta: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Converte 1 linha do insights da Meta no dict pra upsert em meta_ads_insights.

    - Extrai actions: landing_page_view, initiate_checkout, purchase, complete_registration
    - Extrai action_values: purchase (para purchase_value)
    - Detecta offsite_conversion.custom.<id> → busca nome em custom_conv_map → JSONB
    - utm_campaign_inferido = slugify(campaign_name)
    """
    actions = row.get("actions") or []
    action_values = row.get("action_values") or []

    # Acumuladores
    funil = {
        "landing_page_views": 0,
        "initiate_checkout": 0,
        "purchases": 0,
        "complete_registration": 0,
    }
    purchase_value = 0.0

    custom_conversions: dict[str, dict[str, Any]] = {}
    custom_total = 0

    # 1) actions → contagens
    for a in actions:
        atype = a.get("action_type") or ""
        valor = _to_int(a.get("value"))

        if atype in ACTION_MAP:
            funil[ACTION_MAP[atype]] += valor
            continue

        # custom conversion: offsite_conversion.custom.<id>
        m = CUSTOM_CONV_RE.match(atype)
        if m:
            conv_id = m.group(1)
            meta_conv = custom_conv_map.get(conv_id) or {}
            nome = meta_conv.get("name") or f"custom_{conv_id}"
            if conv_id not in custom_conversions:
                custom_conversions[conv_id] = {"name": nome, "count": 0, "value": 0.0}
            custom_conversions[conv_id]["count"] += valor
            custom_total += valor

    # 2) action_values → purchase_value e value de custom convs
    for av in action_values:
        atype = av.get("action_type") or ""
        valor = _to_float(av.get("value"))

        if atype == "purchase" or atype == "offsite_conversion.fb_pixel_purchase" or atype == "omni_purchase":
            purchase_value += valor
            continue

        m = CUSTOM_CONV_RE.match(atype)
        if m and m.group(1) in custom_conversions:
            custom_conversions[m.group(1)]["value"] += valor

    campaign_id = str(row.get("campaign_id") or "")
    campaign_name = str(row.get("campaign_name") or "")

    # date_start vem como string ISO ("YYYY-MM-DD") da Meta API,
    # mas a coluna `data` é DATE no Postgres — asyncpg exige datetime.date.
    data_raw = row.get("date_start")
    data_value = date.fromisoformat(data_raw) if isinstance(data_raw, str) else data_raw

    # Objetivo / status — preferir o do `row.objective` quando vier, senão fallback do campaign_meta
    objective = row.get("objective")
    status_camp = None
    if campaign_meta and campaign_id in campaign_meta:
        meta_c = campaign_meta[campaign_id]
        objective = objective or meta_c.get("objective")
        status_camp = meta_c.get("effective_status") or meta_c.get("status")

    return {
        "data": data_value,
        "ad_account_id": ad_account_id,
        "campaign_id": campaign_id,
        "campaign_name": campaign_name,
        "objetivo": objective,
        "status": status_camp,
        # adset_id/ad_id são NOT NULL DEFAULT '' no banco — o índice UNIQUE depende
        # disso pra não precisar de COALESCE no ON CONFLICT.
        "adset_id": row.get("adset_id") or "",
        "adset_name": row.get("adset_name"),
        "ad_id": row.get("ad_id") or "",
        "ad_name": row.get("ad_name"),
        # Mídia
        "spend": _to_float(row.get("spend")),
        "reach": _to_int(row.get("reach")),
        "impressions": _to_int(row.get("impressions")),
        "clicks": _to_int(row.get("inline_link_clicks")),
        "ctr": _to_float(row.get("ctr")) if row.get("ctr") else None,
        "cpc": _to_float(row.get("cpc")) if row.get("cpc") else None,
        "cpm": _to_float(row.get("cpm")) if row.get("cpm") else None,
        "frequency": _to_float(row.get("frequency")) if row.get("frequency") else None,
        # Funil
        "landing_page_views": funil["landing_page_views"],
        "initiate_checkout": funil["initiate_checkout"],
        "purchases": funil["purchases"],
        "purchase_value": purchase_value,
        "complete_registration": funil["complete_registration"],
        # Custom
        "custom_conversions": custom_conversions or None,
        "custom_conversions_total": custom_total,
        # Mapeamento
        "utm_campaign_inferido": slugify_campaign(campaign_name),
        "raw_payload": row,
    }


def slugify_campaign(name: str) -> str:
    """Normaliza nome de campanha → utm_campaign-style slug.

    Ex: 'Curso Luto - Maio 2026' → 'curso_luto_maio_2026'
    """
    if not name:
        return ""
    # Remove acentos
    norm = unicodedata.normalize("NFKD", name)
    ascii_str = norm.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_str.lower()
    # Substitui não-alfanumérico por _
    slug = re.sub(r"[^a-z0-9]+", "_", lowered)
    # Strip _ das pontas
    return slug.strip("_")
