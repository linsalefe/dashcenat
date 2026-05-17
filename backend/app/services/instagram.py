"""Cliente Instagram Graph API v22 — perfil, insights, mídias, audiência.

Premissas:
- Conta @cenat em modo Business ou Creator, conectada a uma Page do FB.
- System User do Business Suite com permissões instagram_basic + instagram_manage_insights
  + pages_read_engagement + pages_show_list (mesmo token do Meta Ads serve).
- API v22+ exige metric_type=total_value pra todas as métricas de conta. Cada call
  retorna 1 valor agregado em total_value.value (não mais values[]); pra ter
  granularidade diária no banco, iteramos dia-a-dia (since=d, until=d+1).

NÃO logar o access_token — usar mask() do crypto pra identificar.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

log = logging.getLogger("instagram")

BASE_URL = "https://graph.facebook.com/v22.0"

# ============================================================
# Métricas suportadas
# ============================================================

ACCOUNT_METRICS_DAILY = [
    "reach",
    "profile_views",
    "website_clicks",
    "accounts_engaged",
    "total_interactions",
    "likes",
    "comments",
    "shares",
    "saves",
    "replies",
]

# Métricas pra mídia variam por tipo (Meta retorna 100 / error 4 se passar errado)
MEDIA_METRICS_BASE = [
    "reach",
    "likes",
    "comments",
    "shares",
    "saved",
    "total_interactions",
    "profile_visits",
    "profile_activity",
]

MEDIA_METRICS_REELS_EXTRA = [
    "views",
    "follows",
    "plays",
    "clips_replays_count",
    "ig_reels_video_view_total_time",
    "ig_reels_avg_watch_time",
]

STORY_METRICS = [
    "reach",
    "replies",
    "taps_forward",
    "taps_back",
    "exits",
    "swipe_forward",
]

MEDIA_METRICS_VIDEO_EXTRA = ["views"]

# IG v22+ consolidou audience_* numa única métrica follower_demographics com
# o tipo de corte escolhido via breakdown. audience_locale foi descontinuado.
# A entrada "age,gender" tenta cross-tab (M.18-24 / F.18-24); se Meta rejeitar
# o try/except no fetch_audience_demographics loga warning e segue.
AUDIENCE_BREAKDOWNS = [
    ("follower_demographics", "age"),
    ("follower_demographics", "gender"),
    ("follower_demographics", "age,gender"),
    ("follower_demographics", "country"),
    ("follower_demographics", "city"),
]


class InstagramError(Exception):
    pass


# ============================================================
# Cliente HTTP
# ============================================================

class InstagramClient:
    """Uso:
        client = InstagramClient(access_token)
        paginas = await client.discover_accounts()
        rows = await client.fetch_account_insights('178..', since, until)
    """

    def __init__(self, access_token: str, timeout: float = 60.0):
        if not access_token:
            raise InstagramError("Instagram: access_token é obrigatório")
        self.access_token = access_token
        self.timeout = timeout

    # ----- HTTP helpers -----

    async def _get(
        self, path: str, params: dict[str, Any] | None = None, max_retries: int = 3
    ) -> dict[str, Any]:
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
                if r.status_code == 429 or r.status_code >= 500:
                    last_err = f"{r.status_code}: {r.text[:200]}"
                    await asyncio.sleep(2 ** tentativa)
                    continue
                raise InstagramError(
                    f"IG API {r.status_code} em {path}: {r.text[:300]}"
                )

        raise InstagramError(f"IG API esgotou retries em {path}: {last_err}")

    async def _get_paginated(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_pages: int = 200,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        page = 0
        next_url: str | None = None

        async with httpx.AsyncClient(timeout=self.timeout) as http:
            while page < max_pages:
                page += 1

                if next_url:
                    r = await http.get(next_url)
                else:
                    q = dict(params or {})
                    q["access_token"] = self.access_token
                    full_url = (
                        f"{BASE_URL}{path}"
                        if path.startswith("/")
                        else f"{BASE_URL}/{path}"
                    )
                    r = await http.get(full_url, params=q)

                if r.status_code != 200:
                    raise InstagramError(
                        f"IG API {r.status_code} em {path}: {r.text[:300]}"
                    )

                payload = r.json()
                items.extend(payload.get("data") or [])
                next_url = (payload.get("paging") or {}).get("next")
                if not next_url:
                    break

        return items

    # ============================================================
    # Discovery — setup helper
    # ============================================================

    async def discover_accounts(self) -> list[dict[str, Any]]:
        """Lista Pages FB do token + IG Business Account vinculado a cada uma.

        GET /me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}
        """
        items = await self._get_paginated(
            "/me/accounts",
            params={
                "fields": (
                    "id,name,instagram_business_account{id,username,profile_picture_url}"
                ),
                "limit": 100,
            },
        )
        resultado: list[dict[str, Any]] = []
        for p in items:
            ig = p.get("instagram_business_account") or {}
            resultado.append(
                {
                    "page_id": str(p.get("id") or ""),
                    "page_name": p.get("name"),
                    "instagram_business_account_id": (
                        str(ig.get("id")) if ig.get("id") else None
                    ),
                    "ig_username": ig.get("username"),
                    "ig_profile_picture_url": ig.get("profile_picture_url"),
                }
            )
        return resultado

    # ============================================================
    # Conta
    # ============================================================

    async def fetch_account_profile(self, ig_user_id: str) -> dict[str, Any]:
        """GET /{ig_user_id}?fields=username,followers_count,follows_count,media_count,..."""
        return await self._get(
            f"/{ig_user_id}",
            params={
                "fields": (
                    "username,followers_count,follows_count,media_count,"
                    "profile_picture_url,biography,website,name"
                )
            },
        )

    async def fetch_account_insights(
        self, ig_user_id: str, since: date, until: date
    ) -> dict[date, dict[str, int]]:
        """Insights diários da conta.

        Como `metric_type=total_value` retorna 1 valor agregado por call,
        iteramos dia-a-dia (since=d, until=d+1) pra ter granularidade diária.
        Todas as métricas vão num único call por dia; se a Meta rejeitar
        alguma, fallback recursivo isola a culpada.
        """
        if until < since:
            return {}

        out: dict[date, dict[str, int]] = {}
        cursor = since
        while cursor <= until:
            try:
                dia_insights = await self._fetch_account_insights_day(
                    ig_user_id, cursor
                )
                if dia_insights:
                    out[cursor] = dia_insights
            except InstagramError as e:
                log.warning("insights de %s falharam: %s", cursor.isoformat(), e)
            cursor += timedelta(days=1)
            await asyncio.sleep(0.1)  # rate limit defensivo

        return out

    async def _fetch_account_insights_day(
        self, ig_user_id: str, dia: date
    ) -> dict[str, int]:
        """1 chamada cobrindo 1 dia (since=d 00:00 UTC, until=d+1 00:00 UTC)."""
        since_ts = int(
            datetime.combine(
                dia, datetime.min.time(), tzinfo=timezone.utc
            ).timestamp()
        )
        until_ts = int(
            datetime.combine(
                dia + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
            ).timestamp()
        )
        return await self._fetch_metrics_with_fallback(
            ig_user_id, list(ACCOUNT_METRICS_DAILY), since_ts, until_ts
        )

    async def _fetch_metrics_with_fallback(
        self,
        ig_user_id: str,
        metrics: list[str],
        since_ts: int,
        until_ts: int,
    ) -> dict[str, int]:
        """Tenta um grupo de métricas em call único; se a Meta nomear uma
        métrica inválida no erro #100, remove ela e retenta. Se o erro for
        genérico, divide o grupo na metade recursivamente até isolar.
        """
        if not metrics:
            return {}
        try:
            payload = await self._get(
                f"/{ig_user_id}/insights",
                params={
                    "metric": ",".join(metrics),
                    "period": "day",
                    "metric_type": "total_value",
                    "since": since_ts,
                    "until": until_ts,
                },
            )
            return _parse_total_value_response(payload)
        except InstagramError as e:
            msg = str(e)
            if "100" not in msg and "valid" not in msg.lower():
                raise
            culpada = next((m for m in metrics if m in msg), None)
            if culpada:
                log.warning(
                    "Meta rejeitou métrica %s: %s", culpada, msg[:160]
                )
                restantes = [m for m in metrics if m != culpada]
                return await self._fetch_metrics_with_fallback(
                    ig_user_id, restantes, since_ts, until_ts
                )
            if len(metrics) == 1:
                log.warning(
                    "métrica %s falhou sem nome no erro: %s",
                    metrics[0],
                    msg[:160],
                )
                return {}
            meio = len(metrics) // 2
            a = await self._fetch_metrics_with_fallback(
                ig_user_id, metrics[:meio], since_ts, until_ts
            )
            b = await self._fetch_metrics_with_fallback(
                ig_user_id, metrics[meio:], since_ts, until_ts
            )
            return {**a, **b}

    # ============================================================
    # Mídias
    # ============================================================

    async def fetch_media_list(
        self, ig_user_id: str, since: datetime | None = None
    ) -> list[dict[str, Any]]:
        """GET /{ig_user_id}/media — pagina até esgotar.

        Se since=None, pega tudo (cuidado: pode ser milhares).
        Pra default operacional, passar since=now()-90d.
        """
        params: dict[str, Any] = {
            "fields": (
                "id,media_type,media_product_type,caption,permalink,"
                "thumbnail_url,media_url,timestamp,like_count,comments_count"
            ),
            "limit": 100,
        }
        if since:
            params["since"] = int(since.timestamp())

        items = await self._get_paginated(f"/{ig_user_id}/media", params=params)
        # Filtra defensivamente por since no Python — `since` no GET de media é best-effort
        if since:
            items = [
                m
                for m in items
                if (m.get("timestamp") and _parse_iso(m["timestamp"]) >= since)
            ]
        return items

    async def fetch_media_insights(
        self, media_id: str, media_type: str, media_product_type: str | None = None
    ) -> dict[str, int]:
        """GET /{media_id}/insights?metric=<lista>.

        Métricas variam por tipo. Faz fallback removendo métricas que dão erro 100
        (subcode 33 — 'metric is not valid for this type'). Retorna {metric: valor}.
        """
        is_reel = (media_product_type or "").upper() == "REELS" or (
            media_type or ""
        ).upper() == "REELS"
        is_video = (media_type or "").upper() == "VIDEO"

        metrics = list(MEDIA_METRICS_BASE)
        if is_reel:
            metrics.extend(MEDIA_METRICS_REELS_EXTRA)
        elif is_video:
            metrics.extend(MEDIA_METRICS_VIDEO_EXTRA)

        # Retry com menos métricas se Meta reclamar
        return await self._fetch_media_insights_with_fallback(media_id, metrics)

    async def _fetch_media_insights_with_fallback(
        self, media_id: str, metrics: list[str]
    ) -> dict[str, int]:
        remaining = list(metrics)
        for tentativa in range(6):  # até 6 retries removendo métricas inválidas
            if not remaining:
                return {}
            try:
                payload = await self._get(
                    f"/{media_id}/insights",
                    params={"metric": ",".join(remaining)},
                )
            except InstagramError as e:
                msg = str(e)
                # Detecta "(#100) ... metric_name is not supported for this media product type"
                # ou "(#100) The value must be a valid insights metric"
                if "100" in msg or "valid" in msg.lower():
                    # Tenta extrair a métrica que o erro reclama
                    removida = None
                    for m in remaining:
                        if m in msg:
                            remaining.remove(m)
                            removida = m
                            break
                    if removida is None:
                        # Não conseguiu identificar — descarta a última e tenta de novo
                        remaining.pop()
                    continue
                raise

            out: dict[str, int] = {}
            for item in payload.get("data") or []:
                name = item.get("name") or ""
                values = item.get("values") or []
                if not values:
                    continue
                v = values[0].get("value")
                if isinstance(v, (int, float)):
                    out[name] = int(v)
                elif isinstance(v, dict):
                    out[name] = int(sum(int(x or 0) for x in v.values() if isinstance(x, (int, float))))
            return out

        return {}

    # ============================================================
    # Stories (expiram em 24h)
    # ============================================================

    async def fetch_active_stories(self, ig_user_id: str) -> list[dict[str, Any]]:
        """GET /{ig_user_id}/stories — só retorna stories ainda ativos."""
        return await self._get_paginated(
            f"/{ig_user_id}/stories",
            params={
                "fields": (
                    "id,media_type,media_url,thumbnail_url,permalink,timestamp"
                ),
                "limit": 50,
            },
        )

    async def fetch_story_insights(self, story_id: str) -> dict[str, int]:
        """GET /{story_id}/insights — métricas de story.

        Algumas métricas só existem pra IMAGE ou só pra VIDEO. Fallback removendo
        a culpada pelo erro #100 reaproveita _fetch_media_insights_with_fallback.
        """
        return await self._fetch_media_insights_with_fallback(
            story_id, list(STORY_METRICS)
        )

    # ============================================================
    # Audiência
    # ============================================================

    async def fetch_audience_demographics(
        self, ig_user_id: str
    ) -> dict[str, list[tuple[str, int]]]:
        """Retorna {breakdown: [(chave, valor)]}.

        Pra v21: metric_type=total_value + breakdown explícito. Cada métrica vem
        com 1 valor (total) detalhado pelo breakdown selecionado.
        """
        out: dict[str, list[tuple[str, int]]] = {}
        for metric, breakdown in AUDIENCE_BREAKDOWNS:
            chave_breakdown = breakdown
            try:
                payload = await self._get(
                    f"/{ig_user_id}/insights",
                    params={
                        "metric": metric,
                        "period": "lifetime",
                        "metric_type": "total_value",
                        "breakdown": breakdown,
                    },
                )
            except InstagramError as e:
                log.warning("audience %s falhou: %s", metric, e)
                continue

            items: list[tuple[str, int]] = []
            for entry in payload.get("data") or []:
                total = entry.get("total_value") or {}
                # v22+: total_value.breakdowns[].results[].{dimension_values,value}
                # Fallback p/ formato antigo onde dimension_values/value vinham
                # direto no item de breakdowns (sem results).
                for bd in total.get("breakdowns") or []:
                    candidatos = bd.get("results") or [bd]
                    for b in candidatos:
                        dims = b.get("dimension_values") or []
                        valor = b.get("value")
                        if not isinstance(valor, (int, float)):
                            continue
                        chave = ".".join(str(x) for x in dims if x)
                        if not chave:
                            continue
                        items.append((chave[:128], int(valor)))
            if items:
                out[chave_breakdown] = items
        return out


# ============================================================
# Parsers
# ============================================================

_HASHTAG_RE = re.compile(r"#([\wÀ-ſ]{2,128})", re.UNICODE)


def extract_hashtags(caption: str | None) -> list[str]:
    """Extrai hashtags únicas (lowercase, sem #) preservando ordem de aparição.

    Aceita caracteres unicode latinos (á, é, ç, ã...) e dígitos. Hashtag mínima
    de 2 chars pra ignorar lixo. Dedup mantendo posição da 1ª aparição.
    """
    if not caption:
        return []
    encontradas = _HASHTAG_RE.findall(caption)
    vistas: dict[str, None] = {}
    for h in encontradas:
        chave = h.lower()
        if chave not in vistas:
            vistas[chave] = None
    return list(vistas.keys())


def _parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return datetime.now(timezone.utc)


def _parse_total_value_response(payload: dict[str, Any]) -> dict[str, int]:
    """Lê /insights?metric_type=total_value.

    Formato v22+: item.total_value.value = N
    Fallback (formato antigo): item.values[0].value = N
    """
    out: dict[str, int] = {}
    for item in payload.get("data") or []:
        nome = item.get("name") or ""
        if not nome:
            continue
        tv = item.get("total_value")
        if isinstance(tv, dict) and "value" in tv:
            v = tv.get("value")
            if isinstance(v, (int, float)):
                out[nome] = int(v)
                continue
            if isinstance(v, dict):
                out[nome] = int(
                    sum(
                        int(x or 0)
                        for x in v.values()
                        if isinstance(x, (int, float))
                    )
                )
                continue
        values = item.get("values") or []
        if values:
            v = values[0].get("value")
            if isinstance(v, (int, float)):
                out[nome] = int(v)
            elif isinstance(v, dict):
                out[nome] = int(
                    sum(
                        int(x or 0)
                        for x in v.values()
                        if isinstance(x, (int, float))
                    )
                )
    return out


def parse_account_daily(
    ig_user_id: str,
    profile: dict[str, Any],
    insights_por_dia: dict[date, dict[str, int]],
    dia: date,
    raw_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Monta dict pra upsert em instagram_account_daily.

    Recebe o profile inteiro + insights agregados; aplica os do `dia`.
    """
    m = insights_por_dia.get(dia) or {}
    return {
        "ig_user_id": ig_user_id,
        "data": dia,
        "username": profile.get("username"),
        "followers_count": int(profile.get("followers_count") or 0),
        "follows_count": int(profile.get("follows_count") or 0),
        "media_count": int(profile.get("media_count") or 0),
        "reach": int(m.get("reach") or 0),
        "profile_views": int(m.get("profile_views") or 0),
        "website_clicks": int(m.get("website_clicks") or 0),
        "accounts_engaged": int(m.get("accounts_engaged") or 0),
        "total_interactions": int(m.get("total_interactions") or 0),
        "likes": int(m.get("likes") or 0),
        "comments": int(m.get("comments") or 0),
        "shares": int(m.get("shares") or 0),
        "saves": int(m.get("saves") or 0),
        "replies": int(m.get("replies") or 0),
        "follows_gained": 0,  # calculado depois via lag
        "raw_payload": raw_payload,
    }


def parse_media_payload(
    ig_user_id: str, media: dict[str, Any], insights: dict[str, int]
) -> dict[str, Any]:
    """Merge GET /media + GET /media/insights em 1 dict pra upsert."""
    timestamp_raw = media.get("timestamp")
    ts = _parse_iso(timestamp_raw) if timestamp_raw else datetime.now(timezone.utc)

    return {
        "ig_user_id": ig_user_id,
        "media_id": str(media.get("id") or ""),
        "media_type": str(media.get("media_type") or "UNKNOWN"),
        "media_product_type": media.get("media_product_type"),
        "caption": media.get("caption"),
        "permalink": media.get("permalink"),
        "thumbnail_url": media.get("thumbnail_url"),
        "media_url": media.get("media_url"),
        "timestamp_publicacao": ts,
        "reach": int(insights.get("reach") or 0),
        "views": int(insights.get("views") or 0),
        "likes": int(
            insights.get("likes") or media.get("like_count") or 0
        ),
        "comments": int(
            insights.get("comments") or media.get("comments_count") or 0
        ),
        "shares": int(insights.get("shares") or 0),
        "saved": int(insights.get("saved") or 0),
        "total_interactions": int(insights.get("total_interactions") or 0),
        "profile_visits": int(insights.get("profile_visits") or 0),
        "profile_activity": int(insights.get("profile_activity") or 0),
        "follows": int(insights.get("follows") or 0),
        "ig_reels_video_view_total_time": (
            int(insights["ig_reels_video_view_total_time"])
            if isinstance(insights.get("ig_reels_video_view_total_time"), (int, float))
            else None
        ),
        "ig_reels_avg_watch_time": (
            int(insights["ig_reels_avg_watch_time"])
            if isinstance(insights.get("ig_reels_avg_watch_time"), (int, float))
            else None
        ),
        "raw_payload": {"media": media, "insights": insights},
    }


def parse_story_payload(
    ig_user_id: str, story: dict[str, Any], insights: dict[str, int]
) -> dict[str, Any]:
    """Merge GET /stories + GET /{id}/insights em dict pra upsert."""
    timestamp_raw = story.get("timestamp")
    ts = _parse_iso(timestamp_raw) if timestamp_raw else datetime.now(timezone.utc)
    reach = int(insights.get("reach") or 0)
    exits = int(insights.get("exits") or 0)
    retencao_pct = (
        round((1.0 - (exits / reach)) * 100.0, 2) if reach > 0 else None
    )
    return {
        "ig_user_id": ig_user_id,
        "story_id": str(story.get("id") or ""),
        "media_type": str(story.get("media_type") or "IMAGE"),
        "thumbnail_url": story.get("thumbnail_url"),
        "media_url": story.get("media_url"),
        "permalink": story.get("permalink"),
        "timestamp_publicacao": ts,
        "reach": reach,
        "replies": int(insights.get("replies") or 0),
        "taps_forward": int(insights.get("taps_forward") or 0),
        "taps_back": int(insights.get("taps_back") or 0),
        "exits": exits,
        "swipe_forward": int(insights.get("swipe_forward") or 0),
        "retencao_pct": retencao_pct,
        "raw_payload": {"story": story, "insights": insights},
    }


def parse_post_hourly_snapshot(
    media_id: str,
    publicado_em: datetime,
    snapshot_em: datetime,
    insights: dict[str, int],
) -> dict[str, Any]:
    horas = max(0, int((snapshot_em - publicado_em).total_seconds() // 3600))
    return {
        "media_id": media_id,
        "snapshot_em": snapshot_em,
        "horas_pos_publicacao": horas,
        "reach": int(insights.get("reach") or 0),
        "views": int(insights.get("views") or 0),
        "likes": int(insights.get("likes") or 0),
        "comments": int(insights.get("comments") or 0),
        "shares": int(insights.get("shares") or 0),
        "saved": int(insights.get("saved") or 0),
        "total_interactions": int(insights.get("total_interactions") or 0),
    }


def parse_post_snapshot(media_id: str, dia: date, insights: dict[str, int]) -> dict[str, Any]:
    return {
        "media_id": media_id,
        "data": dia,
        "reach": int(insights.get("reach") or 0),
        "views": int(insights.get("views") or 0),
        "likes": int(insights.get("likes") or 0),
        "comments": int(insights.get("comments") or 0),
        "shares": int(insights.get("shares") or 0),
        "saved": int(insights.get("saved") or 0),
        "total_interactions": int(insights.get("total_interactions") or 0),
        "profile_visits": int(insights.get("profile_visits") or 0),
        "follows": int(insights.get("follows") or 0),
    }
