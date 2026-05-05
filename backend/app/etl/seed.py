"""Seed canais, funil_etapas, and a default admin user.

Usage:
    python -m app.etl.seed
"""
import asyncio

from sqlalchemy import select

from app.core.db import async_session
from app.core.security import hash_password
from app.models.user import User
from app.models.catalogo import Canal
from app.models.comercial import FunilEtapa

CANAIS = [
    ("Tráfego Pago", "trafego_pago", "pago"),
    ("Orgânico", "organico", "organico"),
    ("Instagram", "instagram", "organico"),
    ("YouTube", "youtube", "organico"),
    ("Podcast", "podcast", "organico"),
    ("Blog", "blog", "organico"),
    ("E-mail", "email", "organico"),
    ("Landing Pages", "landing_pages", "organico"),
    ("SEO", "seo", "organico"),
    ("Design", "design", "interno"),
    ("Eventos Online", "eventos_online", "evento"),
    ("Seminário ao Vivo", "seminario_ao_vivo", "evento"),
    ("Seminário Gravado", "seminario_gravado", "evento"),
    ("Curso Livre", "curso_livre", "produto"),
    ("Lançamento", "lancamento", "evento"),
]

FUNIL_ETAPAS = [
    (1, "leads", "Leads Gerados", 1),
    (2, "ligacao", "Ligação Qualificação", 2),
    (3, "sql", "SQL / Reunião Agendada", 3),
    (4, "reuniao", "Reunião Realizada", 4),
    (5, "venda", "Aluno (Venda)", 5),
]


async def seed():
    async with async_session() as db:
        # Canais
        for nome, slug, categoria in CANAIS:
            exists = await db.execute(select(Canal).where(Canal.slug == slug))
            if exists.scalar_one_or_none() is None:
                db.add(Canal(nome=nome, slug=slug, categoria=categoria))
        print(f"  Canais: {len(CANAIS)} verificados/inseridos")

        # Funil etapas
        for id_, codigo, nome, ordem in FUNIL_ETAPAS:
            exists = await db.execute(select(FunilEtapa).where(FunilEtapa.id == id_))
            if exists.scalar_one_or_none() is None:
                db.add(FunilEtapa(id=id_, codigo=codigo, nome=nome, ordem=ordem))
        print(f"  Funil etapas: {len(FUNIL_ETAPAS)} verificadas/inseridas")

        # Admin user
        exists = await db.execute(select(User).where(User.email == "admin@cenat.com"))
        if exists.scalar_one_or_none() is None:
            db.add(
                User(
                    email="admin@cenat.com",
                    nome="Admin CENAT",
                    senha_hash=hash_password("trocar123"),
                )
            )
            print("  Admin user criado: admin@cenat.com")
        else:
            print("  Admin user já existe")

        await db.commit()
        print("Seed concluído.")


if __name__ == "__main__":
    asyncio.run(seed())
