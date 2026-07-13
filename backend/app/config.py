from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central place for all environment-driven config.
    Values are loaded from .env in development; in production
    (Railway/Render) they come from real environment variables.
    """

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"

    # Cloudinary: used to sign direct-to-Cloudinary uploads from the browser,
    # so chat media never passes through this server. Empty strings are safe
    # defaults for local dev; production must set real values via Render env vars.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
