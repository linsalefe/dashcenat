"""CRUD de usuários — admin gerencia todos, user só edita o próprio.

Regras de permissão:
- listar/buscar: admin vê todos, user vê só ele mesmo
- criar: só admin
- editar: admin pode tudo, user só o próprio (e não pode mudar papel/ativo)
- excluir: só admin, e não pode se auto-excluir
- reset senha: admin reseta de qualquer, user só a própria
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.security import hash_password
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserOut,
    UserResetSenha,
    UserUpdate,
)

router = APIRouter()


def _exige_admin(user: User):
    if user.papel != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admins podem fazer esta operação",
        )


def _exige_admin_ou_self(user: User, target_id: uuid.UUID):
    if user.papel != "admin" and user.id != target_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode modificar o próprio usuário",
        )


@router.get("", response_model=list[UserOut])
async def listar_usuarios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.papel == "admin":
        q = select(User).order_by(User.criado_em.desc())
    else:
        q = select(User).where(User.id == user.id)
    result = await db.execute(q)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def criar_usuario(
    body: UserCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _exige_admin(user)

    if body.papel not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Papel deve ser 'admin' ou 'user'")
    if len(body.senha) < 6:
        raise HTTPException(status_code=400, detail="Senha precisa ter ao menos 6 caracteres")

    email = body.email.strip().lower()
    existe = await db.execute(select(User).where(User.email == email))
    if existe.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    novo = User(
        email=email,
        nome=body.nome.strip(),
        senha_hash=hash_password(body.senha),
        ativo=body.ativo,
        papel=body.papel,
    )
    db.add(novo)
    await db.commit()
    await db.refresh(novo)
    return UserOut.model_validate(novo)


@router.patch("/{user_id}", response_model=UserOut)
async def atualizar_usuario(
    user_id: uuid.UUID,
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _exige_admin_ou_self(user, user_id)

    alvo = await db.get(User, user_id)
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # User comum NÃO pode mudar próprio papel/ativo
    if user.papel != "admin":
        if body.papel is not None or body.ativo is not None:
            raise HTTPException(
                status_code=403,
                detail="Apenas admins podem alterar papel ou status de ativação",
            )

    # Admin não pode rebaixar a si mesmo (segurança contra travar o sistema)
    if (
        user.papel == "admin"
        and alvo.id == user.id
        and body.papel is not None
        and body.papel != "admin"
    ):
        raise HTTPException(
            status_code=400,
            detail="Você não pode rebaixar o próprio papel de admin",
        )

    # Admin não pode desativar a si mesmo
    if (
        user.papel == "admin"
        and alvo.id == user.id
        and body.ativo is False
    ):
        raise HTTPException(
            status_code=400,
            detail="Você não pode desativar a própria conta",
        )

    if body.nome is not None:
        alvo.nome = body.nome.strip()
    if body.email is not None:
        novo_email = body.email.strip().lower()
        if novo_email != alvo.email:
            existe = await db.execute(
                select(User).where(User.email == novo_email, User.id != alvo.id)
            )
            if existe.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Email já está em uso")
            alvo.email = novo_email
    if body.papel is not None:
        if body.papel not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="Papel inválido")
        alvo.papel = body.papel
    if body.ativo is not None:
        alvo.ativo = body.ativo

    await db.commit()
    await db.refresh(alvo)
    return UserOut.model_validate(alvo)


@router.post("/{user_id}/reset-senha", status_code=204)
async def resetar_senha(
    user_id: uuid.UUID,
    body: UserResetSenha,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _exige_admin_ou_self(user, user_id)

    if len(body.senha) < 6:
        raise HTTPException(status_code=400, detail="Senha precisa ter ao menos 6 caracteres")

    alvo = await db.get(User, user_id)
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    alvo.senha_hash = hash_password(body.senha)
    await db.commit()
    return None


@router.delete("/{user_id}", status_code=204)
async def excluir_usuario(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _exige_admin(user)

    if user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode excluir a própria conta",
        )

    alvo = await db.get(User, user_id)
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    await db.delete(alvo)
    await db.commit()
    return None
