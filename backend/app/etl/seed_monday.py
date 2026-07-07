"""Bootstrap da integração monday: grava o token CIFRADO em core.integracoes e
dispara a primeira descoberta de boards. Nenhum board_id é pedido.

Uso:
    uv run python -m app.etl.seed_monday --token <TOKEN> [--workspaces Marketing]

--workspaces define o escopo default do `incluido` (config_extra.workspaces_incluidos).
Omitido → mantém o que já estava; default de fábrica = ["Marketing"]. Boards fora do
escopo entram catalogados mas incluido=false (ligáveis depois pela tela de Boards).
"""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.db import async_session
from app.etl.monday_discovery import descobrir_boards
from app.models.integracoes import Integracao
from app.services.crypto import encrypt_json, mask


async def _run(token: str, workspaces: list[str] | None) -> None:
    async with async_session() as db:
        res = await db.execute(select(Integracao).where(Integracao.servico == "monday"))
        integ = res.scalar_one_or_none()

        cifrado = encrypt_json({"token": token})
        if integ:
            integ.credentials_cifradas = cifrado
            integ.ativo = True
            if workspaces is not None:
                cfg = dict(integ.config_extra or {})
                cfg["workspaces_incluidos"] = workspaces
                integ.config_extra = cfg
        else:
            integ = Integracao(
                servico="monday",
                credentials_cifradas=cifrado,
                ativo=True,
                config_extra={"workspaces_incluidos": workspaces or ["Marketing"]},
            )
            db.add(integ)
        await db.commit()
        print(f"✓ token monday gravado (cifrado): {mask(token)}")
        print(f"✓ escopo default (workspaces_incluidos): "
              f"{(integ.config_extra or {}).get('workspaces_incluidos')}")

        print("→ rodando primeira descoberta de boards...")
        r = await descobrir_boards(db)
        print(f"✓ descoberta: {r}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Bootstrap da integração monday")
    ap.add_argument("--token", required=True, help="Token de API pessoal do monday")
    ap.add_argument(
        "--workspaces",
        default="Marketing",
        help="Workspaces incluídos por padrão (vírgula). Vazio/'*' = todos.",
    )
    args = ap.parse_args()
    ws_raw = (args.workspaces or "").strip()
    workspaces = None if ws_raw in ("", "*") else [w.strip() for w in ws_raw.split(",") if w.strip()]
    asyncio.run(_run(args.token, workspaces))


if __name__ == "__main__":
    main()
