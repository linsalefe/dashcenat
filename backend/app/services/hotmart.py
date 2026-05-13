"""Cliente Hotmart — OAuth client_credentials, paginação de sales/history, validação de webhook."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import httpx

HOTMART_OAUTH_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token"
HOTMART_SALES_URL = "https://developers.hotmart.com/payments/api/v1/sales/history"

# Token vale ~24h, mas renovamos com 5 min de antecedência
TOKEN_MARGIN_SEC = 300


class HotmartError(Exception):
    pass


class HotmartClient:
    """
    Uso:
        client = HotmartClient(client_id, client_secret, basic_token)
        async for sale in client.fetch_sales(start_date, end_date):
            ...
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        basic_token: str | None = None,
        timeout: float = 30.0,
    ):
        if not client_id or not client_secret:
            raise HotmartError("Hotmart: client_id e client_secret são obrigatórios")
        self.client_id = client_id
        self.client_secret = client_secret
        self.basic_token = basic_token
        self.timeout = timeout

        self._access_token: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    async def _ensure_token(self) -> str:
        async with self._lock:
            now = time.time()
            if self._access_token and now < self._expires_at - TOKEN_MARGIN_SEC:
                return self._access_token

            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            if self.basic_token:
                headers["Authorization"] = f"Basic {self.basic_token}"

            data = {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
            async with httpx.AsyncClient(timeout=self.timeout) as http:
                r = await http.post(HOTMART_OAUTH_URL, data=data, headers=headers)
            if r.status_code != 200:
                raise HotmartError(f"Hotmart OAuth falhou ({r.status_code}): {r.text[:300]}")
            payload = r.json()
            self._access_token = payload["access_token"]
            expires_in = int(payload.get("expires_in", 3600))
            self._expires_at = now + expires_in
            return self._access_token  # type: ignore[return-value]

    async def fetch_sales(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        transaction_status: str = "APPROVED",
        max_pages: int = 50,
    ) -> AsyncIterator[dict[str, Any]]:
        """Itera sobre todas as vendas no período, paginadas (50 por página)."""
        token = await self._ensure_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        params: dict[str, Any] = {
            "transaction_status": transaction_status,
            "max_results": 50,
        }
        if start_date:
            params["start_date"] = int(start_date.timestamp() * 1000)
        if end_date:
            params["end_date"] = int(end_date.timestamp() * 1000)

        page_token: str | None = None
        pages = 0

        async with httpx.AsyncClient(timeout=self.timeout) as http:
            while True:
                pages += 1
                if pages > max_pages:
                    break
                q = dict(params)
                if page_token:
                    q["page_token"] = page_token
                r = await http.get(HOTMART_SALES_URL, params=q, headers=headers)
                if r.status_code == 401:
                    # token expirou — renova e refaz
                    token = await self._ensure_token()
                    headers["Authorization"] = f"Bearer {token}"
                    continue
                if r.status_code != 200:
                    raise HotmartError(
                        f"Hotmart sales falhou ({r.status_code}): {r.text[:400]}"
                    )
                payload = r.json()
                for item in payload.get("items", []):
                    yield item

                page_info = payload.get("page_info") or {}
                next_token = page_info.get("next_page_token")
                if not next_token:
                    break
                page_token = next_token


# ============================================================
# Webhook
# ============================================================

def validar_webhook(header_hottok: str | None, expected_hottok: str | None) -> bool:
    """O Hotmart envia o `hottok` configurado quando você habilita o webhook.

    Pode vir no header X-Hotmart-Hottok ou no body. Validação simples por igualdade.
    """
    if not expected_hottok:
        return False
    return (header_hottok or "").strip() == expected_hottok.strip()


# ============================================================
# Mapping de payload Hotmart → VendaHotmart
# ============================================================

def _ms_to_dt(ms: Any) -> datetime | None:
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def parse_sale(item: dict[str, Any]) -> dict[str, Any]:
    """Converte 1 item de sales/history (ou webhook) num dict pronto pra inserir no banco."""
    purchase = item.get("purchase") or {}
    product = item.get("product") or {}
    buyer = item.get("buyer") or {}
    address = buyer.get("address") or {}
    price = purchase.get("price") or {}
    payment = purchase.get("payment") or {}
    producer = item.get("producer") or {}
    affiliate = item.get("affiliate") or {}
    tracking = purchase.get("tracking") or {}
    offer = purchase.get("offer") or {}
    hotmart_fee = purchase.get("hotmart_fee") or {}

    transacao = purchase.get("transaction") or item.get("transaction") or ""

    # tenta extrair UTMs do tracking.source quando vier no formato "utm_source|utm_medium|utm_campaign"
    src = tracking.get("source") or tracking.get("source_sck") or ""
    utm_source, utm_medium, utm_campaign = _parse_tracking_source(src)

    preco_total = float(price.get("value") or 0)
    taxa = float(hotmart_fee.get("total") or 0)
    # líquido = bruto - taxa da Hotmart. Quando full_price existe (vendas de ordem
    # de parcelas) usa ele como bruto pro cálculo.
    bruto_pro_calc = float(
        (purchase.get("full_price") or price).get("value") or price.get("value") or 0
    )
    faturamento_liquido = max(bruto_pro_calc - taxa, 0.0)

    return {
        "transacao": str(transacao),
        "produto": str(product.get("name") or ""),
        "produtor": str(producer.get("name") or "") or None,
        "afiliado": str(affiliate.get("name") or "") or None,
        # payment.type = nome curto (PIX, CREDIT_CARD, BOLETO) — fallback pra method se faltar
        "meio_pagamento": payment.get("type") or payment.get("method"),
        "meio_pagamento_detalhe": payment.get("method"),
        "moeda": price.get("currency_value") or price.get("currency_code"),
        "preco_total": preco_total,
        "faturamento_liquido": faturamento_liquido,
        "taxa_hotmart": taxa or None,
        "numero_parcela": payment.get("installments_number"),
        "recorrencia": (
            str(purchase.get("recurrency_number"))
            if purchase.get("recurrency_number") is not None
            else None
        ),
        "is_subscription": purchase.get("is_subscription"),
        "commission_as": purchase.get("commission_as"),
        "data_venda": _ms_to_dt(purchase.get("order_date")),
        "data_confirmacao": _ms_to_dt(purchase.get("approved_date")),
        "status": purchase.get("status"),
        "cliente_nome": buyer.get("name"),
        "cliente_email": (buyer.get("email") or "").lower() or None,
        "cliente_estado": address.get("state"),
        "cliente_pais": address.get("country"),
        "codigo_produto": str(product.get("id") or "") or None,
        "codigo_oferta": offer.get("code"),
        "tipo_pagamento_oferta": offer.get("payment_mode"),
        # ----- tracking -----
        "utm_source": utm_source,
        "utm_medium": utm_medium,
        "utm_campaign": utm_campaign,
        "tracking_codes_raw": tracking,
        "matched_via": "hotmart_src" if utm_source else None,
    }


def _parse_tracking_source(src: str) -> tuple[str | None, str | None, str | None]:
    """
    Hotmart costuma receber o tracking via param `src=` na URL do checkout.
    Convenções comuns:
      - "utm_source|utm_medium|utm_campaign"
      - "utm_source"
      - JSON com chaves utm_*
    """
    if not src:
        return None, None, None
    s = src.strip()

    # tenta JSON
    if s.startswith("{"):
        try:
            import json as _json
            d = _json.loads(s)
            return (
                d.get("utm_source") or d.get("source"),
                d.get("utm_medium") or d.get("medium"),
                d.get("utm_campaign") or d.get("campaign"),
            )
        except Exception:
            pass

    # pipe-separated
    if "|" in s:
        parts = [p.strip() or None for p in s.split("|")]
        parts += [None, None, None]
        return parts[0], parts[1], parts[2]

    # underscore-separated
    if "_" in s:
        parts = s.split("_", 2)
        parts += [None, None, None]
        return parts[0], parts[1], parts[2]

    return s, None, None
