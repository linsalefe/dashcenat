import uuid

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    senha: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    nome: str
    ativo: bool

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
