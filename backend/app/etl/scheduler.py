"""Scheduler async — jobs recorrentes do sistema (Hotmart diário, Meta Ads horário)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.db import async_session
from app.etl.doity_sync import sync_doity_todos
from app.etl.exact_sales_sync import sync_exact_sales_incremental
from app.etl.hotmart_sync import sync_hotmart
from app.etl.instagram_sync import (
    sync_instagram_recente,
    sync_instagram_stories_only,
)
from app.etl.meta_ads_sync import sync_meta_ads_recente
from app.etl.monday_discovery import descobrir_boards
from app.etl.monday_sync import sync_todos as sync_monday_todos

log = logging.getLogger("scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _job_hotmart_diario():
    """Roda às 03:00 UTC. Sincroniza vendas dos últimos 3 dias (margem pra reembolsos/atrasos)."""
    log.info("Job hotmart_diario iniciando")
    async with async_session() as db:
        try:
            res = await sync_hotmart(
                db,
                start_date=datetime.utcnow() - timedelta(days=3),
                end_date=datetime.utcnow(),
            )
            log.info("Job hotmart_diario ok: %s", res)
        except Exception as e:
            log.exception("Job hotmart_diario falhou: %s", e)


async def _job_meta_ads_horario():
    """Roda a cada 1h. Sincroniza últimos 7 dias da Meta Ads."""
    log.info("Job meta_ads_horario iniciando")
    async with async_session() as db:
        try:
            res = await sync_meta_ads_recente(db)
            log.info("Job meta_ads_horario ok: %s", res)
        except Exception as e:
            log.exception("Job meta_ads_horario falhou: %s", e)


async def _job_instagram_6h():
    """Roda a cada 6h. Sincroniza últimos 7 dias do Instagram orgânico."""
    log.info("Job instagram_6h iniciando")
    async with async_session() as db:
        try:
            res = await sync_instagram_recente(db)
            log.info("Job instagram_6h ok: %s", res)
        except Exception as e:
            log.exception("Job instagram_6h falhou: %s", e)


async def _job_instagram_stories_2h():
    """Roda a cada 2h. Só stories ativos (expiram em 24h)."""
    log.info("Job instagram_stories_2h iniciando")
    async with async_session() as db:
        try:
            res = await sync_instagram_stories_only(db)
            log.info("Job instagram_stories_2h ok: %s", res)
        except Exception as e:
            log.exception("Job instagram_stories_2h falhou: %s", e)


async def _job_doity_diario():
    """Roda às 04:00 UTC (01:00 BRT). Sincroniza incremental por cursor (rodadas de
    até 8 págs). Como uso é incremental, 1×/dia basta pra análise; pode subir a
    frequência se quiser acompanhamento intradiário.
    """
    log.info("Job doity_diario iniciando")
    async with async_session() as db:
        try:
            res = await sync_doity_todos(db)
            log.info("Job doity_diario ok: %s", res)
        except Exception as e:
            log.exception("Job doity_diario falhou: %s", e)


async def _job_exact_sales_1h():
    """Roda a cada 1h. Sincroniza incremental do Exact Spotter."""
    log.info("Job exact_sales_1h iniciando")
    async with async_session() as db:
        try:
            res = await sync_exact_sales_incremental(db)
            log.info("Job exact_sales_1h ok: %s", res)
        except Exception as e:
            log.exception("Job exact_sales_1h falhou: %s", e)


async def _job_monday_descoberta_diaria():
    """Roda às 05:00 UTC (02:00 BRT). Redescobre boards (zero-config): board novo
    entra sozinho, board sumido vira ativo=false. Não toca em overrides/incluido."""
    log.info("Job monday_descoberta_diaria iniciando")
    async with async_session() as db:
        try:
            res = await descobrir_boards(db)
            log.info("Job monday_descoberta_diaria ok: %s", res)
        except Exception as e:
            log.exception("Job monday_descoberta_diaria falhou: %s", e)


async def _job_monday_sync_2h():
    """Roda a cada 2h. Sincroniza itens dos boards incluído=true, em série."""
    log.info("Job monday_sync_2h iniciando")
    async with async_session() as db:
        try:
            res = await sync_monday_todos(db)
            log.info(
                "Job monday_sync_2h ok: boards=%s ok=%s erro=%s itens=%s",
                res.get("boards"), res.get("boards_ok"), res.get("boards_erro"),
                res.get("total_itens"),
            )
        except Exception as e:
            log.exception("Job monday_sync_2h falhou: %s", e)


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        _job_hotmart_diario,
        trigger=CronTrigger(hour=3, minute=0),  # 03:00 UTC = 00:00 BRT
        id="hotmart_diario",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    sched.add_job(
        _job_meta_ads_horario,
        trigger="interval",
        hours=1,
        id="meta_ads_horario",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc) + timedelta(minutes=5),
        misfire_grace_time=900,
    )
    sched.add_job(
        _job_instagram_6h,
        trigger="interval",
        hours=6,
        id="instagram_6h",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc) + timedelta(minutes=10),
        misfire_grace_time=1800,
    )
    sched.add_job(
        _job_instagram_stories_2h,
        trigger="interval",
        hours=2,
        id="instagram_stories_2h",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc) + timedelta(minutes=15),
        misfire_grace_time=600,
    )
    sched.add_job(
        _job_exact_sales_1h,
        trigger="interval",
        hours=1,
        id="exact_sales_1h",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc) + timedelta(minutes=10),
        misfire_grace_time=1800,
    )
    sched.add_job(
        _job_doity_diario,
        trigger=CronTrigger(hour=4, minute=0),  # 04:00 UTC = 01:00 BRT
        id="doity_diario",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    sched.add_job(
        _job_monday_descoberta_diaria,
        trigger=CronTrigger(hour=5, minute=0),  # 05:00 UTC = 02:00 BRT
        id="monday_descoberta_diaria",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    sched.add_job(
        _job_monday_sync_2h,
        trigger="interval",
        hours=2,
        id="monday_sync_2h",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc) + timedelta(minutes=20),
        misfire_grace_time=1800,
    )
    sched.start()
    _scheduler = sched
    log.info(
        "Scheduler iniciado: hotmart_diario (03:00 UTC) + meta_ads_horario (1h) "
        "+ instagram_6h (6h) + instagram_stories_2h (2h) + exact_sales_1h (1h) "
        "+ doity_diario (04:00 UTC) + monday_descoberta_diaria (05:00 UTC) "
        "+ monday_sync_2h (2h)"
    )
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
