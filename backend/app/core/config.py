from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://dashcenat:dashcenat_dev@localhost:5432/dashcenat"
    JWT_SECRET: str = "trocar-em-producao"
    JWT_EXPIRE_MIN: int = 480
    JWT_ALGORITHM: str = "HS256"
    FERNET_KEY: str | None = None  # base64 urlsafe 32 bytes; gere com `Fernet.generate_key().decode()`
    ENABLE_SCHEDULER: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
