# DashCENAT

Dashboard interno do CENAT — métricas de Marketing e Comercial.

## Quick start

```bash
docker compose up -d                           # Postgres 5442
cd backend && source .venv/bin/activate
alembic upgrade head && python -m app.etl.seed
uvicorn app.main:app --reload --port 8010
# outro terminal:
cd frontend && pnpm dev                        # porta 3010
```

## Stack

- Backend: FastAPI + SQLAlchemy 2.0 async + Alembic + PostgreSQL 16
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts
- Auth: JWT HS256, tabela core.users

## DB schemas

- `core` — users, produtos, canais, eventos
- `mkt` — metricas_canal, leads_eventos, inscricoes_evento
- `comercial` — funil_etapas, funil_resultado, vendas, reunioes

## Conventions

- API prefix: `/api/v1/`
- Models use Portuguese column names matching PROJECT_SPEC.md
- Pydantic schemas in `backend/app/schemas/`
- Frontend API calls go through `frontend/lib/api.ts` (fetch wrapper with JWT)
- All timestamps are TIMESTAMPTZ (UTC)
- UUIDs as primary keys (except funil_etapas which uses INT 1-5)
- Porta backend: 8010, frontend: 3010, Postgres docker: 5442

## Commands

```bash
# Backend
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
python -m app.etl.seed
uvicorn app.main:app --reload --port 8010

# Frontend
cd frontend
pnpm dev
pnpm build
```
