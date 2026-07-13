from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app import models  # noqa: F401  (ensures models are registered on Base before create_all)
from app.routes_auth import router as auth_router
from app.routes_quran import router as quran_router
from app.routes_recitation import router as recitation_router
from app.routes_hifz import router as hifz_router
from app.routes_community import router as community_router
from app.routes_miftah_method import router as miftah_method_router
from app.routes_social import router as social_router
from app.routes_media import router as media_router
from app.routes_stt import router as stt_router

app = FastAPI(title="Miftah API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(quran_router)
app.include_router(recitation_router)
app.include_router(hifz_router)
app.include_router(community_router)
app.include_router(miftah_method_router)
app.include_router(social_router)
app.include_router(media_router)
app.include_router(stt_router)


@app.on_event("startup")
def on_startup():
    # For Phase 0 we create tables directly. Once the schema stabilizes,
    # switch to Alembic migrations (already scaffolded via requirements.txt)
    # instead of create_all, so future changes are versioned.
    Base.metadata.create_all(bind=engine)

    from app.seed_data import seed_if_empty

    seed_if_empty()


@app.get("/health")
def health_check():
    return {"status": "ok"}
