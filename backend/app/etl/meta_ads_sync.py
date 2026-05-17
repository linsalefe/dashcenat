"""Sync de insights da Meta Ads: fetch → parse → upsert idempotente em mkt.meta_ads_insights.

Roda hourly via scheduler (últimos 7 dias) e on-demand via POST /meta-ads/sync.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integracoes import Integracao
from app.models.mkt import MetaAdsInsight, MetaCustomConversion
from app.services.crypto import decrypt_json
from app.services.meta_ads import (
    MetaAdsClient,
    MetaAdsError,
    parse_insight_row,
)

log = logging.getLogger("meta_ads_sync")


async def get_meta_ads_client(
    db: AsyncSession,
) -> tuple[MetaAdsClient, list[str]] | None:
    """Retorna (cliente, lista_de_account_ids) ou None se não configurado."""
    res = await db.execute(select(Integracao).where(Integracao.servico == "meta_ads"))
    integ = res.scalar_one_or_none()
    if not integ or not integ.ativo or not integ.credentials_cifradas:
        return None
    creds = decrypt_json(integ.credentials_cifradas)
    token = creds.get("access_token")
    accounts = creds.get("ad_account_ids") or []
    if not token or not accounts:
        return None
    return MetaAdsClient(access_token=token), list(accounts)


async def sync_meta_ads(
    db: AsyncSession,
    since: date | None = None,
    until: date | None = None,
) -> dict[str, Any]:
    """Sincroniza Meta Ads no período. Idempotente via UPSERT.

    1. Carrega Integracao + decifra credentials.
    2. Pra cada ad_account: sync custom_conversions, campaigns meta, insights.
    3. Upsert linha-a-linha em mkt.meta_ads_insights.
    4. Atualiza Integracao.ultimo_sync + config_extra com token_expires_at.
    5. Erros são capturados e salvos em ultimo_sync_erro (não levantam).
    """
    cliente_info = await get_meta_ads_client(db)
    if not cliente_info:
        return {
            "ok": False,
            "total_linhas": 0,
            "contas_processadas": 0,
            "erro": "Meta Ads não configurado ou inativo",
            "range": {},
        }
    client, accounts = cliente_info

    # Defaults: últimos 7 dias
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=7)

    total_linhas = 0
    contas_ok = 0
    erros: list[str] = []

    try:
        for account_id in accounts:
            try:
                # 1) Custom conversions (lookup map pra parser)
                convs = await client.fetch_custom_conversions(account_id)
                custom_conv_map: dict[str, dict[str, Any]] = {}
                for c in convs:
                    cid = str(c.get("id") or "")
                    if not cid:
                        continue
                    custom_conv_map[cid] = c
                    await _upsert_custom_conversion(
                        db,
                        {
                            "custom_conversion_id": cid,
                            "ad_account_id": account_id,
                            "nome": c.get("name") or f"custom_{cid}",
                            "descricao": c.get("description"),
                            "custom_event_type": c.get("custom_event_type"),
                            "ativo": True,
                            "sincronizado_em": datetime.now(timezone.utc),
                        },
                    )

                # 2) Campaign metadata (objective/status pra enriquecer insights)
                campaign_meta = await client.fetch_campaigns_meta(account_id)

                # 3) Insights diários
                rows = await client.fetch_insights(account_id, since, until)
                for raw in rows:
                    parsed = parse_insight_row(
                        raw, custom_conv_map, account_id, campaign_meta
                    )
                    if not parsed.get("data") or not parsed.get("campaign_id"):
                        continue
                    await _upsert_insight(db, parsed)
                    total_linhas += 1

                contas_ok += 1
                # commit por conta — se uma falhar a outra fica salva
                await db.commit()

            except Exception as e:
                await db.rollback()
                erros.append(f"[{account_id}] {str(e)[:200]}")
                log.exception("Meta Ads sync falhou na conta %s", account_id)

        # 4) Atualiza token info no config_extra (best-effort)
        token_info: dict[str, Any] = {}
        try:
            token_info = await client.fetch_token_info()
        except Exception as e:
            log.warning("debug_token falhou (não-crítico): %s", e)

        # 5) Atualiza Integracao
        res = await db.execute(
            select(Integracao).where(Integracao.servico == "meta_ads")
        )
        integ = res.scalar_one()
        config_extra = dict(integ.config_extra or {})
        if token_info.get("expires_at") is not None:
            # epoch seconds; 0 = never expires
            exp = int(token_info["expires_at"])
            config_extra["token_expires_at"] = (
                datetime.fromtimestamp(exp, tz=timezone.utc).isoformat() if exp > 0 else None
            )
            config_extra["token_never_expires"] = exp == 0
        if token_info.get("scopes"):
            config_extra["scopes"] = token_info["scopes"]

        status = "ok" if not erros else ("parcial" if contas_ok > 0 else "erro")
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "meta_ads")
            .values(
                ultimo_sync=datetime.now(timezone.utc),
                ultimo_sync_status=status,
                ultimo_sync_erro=("; ".join(erros)[:500] if erros else None),
                ultimo_sync_total=total_linhas,
                config_extra=config_extra,
            )
        )
        await db.commit()

        return {
            "ok": status != "erro",
            "total_linhas": total_linhas,
            "contas_processadas": contas_ok,
            "erro": "; ".join(erros) if erros else None,
            "range": {"since": since.isoformat(), "until": until.isoformat()},
        }

    except MetaAdsError as e:
        await db.rollback()
        # salva erro mas não relança
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "meta_ads")
            .values(
                ultimo_sync=datetime.now(timezone.utc),
                ultimo_sync_status="erro",
                ultimo_sync_erro=str(e)[:500],
            )
        )
        await db.commit()
        return {
            "ok": False,
            "total_linhas": total_linhas,
            "contas_processadas": contas_ok,
            "erro": str(e),
            "range": {"since": since.isoformat(), "until": until.isoformat()},
        }


async def _upsert_insight(db: AsyncSession, dados: dict[str, Any]) -> None:
    """UPSERT por (data, ad_account_id, campaign_id, adset_id, ad_id).

    adset_id e ad_id são NOT NULL DEFAULT '' no banco — `parse_insight_row` já
    normaliza None → '', então o índice UNIQUE bate direto sem COALESCE.
    """
    stmt = pg_insert(MetaAdsInsight).values(**dados, sincronizado_em=datetime.now(timezone.utc))
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            MetaAdsInsight.data,
            MetaAdsInsight.ad_account_id,
            MetaAdsInsight.campaign_id,
            MetaAdsInsight.adset_id,
            MetaAdsInsight.ad_id,
        ],
        set_={
            "campaign_name": stmt.excluded.campaign_name,
            "objetivo": stmt.excluded.objetivo,
            "status": stmt.excluded.status,
            "adset_name": stmt.excluded.adset_name,
            "ad_name": stmt.excluded.ad_name,
            "spend": stmt.excluded.spend,
            "reach": stmt.excluded.reach,
            "impressions": stmt.excluded.impressions,
            "clicks": stmt.excluded.clicks,
            "ctr": stmt.excluded.ctr,
            "cpc": stmt.excluded.cpc,
            "cpm": stmt.excluded.cpm,
            "frequency": stmt.excluded.frequency,
            "landing_page_views": stmt.excluded.landing_page_views,
            "initiate_checkout": stmt.excluded.initiate_checkout,
            "purchases": stmt.excluded.purchases,
            "purchase_value": stmt.excluded.purchase_value,
            "complete_registration": stmt.excluded.complete_registration,
            "custom_conversions": stmt.excluded.custom_conversions,
            "custom_conversions_total": stmt.excluded.custom_conversions_total,
            "utm_campaign_inferido": stmt.excluded.utm_campaign_inferido,
            "raw_payload": stmt.excluded.raw_payload,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def _upsert_custom_conversion(db: AsyncSession, dados: dict[str, Any]) -> None:
    """UPSERT por (custom_conversion_id, ad_account_id)."""
    stmt = pg_insert(MetaCustomConversion).values(**dados)
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            MetaCustomConversion.custom_conversion_id,
            MetaCustomConversion.ad_account_id,
        ],
        set_={
            "nome": stmt.excluded.nome,
            "descricao": stmt.excluded.descricao,
            "custom_event_type": stmt.excluded.custom_event_type,
            "ativo": stmt.excluded.ativo,
            "sincronizado_em": stmt.excluded.sincronizado_em,
        },
    )
    await db.execute(stmt)


async def sync_meta_ads_recente(db: AsyncSession) -> dict[str, Any]:
    """Wrapper pra scheduler: sincroniza últimos 7 dias até hoje."""
    until = date.today()
    since = until - timedelta(days=7)
    return await sync_meta_ads(db, since=since, until=until)
