"""Endpoints de upload de XLSX (Sprint APR1)."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.etl.parsers.hotmart import importar_hotmart
from app.etl.parsers.lancamento import importar_lancamentos
from app.etl.parsers.meta_ads import importar_meta_ads
from app.models.user import User
from app.schemas.mkt import ETLResult

router = APIRouter(prefix="/etl", tags=["etl"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _validate_xlsx(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(400, "Arquivo sem nome")
    name_lower = file.filename.lower()
    if not (name_lower.endswith(".xlsx") or name_lower.endswith(".xls")):
        raise HTTPException(400, "Apenas .xlsx ou .xls")


@router.post("/meta-ads", response_model=ETLResult)
async def upload_meta_ads(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _validate_xlsx(file)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "Arquivo > 50MB")
    if len(content) < 100:
        raise HTTPException(400, "Arquivo vazio ou corrompido")

    try:
        result = await importar_meta_ads(content, db)
    except ValueError as e:
        raise HTTPException(400, f"Erro ao processar: {e}")
    except Exception as e:
        raise HTTPException(500, f"Erro inesperado: {e}")

    return ETLResult(**result)


@router.post("/hotmart", response_model=ETLResult)
async def upload_hotmart(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _validate_xlsx(file)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "Arquivo > 50MB")
    if len(content) < 100:
        raise HTTPException(400, "Arquivo vazio ou corrompido")

    try:
        result = await importar_hotmart(content, db)
    except ValueError as e:
        raise HTTPException(400, f"Erro ao processar: {e}")
    except Exception as e:
        raise HTTPException(500, f"Erro inesperado: {e}")

    return ETLResult(**result)


@router.post("/lancamentos", response_model=ETLResult)
async def upload_lancamentos(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _validate_xlsx(file)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "Arquivo > 50MB")
    if len(content) < 100:
        raise HTTPException(400, "Arquivo vazio ou corrompido")

    try:
        result = await importar_lancamentos(content, db)
    except ValueError as e:
        raise HTTPException(400, f"Erro ao processar: {e}")
    except Exception as e:
        raise HTTPException(500, f"Erro inesperado: {e}")

    return ETLResult(**result)
