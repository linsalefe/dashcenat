"""Sync de Instagram orgânico: fetch → parse → upsert idempotente.

Roda a cada 6h via scheduler (últimos 7 dias) e on-demand via POST /meta-instagram/sync.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integracoes import Integracao
from app.models.mkt import (
    InstagramAccountDaily,
    InstagramAudience,
    InstagramPost,
    InstagramPostHashtag,
    InstagramPostHourlySnapshot,
    InstagramPostSnapshot,
    InstagramStory,
)
from app.services.crypto import decrypt_json
from app.services.instagram import (
    InstagramClient,
    InstagramError,
    extract_hashtags,
    parse_account_daily,
    parse_media_payload,
    parse_post_hourly_snapshot,
    parse_post_snapshot,
    parse_story_payload,
)

log = logging.getLogger("instagram_sync")


# ============================================================
# Resolução de credenciais
# ============================================================

async def get_instagram_client(
    db: AsyncSession,
) -> tuple[InstagramClient, dict[str, Any], bool] | None:
    """Retorna (cliente, config, token_compartilhado) ou None se não configurado.

    - Lê integração meta_instagram. Se não tiver token nas creds, tenta reusar
      o do meta_ads (System User com permissões instagram_basic já incluídas).
    """
    res = await db.execute(
        select(Integracao).where(Integracao.servico == "meta_instagram")
    )
    integ = res.scalar_one_or_none()
    if not integ or not integ.ativo:
        return None

    creds = decrypt_json(integ.credentials_cifradas) if integ.credentials_cifradas else {}
    token = creds.get("access_token")
    token_compartilhado = False

    if not token:
        # Fallback: token do meta_ads
        res2 = await db.execute(
            select(Integracao).where(Integracao.servico == "meta_ads")
        )
        meta_ads = res2.scalar_one_or_none()
        if meta_ads and meta_ads.credentials_cifradas:
            ads_creds = decrypt_json(meta_ads.credentials_cifradas)
            token = ads_creds.get("access_token")
            token_compartilhado = bool(token)

    if not token:
        return None

    ig_user_id = creds.get("ig_user_id") or (integ.config_extra or {}).get(
        "ig_user_id"
    )
    if not ig_user_id:
        return None

    config = {
        "ig_user_id": ig_user_id,
        "page_id": creds.get("page_id"),
        "username": (integ.config_extra or {}).get("username"),
    }
    return InstagramClient(access_token=token), config, token_compartilhado


# ============================================================
# Upserts
# ============================================================

async def _upsert_account_daily(db: AsyncSession, dados: dict[str, Any]) -> None:
    stmt = pg_insert(InstagramAccountDaily).values(
        **dados, sincronizado_em=datetime.now(timezone.utc)
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[InstagramAccountDaily.ig_user_id, InstagramAccountDaily.data],
        set_={
            "username": stmt.excluded.username,
            "followers_count": stmt.excluded.followers_count,
            "follows_count": stmt.excluded.follows_count,
            "media_count": stmt.excluded.media_count,
            "reach": stmt.excluded.reach,
            "profile_views": stmt.excluded.profile_views,
            "website_clicks": stmt.excluded.website_clicks,
            "accounts_engaged": stmt.excluded.accounts_engaged,
            "total_interactions": stmt.excluded.total_interactions,
            "likes": stmt.excluded.likes,
            "comments": stmt.excluded.comments,
            "shares": stmt.excluded.shares,
            "saves": stmt.excluded.saves,
            "replies": stmt.excluded.replies,
            "raw_payload": stmt.excluded.raw_payload,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def _upsert_post(db: AsyncSession, dados: dict[str, Any]) -> None:
    stmt = pg_insert(InstagramPost).values(
        **dados,
        ultimo_snapshot_em=datetime.now(timezone.utc),
        sincronizado_em=datetime.now(timezone.utc),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[InstagramPost.media_id],
        set_={
            "media_type": stmt.excluded.media_type,
            "media_product_type": stmt.excluded.media_product_type,
            "caption": stmt.excluded.caption,
            "permalink": stmt.excluded.permalink,
            "thumbnail_url": stmt.excluded.thumbnail_url,
            "media_url": stmt.excluded.media_url,
            "timestamp_publicacao": stmt.excluded.timestamp_publicacao,
            "reach": stmt.excluded.reach,
            "views": stmt.excluded.views,
            "likes": stmt.excluded.likes,
            "comments": stmt.excluded.comments,
            "shares": stmt.excluded.shares,
            "saved": stmt.excluded.saved,
            "total_interactions": stmt.excluded.total_interactions,
            "profile_visits": stmt.excluded.profile_visits,
            "profile_activity": stmt.excluded.profile_activity,
            "follows": stmt.excluded.follows,
            "ig_reels_video_view_total_time": stmt.excluded.ig_reels_video_view_total_time,
            "ig_reels_avg_watch_time": stmt.excluded.ig_reels_avg_watch_time,
            "raw_payload": stmt.excluded.raw_payload,
            "ultimo_snapshot_em": stmt.excluded.ultimo_snapshot_em,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def _upsert_post_snapshot(db: AsyncSession, dados: dict[str, Any]) -> None:
    stmt = pg_insert(InstagramPostSnapshot).values(
        **dados, sincronizado_em=datetime.now(timezone.utc)
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            InstagramPostSnapshot.media_id,
            InstagramPostSnapshot.data,
        ],
        set_={
            "reach": stmt.excluded.reach,
            "views": stmt.excluded.views,
            "likes": stmt.excluded.likes,
            "comments": stmt.excluded.comments,
            "shares": stmt.excluded.shares,
            "saved": stmt.excluded.saved,
            "total_interactions": stmt.excluded.total_interactions,
            "profile_visits": stmt.excluded.profile_visits,
            "follows": stmt.excluded.follows,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def _upsert_story(db: AsyncSession, dados: dict[str, Any]) -> None:
    stmt = pg_insert(InstagramStory).values(
        **dados,
        ultimo_snapshot_em=datetime.now(timezone.utc),
        sincronizado_em=datetime.now(timezone.utc),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[InstagramStory.story_id],
        set_={
            "media_type": stmt.excluded.media_type,
            "thumbnail_url": stmt.excluded.thumbnail_url,
            "media_url": stmt.excluded.media_url,
            "permalink": stmt.excluded.permalink,
            "timestamp_publicacao": stmt.excluded.timestamp_publicacao,
            "reach": stmt.excluded.reach,
            "replies": stmt.excluded.replies,
            "taps_forward": stmt.excluded.taps_forward,
            "taps_back": stmt.excluded.taps_back,
            "exits": stmt.excluded.exits,
            "swipe_forward": stmt.excluded.swipe_forward,
            "retencao_pct": stmt.excluded.retencao_pct,
            "raw_payload": stmt.excluded.raw_payload,
            "ultimo_snapshot_em": stmt.excluded.ultimo_snapshot_em,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def _replace_hashtags(
    db: AsyncSession, media_id: str, hashtags: list[str]
) -> None:
    """Delete + insert idempotente — reflexa estado atual da caption."""
    from sqlalchemy import delete

    await db.execute(
        delete(InstagramPostHashtag).where(InstagramPostHashtag.media_id == media_id)
    )
    if not hashtags:
        return
    now = datetime.now(timezone.utc)
    for posicao, hashtag in enumerate(hashtags):
        stmt = pg_insert(InstagramPostHashtag).values(
            media_id=media_id,
            hashtag=hashtag[:128],
            posicao=posicao,
            sincronizado_em=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[
                InstagramPostHashtag.media_id,
                InstagramPostHashtag.hashtag,
            ],
            set_={
                "posicao": stmt.excluded.posicao,
                "sincronizado_em": stmt.excluded.sincronizado_em,
            },
        )
        await db.execute(stmt)


async def _upsert_hourly_snapshot(
    db: AsyncSession, dados: dict[str, Any]
) -> None:
    stmt = pg_insert(InstagramPostHourlySnapshot).values(**dados)
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            InstagramPostHourlySnapshot.media_id,
            InstagramPostHourlySnapshot.snapshot_em,
        ],
        set_={
            "horas_pos_publicacao": stmt.excluded.horas_pos_publicacao,
            "reach": stmt.excluded.reach,
            "views": stmt.excluded.views,
            "likes": stmt.excluded.likes,
            "comments": stmt.excluded.comments,
            "shares": stmt.excluded.shares,
            "saved": stmt.excluded.saved,
            "total_interactions": stmt.excluded.total_interactions,
        },
    )
    await db.execute(stmt)


async def _upsert_audience(
    db: AsyncSession,
    ig_user_id: str,
    dia: date,
    breakdown: str,
    chave: str,
    valor: int,
) -> None:
    stmt = pg_insert(InstagramAudience).values(
        ig_user_id=ig_user_id,
        data=dia,
        breakdown=breakdown,
        chave=chave,
        valor=valor,
        sincronizado_em=datetime.now(timezone.utc),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            InstagramAudience.ig_user_id,
            InstagramAudience.data,
            InstagramAudience.breakdown,
            InstagramAudience.chave,
        ],
        set_={
            "valor": stmt.excluded.valor,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def _recalcula_follows_gained(db: AsyncSession, ig_user_id: str) -> None:
    """Atualiza follows_gained = followers_count - lag(followers_count) por data."""
    from sqlalchemy import text as sqltext

    await db.execute(
        sqltext(
            """
            WITH diff AS (
              SELECT
                id,
                followers_count - LAG(followers_count) OVER (
                  PARTITION BY ig_user_id ORDER BY data
                ) AS gained
              FROM mkt.instagram_account_daily
              WHERE ig_user_id = :ig_user_id
            )
            UPDATE mkt.instagram_account_daily a
              SET follows_gained = COALESCE(diff.gained, 0)
              FROM diff
              WHERE a.id = diff.id
            """
        ),
        {"ig_user_id": ig_user_id},
    )


# ============================================================
# Orquestração
# ============================================================

async def sync_instagram(
    db: AsyncSession,
    since: date | None = None,
    until: date | None = None,
    full_refresh: bool = False,
) -> dict[str, Any]:
    """Sync end-to-end. Idempotente via UPSERT.

    1. Carrega integração + token (com fallback pro meta_ads token).
    2. Profile + insights diários da conta → instagram_account_daily.
    3. Lista de mídias publicadas no período → instagram_posts.
    4. Pra cada mídia: insights → atualiza post + cria snapshot diário.
    5. Demografia 1x/dia → instagram_audience.
    """
    cliente_info = await get_instagram_client(db)
    if not cliente_info:
        return {
            "ok": False,
            "posts_processados": 0,
            "snapshots_criados": 0,
            "dias_conta_processados": 0,
            "audience_atualizada": False,
            "erro": "Instagram não configurado, inativo ou sem ig_user_id",
            "range": {},
        }
    client, config, _token_compartilhado = cliente_info
    ig_user_id = config["ig_user_id"]

    if not until:
        until = date.today()
    if not since:
        # full_refresh: 90 dias; senão últimos 7 dias
        since = until - timedelta(days=90 if full_refresh else 7)

    posts_processados = 0
    snapshots_criados = 0
    dias_conta_processados = 0
    audience_atualizada = False
    erros: list[str] = []

    try:
        # 1) Profile + account insights
        profile = await client.fetch_account_profile(ig_user_id)
        insights_por_dia = await client.fetch_account_insights(
            ig_user_id, since, until
        )

        # Persistir username em config_extra pra UI mostrar mesmo sem novo sync
        try:
            await db.execute(
                update(Integracao)
                .where(Integracao.servico == "meta_instagram")
                .values(
                    config_extra={
                        "username": profile.get("username"),
                        "ig_user_id": ig_user_id,
                        "biography": profile.get("biography"),
                        "website": profile.get("website"),
                        "profile_picture_url": profile.get("profile_picture_url"),
                    }
                )
            )
        except Exception as e:
            log.warning("config_extra update falhou: %s", e)

        cursor = since
        while cursor <= until:
            dia = cursor
            cursor += timedelta(days=1)
            try:
                async with db.begin_nested():
                    dados = parse_account_daily(
                        ig_user_id, profile, insights_por_dia, dia, raw_payload=None
                    )
                    await _upsert_account_daily(db, dados)
                dias_conta_processados += 1
            except Exception as e:
                erros.append(f"account_daily {dia.isoformat()}: {str(e)[:120]}")
                log.warning("falha em account_daily %s: %s", dia.isoformat(), e)

        await db.commit()
        await _recalcula_follows_gained(db, ig_user_id)
        await db.commit()

        # 2) Mídias
        media_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
        # Se não for full_refresh e tiver posts já gravados, busca só os últimos 14 dias
        if not full_refresh:
            media_since = datetime.now(timezone.utc) - timedelta(days=14)
        medias = await client.fetch_media_list(ig_user_id, since=media_since)
        log.info("Encontradas %s mídias pra processar", len(medias))

        agora = datetime.now(timezone.utc)
        for media in medias:
            media_id = str(media.get("id") or "")
            if not media_id:
                continue
            try:
                insights = await client.fetch_media_insights(
                    media_id,
                    media.get("media_type") or "",
                    media.get("media_product_type"),
                )
                async with db.begin_nested():
                    dados = parse_media_payload(ig_user_id, media, insights)
                    await _upsert_post(db, dados)
                    snap = parse_post_snapshot(media_id, date.today(), insights)
                    await _upsert_post_snapshot(db, snap)
                    # Hashtags extraídas da caption
                    hashtags = extract_hashtags(media.get("caption"))
                    await _replace_hashtags(db, media_id, hashtags)
                    # Hourly snapshot — só pra posts <= 14 dias (curva de viralização)
                    publicado_em = dados["timestamp_publicacao"]
                    if isinstance(publicado_em, datetime) and (
                        (agora - publicado_em).total_seconds() < 14 * 86400
                    ):
                        hourly = parse_post_hourly_snapshot(
                            media_id, publicado_em, agora, insights
                        )
                        await _upsert_hourly_snapshot(db, hourly)
                posts_processados += 1
                snapshots_criados += 1
            except Exception as e:
                erros.append(f"media {media_id}: {str(e)[:120]}")
                log.warning("falha ao processar media %s: %s", media_id, e)
            await asyncio.sleep(0.2)  # rate limit

        await db.commit()

        # 2b) Stories ativos (expiram em 24h)
        try:
            stories = await client.fetch_active_stories(ig_user_id)
            log.info("Encontrados %s stories ativos", len(stories))
            for story in stories:
                sid = str(story.get("id") or "")
                if not sid:
                    continue
                try:
                    async with db.begin_nested():
                        story_insights = await client.fetch_story_insights(sid)
                        dados_story = parse_story_payload(
                            ig_user_id, story, story_insights
                        )
                        await _upsert_story(db, dados_story)
                except Exception as e:
                    erros.append(f"story {sid}: {str(e)[:120]}")
                    log.warning("falha em story %s: %s", sid, e)
                await asyncio.sleep(0.15)
            await db.commit()
        except Exception as e:
            erros.append(f"stories list: {str(e)[:120]}")
            log.warning("falha em listar stories: %s", e)

        # 3) Demografia — só uma vez por dia
        hoje = date.today()
        from sqlalchemy import func as sqlfunc

        r_aud = await db.execute(
            select(sqlfunc.count())
            .select_from(InstagramAudience)
            .where(
                InstagramAudience.ig_user_id == ig_user_id,
                InstagramAudience.data == hoje,
            )
        )
        ja_tem_hoje = (r_aud.scalar_one() or 0) > 0

        if not ja_tem_hoje:
            try:
                demo = await client.fetch_audience_demographics(ig_user_id)
            except Exception as e:
                demo = {}
                erros.append(f"audience: {str(e)[:120]}")
                log.warning("falha em audience: %s", e)

            for breakdown, items in (demo or {}).items():
                try:
                    async with db.begin_nested():
                        for chave, valor in items:
                            await _upsert_audience(
                                db, ig_user_id, hoje, breakdown, chave, valor
                            )
                    audience_atualizada = True
                except Exception as e:
                    erros.append(f"audience {breakdown}: {str(e)[:120]}")
                    log.warning("falha em audience %s: %s", breakdown, e)

            await db.commit()

        # 4) Atualiza integração
        status = "ok" if not erros else ("parcial" if posts_processados > 0 else "erro")
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "meta_instagram")
            .values(
                ultimo_sync=datetime.now(timezone.utc),
                ultimo_sync_status=status,
                ultimo_sync_erro=("; ".join(erros)[:500] if erros else None),
                ultimo_sync_total=posts_processados,
            )
        )
        await db.commit()

        return {
            "ok": status != "erro",
            "posts_processados": posts_processados,
            "snapshots_criados": snapshots_criados,
            "dias_conta_processados": dias_conta_processados,
            "audience_atualizada": audience_atualizada,
            "erro": "; ".join(erros) if erros else None,
            "range": {"since": since.isoformat(), "until": until.isoformat()},
        }

    except InstagramError as e:
        await db.rollback()
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "meta_instagram")
            .values(
                ultimo_sync=datetime.now(timezone.utc),
                ultimo_sync_status="erro",
                ultimo_sync_erro=str(e)[:500],
            )
        )
        await db.commit()
        return {
            "ok": False,
            "posts_processados": posts_processados,
            "snapshots_criados": snapshots_criados,
            "dias_conta_processados": dias_conta_processados,
            "audience_atualizada": audience_atualizada,
            "erro": str(e),
            "range": {
                "since": (since.isoformat() if since else ""),
                "until": (until.isoformat() if until else ""),
            },
        }


async def sync_instagram_recente(db: AsyncSession) -> dict[str, Any]:
    """Wrapper pra scheduler: últimos 7 dias, full_refresh=False."""
    until = date.today()
    since = until - timedelta(days=7)
    return await sync_instagram(db, since=since, until=until, full_refresh=False)


async def sync_instagram_inicial(db: AsyncSession) -> dict[str, Any]:
    """Sync inicial pós-config: 90 dias + full_refresh=True."""
    until = date.today()
    since = until - timedelta(days=90)
    return await sync_instagram(db, since=since, until=until, full_refresh=True)


async def sync_instagram_stories_only(db: AsyncSession) -> dict[str, Any]:
    """Sync rápido — só stories ativos. Pra job de 2h."""
    cliente_info = await get_instagram_client(db)
    if not cliente_info:
        return {"ok": False, "stories_processados": 0, "erro": "não configurado"}

    client, config, _ = cliente_info
    ig_user_id = config["ig_user_id"]
    processados = 0
    erros: list[str] = []

    try:
        stories = await client.fetch_active_stories(ig_user_id)
    except Exception as e:
        log.warning("falha em listar stories: %s", e)
        return {
            "ok": False,
            "stories_processados": 0,
            "erro": f"listar: {str(e)[:120]}",
        }

    for story in stories:
        sid = str(story.get("id") or "")
        if not sid:
            continue
        try:
            async with db.begin_nested():
                story_insights = await client.fetch_story_insights(sid)
                dados = parse_story_payload(ig_user_id, story, story_insights)
                await _upsert_story(db, dados)
            processados += 1
        except Exception as e:
            erros.append(f"{sid}: {str(e)[:80]}")
            log.warning("falha story %s: %s", sid, e)
        await asyncio.sleep(0.15)

    await db.commit()
    return {
        "ok": True,
        "stories_processados": processados,
        "erro": ("; ".join(erros)[:300] if erros else None),
    }
