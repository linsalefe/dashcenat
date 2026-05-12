from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine
from app.api.v1 import (
    auth,
    catalogo,
    comercial,
    etl,
    frente_periodo,
    funil_mensal,
    intercambio,
    lancamentos,
    overview,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schemas são criados pela migration (única fonte da verdade).
    yield
    await engine.dispose()


app = FastAPI(title="DashCENAT API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3010", "https://dash.cenatdata.online"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(catalogo.router, prefix="/api/v1", tags=["catalogo"])
app.include_router(comercial.router, prefix="/api/v1", tags=["comercial"])
app.include_router(etl.router, prefix="/api/v1")
app.include_router(overview.router, prefix="/api/v1")
app.include_router(lancamentos.router, prefix="/api/v1")
app.include_router(intercambio.router, prefix="/api/v1")
app.include_router(frente_periodo.router, prefix="/api/v1")
app.include_router(funil_mensal.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
