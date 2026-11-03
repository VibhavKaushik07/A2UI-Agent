from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./learning.db"
    openai_api_key: str = ""
    openai_model: str = "gpt-6-luna"
    openai_reasoning_effort: Literal["none", "low", "medium", "high"] = "low"
    demo_mode: bool = True
    model_timeout: float = 45


settings = Settings()
