from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine
from app.api.v1 import (
    auth,
    catalogo,
    comercial,
    doity,
    etl,
    exact_sales,
    frente_periodo,
    funil_mensal,
    hotmart,
    instagram,
    intercambio,
    lancamentos,
    meta_ads,
    overview,
    tracking,
    usuarios,
    utm,
)
from app.etl.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schemas são criados pela migration (única fonte da verdade).
    if settings.ENABLE_SCHEDULER:
        start_scheduler()
    yield
    stop_scheduler()
    await engine.dispose()


app = FastAPI(title="DashCENAT API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3010", "https://dash.cenatdata.online"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware: adiciona CORS aberto SOMENTE nas rotas públicas de tracking,
# pra LPs hospedadas em qualquer domínio poderem chamar /track/event e /track/snippet.js
@app.middleware("http")
async def tracking_open_cors(request, call_next):
    public_paths = (
        "/api/v1/track/event",
        "/api/v1/track/snippet.js",
        "/api/v1/track/r/",
        "/api/v1/hotmart/webhook",
    )
    is_public = any(request.url.path.startswith(p) for p in public_paths)

    # Reflete o origin específico em vez de wildcard `*`, pra ser compatível
    # com requests que enviam credentials (cookies). Wildcard quebra nessa situação.
    origin = request.headers.get("origin", "*")

    if is_public and request.method == "OPTIONS":
        from starlette.responses import Response
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "600",
                "Vary": "Origin",
            },
        )
    response = await call_next(request)
    if is_public:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(catalogo.router, prefix="/api/v1", tags=["catalogo"])
app.include_router(comercial.router, prefix="/api/v1", tags=["comercial"])
app.include_router(etl.router, prefix="/api/v1")
app.include_router(overview.router, prefix="/api/v1")
app.include_router(lancamentos.router, prefix="/api/v1")
app.include_router(intercambio.router, prefix="/api/v1")
app.include_router(frente_periodo.router, prefix="/api/v1")
app.include_router(funil_mensal.router, prefix="/api/v1")
app.include_router(tracking.router, prefix="/api/v1")
app.include_router(utm.router, prefix="/api/v1")
app.include_router(hotmart.router, prefix="/api/v1")
app.include_router(meta_ads.router, prefix="/api/v1")
app.include_router(instagram.router, prefix="/api/v1")
app.include_router(exact_sales.router, prefix="/api/v1")
app.include_router(doity.router, prefix="/api/v1")
app.include_router(doity.eventos_router, prefix="/api/v1")
app.include_router(usuarios.router, prefix="/api/v1/usuarios", tags=["usuarios"])


@app.get("/health")
async def health():
    return {"status": "ok"}
