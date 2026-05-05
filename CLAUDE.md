# CLAUDE.md — Instruções para o Claude Code

Este arquivo é lido automaticamente pelo Claude Code ao operar nesse repo. Define padrões, comandos comuns e expectativas. **Leia também `PROJECT_SPEC.md` na raiz** antes de qualquer mudança grande.

## Sobre o projeto

DashCENAT é um dashboard interno do CENAT que consolida métricas de Marketing e Comercial. Time preenche manualmente; ETL importa histórico das planilhas atuais. Single-tenant. Login compartilhado por usuário (sem hierarquia de permissões).

## Stack

- **Backend:** FastAPI 0.110+ · SQLAlchemy 2.0 async · Alembic · Pydantic v2 · Python 3.11 · PostgreSQL 16
- **Frontend:** **Next 16** · **React 19** · **TypeScript** · **Tailwind CSS 4** · **shadcn 4 (Base UI, NÃO Radix)** · Recharts 2.13+
- **Auth:** JWT HS256 — login simples sem RBAC

> ⚠️ **Stack frontend é uma geração à frente do que LLMs conhecem.** Existe `frontend/AGENTS.md` alertando: *"This is NOT the Next.js you know."* Quando em dúvida sobre API/convenção, leia `node_modules/next/dist/docs/` antes de escrever código.

## Convenções de código

### Backend
- Modelos em `backend/app/models/` separados por domínio:
  - `base.py` — `Base` declarativa + helper `pk_uuid()` que gera `gen_random_uuid()` no servidor
  - `user.py`, `catalogo.py`, `comercial.py`, `mkt.py`
- Pydantic schemas em `backend/app/schemas/` com sufixos `Create`, `Update`, `Out`.
- Routers em `backend/app/api/v1/` agrupados por domínio. Dependency `get_current_user` em `backend/app/api/deps.py` (um nível acima de `v1/`).
- Lógica de cálculo agregado em `backend/app/services/` — endpoints só orquestram.
- **async em todos os endpoints e funções de DB.**
- IDs: UUID via `gen_random_uuid()` no servidor (não Python).
- Datas: `TIMESTAMPTZ` no banco, sempre UTC.
- ENUMs declarados em **escopo de módulo** (não dentro do model). Schema do ENUM = schema da tabela.
- **Nomes de colunas em português** (decisão fechada — bate com planilhas atuais).
- ETL idempotente — sempre UPSERT (`ON CONFLICT`) respeitando UNIQUE constraints.
- `bcrypt==4.1.3` pinado (incompat com 5.x + passlib). **Não atualizar.**

### Frontend
- **shadcn 4 com Base UI** — padrão de composição mudou:
  - Antes: `<DialogTrigger asChild><Button>X</Button></DialogTrigger>`
  - Agora: `<DialogTrigger render={<Button />} onClick={...}>X</DialogTrigger>`
  - Adicionar componentes via `pnpm dlx shadcn@latest add <comp>`
- App Router com route groups: `(auth)`, `(dashboard)`.
- **Server Components por padrão**; `"use client"` só onde precisa (qualquer coisa com hooks/localStorage/eventos).
- Fetch wrapper único em `lib/api.ts` — uso: `api.get<T>(...)`, `api.post<T>(...)`, `api.patch<T>(...)`, `api.delete<T>(...)`. Já injeta JWT do localStorage e redireciona pra `/login` em 401.
- `NEXT_PUBLIC_API_URL` **já inclui `/api/v1`** — chamar `api.get("/produtos")` (não `/api/v1/produtos`).
- Componentes de gráfico em `components/charts/` (Sprint 2 cria: `FunilChart`, `MetaVsResultado`, `EvolucaoMensal`).
- Datas em pt-BR: `Intl.DateTimeFormat('pt-BR')`.
- Valores monetários BRL: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **Tailwind 4:** sem `tailwind.config.ts`. Tema em `app/globals.css` via `@import "tailwindcss"` + `@theme inline`.

### Estilo visual
- Identidade CENAT — paleta principal: tons de **zinc/slate** profissional (sidebar zinc-900 dark, conteúdo zinc-50 light). Cards com `border` ao invés de `shadow`.
- Tipografia: Geist (já configurada em `app/layout.tsx`).

### 🚫 Regra de marca CENAT — NUNCA usar ícones de cérebro
**Proibido em qualquer ativo do projeto** (sidebar, dashboards, placeholders, ilustrações). lucide-react `Brain`, `BrainCircuit`, `BrainCog` e variantes — todos vetados. Regra rígida da marca, aplicada em todos os clientes do CENAT, não tem exceção.

Alternativas pra "ícone de inteligência/cognição": `Lightbulb`, `Sparkles`, `Activity`, `Heart`, `Target`, `TrendingUp`.

## Comandos comuns

