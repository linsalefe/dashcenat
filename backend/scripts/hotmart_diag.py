"""
Diagnóstico Hotmart — compara API direta vs mkt.vendas_hotmart.

Rode no servidor:
    cd /caminho/do/backend
    source .venv/bin/activate
    python -m scripts.hotmart_diag

Saída: relatório de contagens (não imprime dados sensíveis dos compradores).
"""
import asyncio
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session
from app.etl.hotmart_sync import get_hotmart_client
from app.models.mkt import VendaHotmart
from app.services.hotmart import HOTMART_SALES_URL

import httpx


DIAS = 30
STATUSES_TESTAR = ["APPROVED", "COMPLETE", "REFUNDED", "CHARGEBACK", "CANCELED", "DISPUTE"]


def fmt(v):
    return f"R$ {float(v):>12,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def fetch_status(client, start, end, status):
    """Conta vendas e soma por status, sem persistir nada."""
    token = await client._ensure_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "start_date": int(start.timestamp() * 1000),
        "end_date": int(end.timestamp() * 1000),
        "transaction_status": status,
        "max_results": 100,
    }
    total = 0
    receita = Decimal(0)
    receita_liq = Decimal(0)
    por_papel = Counter()
    page_token = None
    paginas = 0

    async with httpx.AsyncClient(timeout=60) as http:
        while True:
            q = dict(params)
            if page_token:
                q["page_token"] = page_token
            r = await http.get(HOTMART_SALES_URL, params=q, headers=headers)
            if r.status_code != 200:
                print(f"  [{status}] HTTP {r.status_code}: {r.text[:200]}")
                return None
            payload = r.json()
            for item in payload.get("items", []):
                total += 1
                purchase = item.get("purchase") or {}
                price = purchase.get("price") or {}
                full = purchase.get("full_price") or {}
                receita += Decimal(str(price.get("value") or 0))
                receita_liq += Decimal(str(full.get("value") or price.get("value") or 0))
                papel = item.get("commission_as") or "?"
                por_papel[papel] += 1
            paginas += 1
            page_info = payload.get("page_info") or {}
            page_token = page_info.get("next_page_token")
            if not page_token or paginas > 50:
                break
    return {
        "count": total,
        "receita": receita,
        "receita_liq": receita_liq,
        "papel": dict(por_papel),
        "paginas": paginas,
    }


async def main():
    end = datetime.utcnow()
    start = end - timedelta(days=DIAS)

    print("=" * 70)
    print(f"DIAGNÓSTICO HOTMART — últimos {DIAS} dias")
    print(f"start={start.isoformat()}  end={end.isoformat()}")
    print("=" * 70)

    async with async_session() as db:
        # 1. Banco local
        print("\n[1] mkt.vendas_hotmart (BANCO LOCAL)")
        q = select(
            VendaHotmart.status,
            func.count().label("c"),
            func.sum(VendaHotmart.preco_total).label("rb"),
            func.sum(VendaHotmart.faturamento_liquido).label("rl"),
        ).where(VendaHotmart.data_venda >= start).group_by(VendaHotmart.status)
        r = await db.execute(q)
        rows = r.all()
        for row in rows:
            print(f"  status={row.status:<12} count={row.c:>4}  bruto={fmt(row.rb or 0):>16}  liq={fmt(row.rl or 0):>16}")
        tot = await db.execute(
            select(
                func.count(),
                func.sum(VendaHotmart.preco_total),
                func.sum(VendaHotmart.faturamento_liquido),
            ).where(VendaHotmart.data_venda >= start)
        )
        tr = tot.one()
        print(f"  {'TOTAL':<19} count={tr[0]:>4}  bruto={fmt(tr[1] or 0):>16}  liq={fmt(tr[2] or 0):>16}")

        # 2. API Hotmart por status
        client = await get_hotmart_client(db)
        if not client:
            print("\n[ERRO] Hotmart não configurado no banco")
            return

        print("\n[2] API Hotmart sales/history — por status (TODOS os papéis)")
        total_api = 0
        total_api_receita_liq = Decimal(0)
        for st in STATUSES_TESTAR:
            res = await fetch_status(client, start, end, st)
            if res is None:
                continue
            if res["count"] == 0:
                print(f"  status={st:<12} count={0:>4}")
                continue
            print(
                f"  status={st:<12} count={res['count']:>4}  "
                f"bruto={fmt(res['receita']):>16}  liq={fmt(res['receita_liq']):>16}  "
                f"papel={res['papel']}  paginas={res['paginas']}"
            )
            total_api += res["count"]
            total_api_receita_liq += res["receita_liq"]
        print(f"  {'TOTAL API':<19} count={total_api:>4}  liq={fmt(total_api_receita_liq):>16}")

        # 3. Diferença
        print("\n[3] DIFERENÇA (API - BANCO)")
        diff_count = total_api - (tr[0] or 0)
        diff_liq = total_api_receita_liq - Decimal(tr[2] or 0)
        print(f"  count: {diff_count:+d}")
        print(f"  liq:   {fmt(diff_liq)}")

        # 4. Quebra por dia (só APPROVED) — pra ver se algum dia tá faltando
        print("\n[4] Por dia (APPROVED) — banco vs API")
        # banco
        q_dia = (
            select(
                func.date_trunc("day", VendaHotmart.data_venda).label("d"),
                func.count().label("c"),
            )
            .where(VendaHotmart.data_venda >= start, VendaHotmart.status == "APPROVED")
            .group_by(func.date_trunc("day", VendaHotmart.data_venda))
            .order_by(func.date_trunc("day", VendaHotmart.data_venda))
        )
        r_dia = await db.execute(q_dia)
        banco_dia = {row.d.date().isoformat(): row.c for row in r_dia.all()}

        # api
        token = await client._ensure_token()
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "start_date": int(start.timestamp() * 1000),
            "end_date": int(end.timestamp() * 1000),
            "transaction_status": "APPROVED",
            "max_results": 100,
        }
        api_dia = defaultdict(int)
        page_token = None
        paginas = 0
        async with httpx.AsyncClient(timeout=60) as http:
            while True:
                q = dict(params)
                if page_token:
                    q["page_token"] = page_token
                r = await http.get(HOTMART_SALES_URL, params=q, headers=headers)
                payload = r.json()
                for item in payload.get("items", []):
                    purchase = item.get("purchase") or {}
                    od = purchase.get("order_date")
                    if od:
                        dia = datetime.utcfromtimestamp(int(od) / 1000).date().isoformat()
                        api_dia[dia] += 1
                paginas += 1
                page_info = payload.get("page_info") or {}
                page_token = page_info.get("next_page_token")
                if not page_token or paginas > 50:
                    break

        todos_dias = sorted(set(list(banco_dia.keys()) + list(api_dia.keys())))
        print(f"  {'dia':<12} {'banco':>6} {'api':>6} {'diff':>6}")
        for d in todos_dias:
            b = banco_dia.get(d, 0)
            a = api_dia.get(d, 0)
            print(f"  {d:<12} {b:>6} {a:>6} {a - b:>+6}")

        print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
