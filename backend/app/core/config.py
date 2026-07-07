from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://dashcenat:dashcenat_dev@localhost:5432/dashcenat"
    JWT_SECRET: str = "trocar-em-producao"
    JWT_EXPIRE_MIN: int = 480
    JWT_ALGORITHM: str = "HS256"
    FERNET_KEY: str | None = None  # base64 urlsafe 32 bytes; gere com `Fernet.generate_key().decode()`
    DOITY_BASE_URL: str = "https://api.doity.com.br/public/v1"
    MONDAY_API_URL: str = "https://api.monday.com/v2"
    MONDAY_API_VERSION: str = "2026-07"  # kind=current validado na Fase 0 (2026-07-07)
    ENABLE_SCHEDULER: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
