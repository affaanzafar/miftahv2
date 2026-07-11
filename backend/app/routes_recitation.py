from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RecitationSession, WordAttempt, Ayah, Word, User
from app.schemas import (
    StartSessionRequest,
    SubmitAttemptRequest,
    SubmitAttemptResponse,
    WordResultOut,
    CompleteSessionResponse,
)
from app.correction import align_words, score_session
from app.routes_auth import get_current_user

router = APIRouter(prefix="/recitation", tags=["recitation"])


@router.post("/sessions", status_code=201)
def start_session(
    payload: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = RecitationSession(
        user_id=current_user.id,
        surah_id=payload.surah_id,
        start_ayah_number=payload.start_ayah_number,
        end_ayah_number=payload.end_ayah_number,
        is_review=payload.is_review,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id}


@router.post("/sessions/{session_id}/attempts", response_model=SubmitAttemptResponse)
def submit_attempt(
    session_id: str,
    payload: SubmitAttemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Call this once per ayah as the user finishes reciting it, with the raw
    transcript from the browser's speech recognizer (see frontend useSpeechRecognition
    hook). Runs the correction engine and stores per-word results.
    """
    session = db.query(RecitationSession).filter(RecitationSession.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    ayah = db.query(Ayah).filter(Ayah.id == payload.ayah_id).first()
    if not ayah:
        raise HTTPException(status_code=404, detail="Ayah not found")

    words = db.query(Word).filter(Word.ayah_id == ayah.id).order_by(Word.position).all()
    reference_words = [w.text_uthmani for w in words] or ayah.text_uthmani.split()
    recognized_words = payload.recognized_text.split()

    results = align_words(reference_words, recognized_words)
    ayah_accuracy = score_session(results)

    for r in results:
        db.add(
            WordAttempt(
                session_id=session.id,
                ayah_id=ayah.id,
                word_position=r.position,
                expected_text=r.expected,
                recognized_text=r.recognized,
                status=r.status,
            )
        )
    db.commit()

    return SubmitAttemptResponse(
        ayah_id=ayah.id,
        results=[WordResultOut(**vars(r)) for r in results],
        ayah_accuracy=ayah_accuracy,
    )


@router.post("/sessions/{session_id}/complete", response_model=CompleteSessionResponse)
def complete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(RecitationSession).filter(RecitationSession.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    attempts = db.query(WordAttempt).filter(WordAttempt.session_id == session.id).all()
    ref_count = sum(1 for a in attempts if a.status in ("correct", "wrong", "missed"))
    correct_count = sum(1 for a in attempts if a.status == "correct")
    accuracy = round(100 * correct_count / ref_count) if ref_count else 0

    session.accuracy_score = accuracy
    session.completed_at = datetime.utcnow()
    db.commit()

    return CompleteSessionResponse(
        session_id=session.id,
        accuracy_score=accuracy,
        completed_at=session.completed_at.isoformat(),
    )
