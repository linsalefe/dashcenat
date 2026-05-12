"""Seed da Sprint Marketing Frentes — Maio/2026.

Idempotente: pode rodar várias vezes. Usa ON CONFLICT (frente, ano, mes, evento_nome) DO UPDATE.

Origens dos dados:
- Pós: planilha DASH_Processo_Seletivo_2026 aba "Maio" (16 turmas).
- Congressos: print do dashboard atual de Maio/2026 (6 eventos).
- Cursos Livres: print "CURSOS LIVRES 2026 - Maio" (1 linha agregada).
- Comunidade: SEM DADOS REAIS — placeholder para a tela renderizar.

Investimento em Ads: R$ 5.000 placeholder em todas as frentes/eventos.
O gestor edita pelo Dialog na tela depois.

Rode com:
    uv run python -m scripts.seed_marketing_maio_2026
"""
from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session
from app.models.mkt import FrentePeriodo


ANO = 2026
MES = 5
INVESTIMENTO_PLACEHOLDER = Decimal("5000.00")


# ─────────────────────────────────────────────────────────────────
# CONGRESSOS (6 eventos)
# ─────────────────────────────────────────────────────────────────
CONGRESSOS = [
    {
        "evento_nome": "VII Congresso Online Internacional: Boas Práticas em Saúde Mental",
        "meta_inscritos": 60, "inscritos": 55,
        "meta_receita": Decimal("7718.40"), "receita": Decimal("8400.00"),
        "ticket_medio": Decimal("152.73"),
        "taxa_doity": Decimal("0.058"),
    },
    {
        "evento_nome": "VIII Congresso Internacional: Novas Abordagens em Saúde Mental Infantojuvenil - Fortaleza/CE",
        "meta_inscritos": 180, "inscritos": 66,
        "meta_receita": Decimal("59418.00"), "receita": Decimal("17528.00"),
        "ticket_medio": Decimal("265.58"),
        "taxa_doity": Decimal("0.058"),
    },
    {
        "evento_nome": "IX Congresso Internacional: Novas Abordagens em Saúde Mental – IPUB/UFRJ",
        "meta_inscritos": 42, "inscritos": 0,
        "meta_receita": Decimal("12012.00"), "receita": Decimal("0.00"),
        "ticket_medio": None,
        "taxa_doity": Decimal("0.058"),
    },
    {
        "evento_nome": "VI Congresso Internacional: Boas Práticas em Saúde Mental - Belém/PA",
        "meta_inscritos": 184, "inscritos": 48,
        "meta_receita": Decimal("52367.84"), "receita": Decimal("9420.00"),
        "ticket_medio": Decimal("196.25"),
        "taxa_doity": Decimal("0.058"),
    },
    {
        "evento_nome": "VII Congresso Internacional: Saúde Mental e Direitos Humanos das Populações Vulnerabilizadas",
        "meta_inscritos": 191, "inscritos": 38,
        "meta_receita": Decimal("59019.00"), "receita": Decimal("8258.00"),
        "ticket_medio": Decimal("217.32"),
        "taxa_doity": Decimal("0.058"),
    },
    {
        "evento_nome": "I Congresso Internacional online Saúde Mental Organizacional",
        "meta_inscritos": 120, "inscritos": 2,
        "meta_receita": Decimal("35640.00"), "receita": Decimal("180.00"),
        "ticket_medio": Decimal("90.00"),
        "taxa_doity": Decimal("0.058"),
    },
]


# ─────────────────────────────────────────────────────────────────
# CURSOS LIVRES (1 linha agregada)
# ─────────────────────────────────────────────────────────────────
CURSOS = [
    {
        "evento_nome": "Cursos Livres 2026 — Total",
        "meta_inscritos": 600, "inscritos": 34,
        "meta_receita": Decimal("58200.00"), "receita": Decimal("3298.00"),
        "ticket_medio": Decimal("97.00"),
    },
]


# ─────────────────────────────────────────────────────────────────
# COMUNIDADE (placeholder vazio — sem dados ainda)
# ─────────────────────────────────────────────────────────────────
COMUNIDADE = [
    {
        "evento_nome": "Comunidade CENAT",
        "meta_inscritos": 0, "inscritos": 0,
        "meta_receita": Decimal("0"), "receita": Decimal("0"),
    },
]


