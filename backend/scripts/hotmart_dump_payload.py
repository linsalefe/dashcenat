"""
Imprime 1 payload cru da API Hotmart pra inspeção dos campos disponíveis.
Mascara dados sensíveis (nome, email, doc, endereço, telefone) antes de imprimir.

Rodar:
    python -m scripts.hotmart_dump_payload
"""
import asyncio
import json
from datetime import datetime, timedelta

import httpx

from app.core.db import async_session
from app.etl.hotmart_sync import get_hotmart_client
from app.services.hotmart import HOTMART_SALES_URL


SENSITIVE_KEYS = {
    "name", "email", "document", "phone", "address", "street", "complement",
    "city", "neighborhood", "ddd", "zipcode", "checkout_phone", "checkout_country_code",
    "doc", "cpf", "cnpj", "first_name", "last_name",
}


def mascarar(obj):
    if isinstance(obj, dict):
        return {
            k: (
                "***MASKED***"
                if k.lower() in SENSITIVE_KEYS
                else mascarar(v)
            )
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [mascarar(x) for x in obj]
    return obj


async def main():
    end = datetime.utcnow()
    start = end - timedelta(days=7)

    async with async_session() as db:
        client = await get_hotmart_client(db)
        if not client:
            print("Hotmart não configurado")
            return

        token = await client._ensure_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Pega 1 página
        for status in ("APPROVED", "COMPLETE"):
            params = {
                "start_date": int(start.timestamp() * 1000),
                "end_date": int(end.timestamp() * 1000),
                "transaction_status": status,
                "max_results": 2,
            }
            async with httpx.AsyncClient(timeout=30) as http:
                r = await http.get(HOTMART_SALES_URL, params=params, headers=headers)
            if r.status_code != 200:
                print(f"[{status}] HTTP {r.status_code}: {r.text[:200]}")
                continue
            payload = r.json()
            items = payload.get("items", [])
            if not items:
                print(f"[{status}] sem itens")
                continue
            print(f"\n{'=' * 70}")
            print(f"PAYLOAD CRU — status={status} — 1 venda (mascarada)")
            print("=" * 70)
            print(json.dumps(mascarar(items[0]), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
