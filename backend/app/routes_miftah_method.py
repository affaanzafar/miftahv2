"""
The Miftah Method: a guided, forced-cadence memorization flow.

For a chosen ayah range, each ayah goes through three phases before the
session moves on to the next one:

  1. repeat     — ayah text stays visible. The learner recites it aloud 4
                   times; each attempt is checked against the reference text
                   (a lenient threshold — this step is about the physical
                   repetition, not gatekeeping accuracy) so it can't be
                   clicked through without actually reciting.
  2. recall     — text is hidden. The learner recites that ayah alone,
                   from memory, and the loop repeats until the accuracy is
                   high enough to call it fluent.
  3. cumulative — text is hidden. The learner recites every ayah mastered so
                   far *in this session* (start..current) back to back, from
                   memory, looping until fluent.

Only once cumulative passes does current_ayah_number advance and the cycle
restart for the next ayah — which is the point of the method: ayah 2 is
never considered "done" until it can be recited together with ayah 1, ayah 3
together with 1 and 2, and so on.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import MiftahMethodSession, Surah, Ayah, MemorizationProgress, User
from app.schemas import (
    MiftahMethodStartRequest,
    MiftahMethodAttemptRequest,
    MiftahMethodAttemptResponse,
    MiftahMethodSessionOut,
    MiftahMethodSessionDetailOut,
    WordResultOut,
)
from app.correction import align_words, score_session
from app.spaced_repetition import sm2_update, accuracy_to_quality
from app.routes_auth import get_current_user

router = APIRouter(prefix="/miftah-method", tags=["miftah-method"])

REPEAT_REQUIRED = 4
REPEAT_PASS_THRESHOLD = 60   # lenient — text is visible, this step just confirms it was recited
FLUENCY_THRESHOLD = 95       # strict — this is the "fluent by memory" bar


@router.post("/sessions", response_model=MiftahMethodSessionDetailOut, status_code=201)
def start_session(
    payload: MiftahMethodStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.end_ayah_number < payload.start_ayah_number:
        raise HTTPException(status_code=400, detail="End ayah must be on or after the start ayah")

    surah = db.query(Surah).filter(Surah.id == payload.surah_id).first()
    if not surah:
        raise HTTPException(status_code=404, detail="Surah not found")

    session = MiftahMethodSession(
        user_id=current_user.id,
        surah_id=payload.surah_id,
        start_ayah_number=payload.start_ayah_number,
        end_ayah_number=payload.end_ayah_number,
        current_ayah_number=payload.start_ayah_number,
        phase="repeat",
        repeat_count=0,
        attempt_count=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _to_detail(session, db)


@router.get("/sessions/{session_id}", response_model=MiftahMethodSessionDetailOut)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(db, session_id, current_user)
    return _to_detail(session, db)


@router.get("/sessions", response_model=list[MiftahMethodSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(MiftahMethodSession)
        .filter(MiftahMethodSession.user_id == current_user.id)
        .order_by(MiftahMethodSession.created_at.desc())
        .all()
    )
    return rows


@router.post("/sessions/{session_id}/attempt", response_model=MiftahMethodAttemptResponse)
def submit_attempt(
    session_id: str,
    payload: MiftahMethodAttemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(db, session_id, current_user)
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This session is already complete")

    current_ayah = _get_ayah(db, session.surah_id, session.current_ayah_number)

    if session.phase == "cumulative":
        reference_words = _range_words(db, session.surah_id, session.start_ayah_number, session.current_ayah_number)
    else:
        reference_words = [w.text_uthmani for w in current_ayah.words] or current_ayah.text_uthmani.split()

    recognized_words = payload.recognized_text.split()
    results = align_words(reference_words, recognized_words)
    accuracy = score_session(results)

    threshold = REPEAT_PASS_THRESHOLD if session.phase == "repeat" else FLUENCY_THRESHOLD
    passed = accuracy >= threshold

    message = _apply_transition(db, session, current_ayah, accuracy, passed, current_user)

    db.commit()
    db.refresh(session)

    return MiftahMethodAttemptResponse(
        session=MiftahMethodSessionOut.model_validate(session),
        results=[WordResultOut(**vars(r)) for r in results],
        accuracy=accuracy,
        passed=passed,
        message=message,
    )


def _apply_transition(db, session, current_ayah, accuracy: int, passed: bool, current_user: User) -> str:
    session.updated_at = datetime.utcnow()

    if session.phase == "repeat":
        session.attempt_count += 1
        if passed:
            session.repeat_count += 1
            if session.repeat_count >= REPEAT_REQUIRED:
                session.phase = "recall"
                session.attempt_count = 0
                return "Fourth repetition done. Now cover the text and recite it from memory."
            return f"Repetition {session.repeat_count} of {REPEAT_REQUIRED} recorded — recite it again."
        return "That didn't match closely enough — read the ayah aloud again before the next repetition counts."

    if session.phase == "recall":
        session.attempt_count += 1
        if passed:
            _mark_memorized(db, current_user, current_ayah, accuracy)
            if session.current_ayah_number == session.start_ayah_number:
                # nothing earlier in the range to combine it with yet
                return _advance(session) or "Memorized. Moving to the next ayah."
            session.phase = "cumulative"
            session.attempt_count = 0
            return "Fluent on its own. Now recite it together with everything before it in this session."
        hint = " Consider repeating it aloud a few more times if this keeps happening." if session.attempt_count >= 3 else ""
        return f"Not quite fluent yet from memory ({accuracy}%) — try again.{hint}"

    # cumulative
    session.attempt_count += 1
    if passed:
        done_message = _advance(session)
        return done_message or "Fluent across the whole set so far. Moving to the next ayah."
    hint = " If it keeps slipping, that's normal — a couple more passes usually fixes it." if session.attempt_count >= 3 else ""
    return f"Close, but not fluent across the full set yet ({accuracy}%) — recite the whole set again.{hint}"


def _advance(session: MiftahMethodSession) -> str | None:
    session.current_ayah_number += 1
    if session.current_ayah_number > session.end_ayah_number:
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        return "Session complete — every ayah in this range is memorized, individually and together."
    session.phase = "repeat"
    session.repeat_count = 0
    session.attempt_count = 0
    return None


def _mark_memorized(db: Session, user: User, ayah: Ayah, accuracy: int):
    row = (
        db.query(MemorizationProgress)
        .filter(MemorizationProgress.user_id == user.id, MemorizationProgress.ayah_id == ayah.id)
        .first()
    )
    if not row:
        row = MemorizationProgress(user_id=user.id, ayah_id=ayah.id)
        db.add(row)
        db.flush()

    quality = accuracy_to_quality(accuracy)
    next_state = sm2_update(row.repetitions, row.ease_factor, row.interval_days, quality)
    row.repetitions = next_state["repetitions"]
    row.ease_factor = next_state["ease_factor"]
    row.interval_days = next_state["interval_days"]
    row.due_at = next_state["due_at"]
    row.last_reviewed_at = next_state["last_reviewed_at"]
    row.status = "memorized"  # a passed recall attempt under the Miftah Method IS the mastery signal


def _get_owned_session(db: Session, session_id: str, current_user: User) -> MiftahMethodSession:
    session = db.query(MiftahMethodSession).filter(MiftahMethodSession.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _get_ayah(db: Session, surah_id: int, ayah_number: int) -> Ayah:
    ayah = (
        db.query(Ayah)
        .options(joinedload(Ayah.words))
        .filter(Ayah.surah_id == surah_id, Ayah.ayah_number == ayah_number)
        .first()
    )
    if not ayah:
        raise HTTPException(status_code=404, detail="Ayah not found")
    return ayah


def _range_words(db: Session, surah_id: int, start: int, end: int) -> list[str]:
    ayahs = (
        db.query(Ayah)
        .options(joinedload(Ayah.words))
        .filter(Ayah.surah_id == surah_id, Ayah.ayah_number >= start, Ayah.ayah_number <= end)
        .order_by(Ayah.ayah_number)
        .all()
    )
    words: list[str] = []
    for a in ayahs:
        words.extend([w.text_uthmani for w in a.words] or a.text_uthmani.split())
    return words


def _to_detail(session: MiftahMethodSession, db: Session) -> MiftahMethodSessionDetailOut:
    surah = db.query(Surah).filter(Surah.id == session.surah_id).first()
    ayahs = (
        db.query(Ayah)
        .options(joinedload(Ayah.words))
        .filter(
            Ayah.surah_id == session.surah_id,
            Ayah.ayah_number >= session.start_ayah_number,
            Ayah.ayah_number <= session.end_ayah_number,
        )
        .order_by(Ayah.ayah_number)
        .all()
    )
    return MiftahMethodSessionDetailOut(
        id=session.id,
        surah_id=session.surah_id,
        start_ayah_number=session.start_ayah_number,
        end_ayah_number=session.end_ayah_number,
        current_ayah_number=session.current_ayah_number,
        phase=session.phase,
        repeat_count=session.repeat_count,
        attempt_count=session.attempt_count,
        status=session.status,
        surah=surah,
        ayahs=ayahs,
    )
