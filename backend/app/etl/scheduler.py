"""Scheduler async — jobs recorrentes do sistema (cron Hotmart, futuramente Meta, etc.)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.db import async_session
from app.etl.hotmart_sync import sync_hotmart

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
    sched.start()
    _scheduler = sched
    log.info("Scheduler iniciado com job hotmart_diario (03:00 UTC)")
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
