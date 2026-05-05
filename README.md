# DashCENAT

Dashboard interno do CENAT — métricas de Marketing e Comercial.

## Dev local

### Pré-requisitos

- Python >= 3.11
- Node.js >= 20
- Docker (para Postgres) ou Postgres 16 local
- pnpm, uv

### 1. Banco de dados

```bash
docker compose up -d          # Postgres na porta 5442
```

Ou use um Postgres local — ajuste `DATABASE_URL` no `.env`.

### 2. Backend

```bash
cd backend
cp .env.example .env          # ajuste se necessário
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
alembic upgrade head
python -m app.etl.seed        # seed de canais, funil, admin
uvicorn app.main:app --reload --port 8010
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev                      # porta 3010
```

### 4. Acesso

- Frontend: http://localhost:3010
- API: http://localhost:8010/api/v1
- Login: `admin@cenat.com` / `trocar123`
