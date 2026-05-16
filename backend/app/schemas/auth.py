import uuid
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    senha: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    nome: str
    ativo: bool
    papel: str = "user"
    ultimo_acesso: datetime | None = None
    criado_em: datetime | None = None

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    email: str
    nome: str
    senha: str
    papel: str = "user"
    ativo: bool = True


class UserUpdate(BaseModel):
    nome: str | None = None
    email: str | None = None
    papel: str | None = None
    ativo: bool | None = None


class UserResetSenha(BaseModel):
    senha: str