# ─────────────────────────────────────────────────────────────────
# PÓS-GRADUAÇÃO (16 turmas)
# Origem: planilha DASH_Processo_Seletivo_2026, aba "Maio".
# (nome, meta_leads, leads, meta_lig, lig, meta_sql, sql, meta_reu, reu, meta_ven, ven, meta_rec, rec)
# ─────────────────────────────────────────────────────────────────
POS = [
    ("Especialização em Supervisão Clínica",                0,   4,   2,   1,   2,   1,   2,   2,   2,   2, Decimal("0"),         Decimal("13000.00")),
    ("Especialização em Boas Práticas",                    10,   4,   6,   5,   4,   1,   4,   1,   2,   1, Decimal("13244.70"),  Decimal("5600.00")),
    ("Especialização em Infanto T5",                       40,  13,  22,   6,  17,   4,  14,   2,  10,   0, Decimal("52978.80"),  Decimal("0.00")),
    ("Especialização em Acompanhante Terapêutico T1",      30,   8,  17,   2,  13,   1,  11,   1,   7,   0, Decimal("39734.10"),  Decimal("0.00")),
    ("Especialização em Psicologia Hospitalar",            60,  38,  34,  17,  25,   9,  21,   5,  15,   4, Decimal("79468.20"),  Decimal("23075.00")),
    ("Especialização em Gênero T2",                        50,  18,  28,  11,  21,   9,  18,   4,  12,   3, Decimal("66223.50"),  Decimal("16900.00")),
    ("Especialização em Psicologia Clínica T2",            40,   6,  22,   7,  17,   6,  14,   3,  10,   4, Decimal("52978.80"),  Decimal("17460.00")),
    ("Especialização em AD T4",                            75,  79,  42,  39,  32,  12,  27,   2,  19,   0, Decimal("99335.25"),  Decimal("0.00")),
    ("Especialização em Suicídio",                         90,  26,  50,   8,  38,   4,  32,   3,  22,   2, Decimal("119202.30"), Decimal("5850.00")),
    ("Especialização em Práticas Dialógicas",              40,   2,  22,   1,  17,   1,  14,   0,  10,   0, Decimal("52978.80"),  Decimal("0.00")),
    ("Especialização em Economia Solidária",               30,  30,  17,  14,  13,  10,  11,   3,   7,   1, Decimal("39734.10"),  Decimal("5850.00")),
    ("Especialização em Gestão T5",                        50,   2,  28,   6,  21,   4,  18,   0,  12,   0, Decimal("66223.50"),  Decimal("0.00")),
    ("Especialização em TEA",                              60,  11,  34,   8,  25,   5,  21,   2,  15,   1, Decimal("79468.20"),  Decimal("5200.00")),
    ("Especialização em BP EAD",                           40,  11,  22,   4,  13,   3,   7,   0,   4,   0, Decimal("15735.19"),  Decimal("0.00")),
    ("Especialização em Grupos T2",                        30,   0,  17,   0,   9,   0,   5,   0,   3,   0, Decimal("15636.85"),  Decimal("0.00")),
    ("Especialização em Mulheres",                         20,   0,  11,   0,   6,   0,   4,   0,   2,   0, Decimal("10424.57"),  Decimal("0.00")),
]


async def upsert(db: AsyncSession, registros: list[dict]):
    """UPSERT por (frente, ano, mes, evento_nome)."""
    for reg in registros:
        stmt = pg_insert(FrentePeriodo).values(**reg)
        update_cols = {c: stmt.excluded[c] for c in reg.keys()
                       if c not in ("frente", "ano", "mes", "evento_nome")}
        stmt = stmt.on_conflict_do_update(
            constraint="uq_frente_periodo_evento",
            set_=update_cols,
        )
        await db.execute(stmt)
    await db.commit()


async def main():
    async with async_session() as db:
        regs_congressos = [
            {**c, "frente": "congresso", "ano": ANO, "mes": MES,
             "investimento_ads": INVESTIMENTO_PLACEHOLDER}
            for c in CONGRESSOS
        ]
        await upsert(db, regs_congressos)
        print(f"✓ Congressos: {len(regs_congressos)} registros")

        regs_cursos = [
            {**c, "frente": "curso", "ano": ANO, "mes": MES,
             "investimento_ads": INVESTIMENTO_PLACEHOLDER}
            for c in CURSOS
        ]
        await upsert(db, regs_cursos)
        print(f"✓ Cursos Livres: {len(regs_cursos)} registros")

        regs_comunidade = [
            {**c, "frente": "comunidade", "ano": ANO, "mes": MES,
             "investimento_ads": INVESTIMENTO_PLACEHOLDER}
            for c in COMUNIDADE
        ]
        await upsert(db, regs_comunidade)
        print(f"✓ Comunidade: {len(regs_comunidade)} registros")

        regs_pos = []
        for (nome, ml, l, mlig, lig, msql, sql, mreu, reu, mven, ven, mrec, rec) in POS:
            regs_pos.append({
                "frente": "pos", "ano": ANO, "mes": MES,
                "evento_nome": nome,
                "investimento_ads": INVESTIMENTO_PLACEHOLDER,
                "meta_leads": ml, "leads": l,
                "meta_ligacao": mlig, "ligacao": lig,
                "meta_sql": msql, "sql_reuniao": sql,
                "meta_reuniao": mreu, "reuniao_realizada": reu,
                "meta_vendas": mven, "vendas": ven,
                "meta_inscritos": mven,         # na Pós, "inscritos" = matrículas/vendas
                "inscritos": ven,
                "meta_receita": mrec, "receita": rec,
                "no_show_pct": Decimal("0.60"),
                "ticket_medio": Decimal("5163.06"),
            })
        await upsert(db, regs_pos)
        print(f"✓ Pós-Graduação: {len(regs_pos)} registros")

        print(f"\nSeed Maio/{ANO} concluído.")


if __name__ == "__main__":
    asyncio.run(main())
