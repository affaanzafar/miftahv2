from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Surah, Ayah
from app.schemas import SurahOut, SurahDetailOut, AyahOut

router = APIRouter(prefix="/quran", tags=["quran"])


@router.get("/surahs", response_model=list[SurahOut])
def list_surahs(db: Session = Depends(get_db)):
    return db.query(Surah).order_by(Surah.id).all()


@router.get("/surahs/{surah_id}", response_model=SurahDetailOut)
def get_surah(surah_id: int, db: Session = Depends(get_db)):
    surah = (
        db.query(Surah)
        .options(joinedload(Surah.ayahs).joinedload(Ayah.words))
        .filter(Surah.id == surah_id)
        .first()
    )
    if not surah:
        raise HTTPException(status_code=404, detail="Surah not found")
    return surah


@router.get("/surahs/{surah_id}/ayahs/{ayah_number}", response_model=AyahOut)
def get_ayah(surah_id: int, ayah_number: int, db: Session = Depends(get_db)):
    ayah = (
        db.query(Ayah)
        .options(joinedload(Ayah.words))
        .filter(Ayah.surah_id == surah_id, Ayah.ayah_number == ayah_number)
        .first()
    )
    if not ayah:
        raise HTTPException(status_code=404, detail="Ayah not found")
    return ayah