### Dev local
```bash
# 1. Subir Postgres
docker compose up -d
docker compose ps                           # confirmar healthy

# 2. Backend
cd backend
uv sync
alembic upgrade head
uv run python -m app.etl.seed               # admin + 15 canais + 5 etapas funil
uv run uvicorn app.main:app --reload --port 8010

# 3. Frontend (outro terminal)
cd frontend
pnpm install
pnpm dev                                    # porta 3010

# Login: admin@cenat.com / trocar123
```

### Migrations
```bash
cd backend
uv run alembic revision --autogenerate -m "descricao curta em ingles"
uv run alembic upgrade head
uv run alembic downgrade -1                 # rollback uma migration
uv run alembic current                      # versão atual
uv run alembic history                      # histórico
```

### ETL
```bash
cd backend

# Sprint 2 — Comercial
uv run python -m app.etl.parsers.comercial \
  --planilha /opt/dashcenat/data/DASH_Processo_Seletivo_2026.xlsx \
  --ano 2026

# Sprint 3 — Marketing (futuro)
uv run python -m app.etl.parsers.mkt \
  --planilha /opt/dashcenat/data/Sistema_Marketing___Inscrições.xlsx \
  --ano 2026
```

### Adicionar componente shadcn
```bash
cd frontend
pnpm dlx shadcn@latest add <componente>     # ex: badge, separator, form
```

### Deploy (Sprint 5)
```bash
cd /root/dashcenat && git pull
cd backend && uv sync && uv run alembic upgrade head
sudo systemctl restart dashcenat-api
cd ../frontend && pnpm install && pnpm build
sudo systemctl restart dashcenat-web
```

## Decisões fechadas (não reabrir sem motivo forte)

Lista completa em `PROJECT_SPEC.md` seção 7. Resumo:

1. **Single-tenant CENAT.** Sem multi-tenancy.
2. **Login compartilhado.** Sem RBAC, todos veem e editam tudo.
3. **Stack frontend Next 16 + React 19 + TW 4 + shadcn 4 Base UI.** Não reverter.
4. **`mkt.metricas_canal` genérica.** Indicadores em VARCHAR + JSONB. Não criar tabela por canal.
5. **Funil fixo de 5 etapas:** Lead → Ligação → SQL → Reunião → Venda.
6. **Postgres em Docker isolado** porta 5442 (em dev). Sprint 5 reavalia.
7. **Recharts** como lib de gráfico.
8. **`dash.cenatdata.online`** subdomínio de produção.
9. **Colunas em português** no banco.
10. **`leads_eventos.cpl` calculado em Python** (não GENERATED column).
11. **Senha admin:** `trocar123`.
12. **JWT_EXPIRE_MIN = 480** (8h).
13. **Endpoints achatados:** `/api/v1/produtos` (não `/api/v1/catalogo/produtos`).
14. **`bcrypt==4.1.3` pinado.** Não atualizar.
15. **Schemas criados via migration.** Após Sprint 2, `CREATE SCHEMA` sai de `env.py`/`main.py`/`seed.py` e fica só na primeira migration.

## O que está fora de escopo (fase 2 / pós-MVP)

- Integrações automáticas (Meta Ads API, GA4, Mailchimp, Spotify) — listadas pra futuro mas não implementar agora.
- RBAC / permissões granulares.
- Multi-tenancy.
- Mobile app nativo (web responsivo basta).
- Histórico de auditoria por linha alterada.
- Endpoint de trocar senha + recuperação por email (Sprint 5 se houver tempo, senão fase 2).

## Quando estiver em dúvida

1. Consulte `PROJECT_SPEC.md` — DDL completo, lista de endpoints, mapeamento ETL detalhado.
2. Se for sobre Next/React/Tailwind/shadcn novos, leia `frontend/AGENTS.md` e `node_modules/next/dist/docs/`.
3. Se a spec não cobrir, **pare e pergunte ao Álefe antes de inventar** — ele é o stakeholder único do projeto.
4. Em decisões técnicas menores (estrutura de arquivo, naming), siga as convenções desse arquivo e os outros projetos do diretório raiz (`creative-agents`, `eleitorvox`, `imobhub`, `intercambio`).

## Sobre os Sprints

Cada Sprint roda em branch `dashcenat-S<N>-YYYYMMDD`, com commits incrementais por etapa, push, merge automático na main ao final. Smoke test obrigatório antes do merge. Relatório final em formato padrão.

- ✅ Sprint 1 — Fundação (auth + catálogo)
- ⏳ Sprint 2 — Comercial + Fundação corretiva (migration consolidada + 14 placeholders + endpoints comerciais + ETL + 4 telas)
- ⏳ Sprint 3 — Marketing (8 canais)
- ⏳ Sprint 4 — Eventos
- ⏳ Sprint 5 — Overview + Deploy
