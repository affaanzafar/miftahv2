from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MemorizationProgress, RecitationSession, Goal, User
from app.schemas import ProgressOut, GoalCreate, GoalOut
from app.routes_auth import get_current_user
from app.spaced_repetition import sm2_update, accuracy_to_quality

router = APIRouter(prefix="/hifz", tags=["hifz"])


@router.get("/due", response_model=list[ProgressOut])
def get_due_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ayahs whose SM-2 due_at has passed — what the daily review session should cover."""
    now = datetime.utcnow()
    rows = (
        db.query(MemorizationProgress)
        .filter(
            MemorizationProgress.user_id == current_user.id,
            MemorizationProgress.due_at <= now,
        )
        .all()
    )
    return [_to_progress_out(r) for r in rows]


@router.get("/progress", response_model=list[ProgressOut])
def get_all_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(MemorizationProgress).filter(MemorizationProgress.user_id == current_user.id).all()
    return [_to_progress_out(r) for r in rows]


@router.post("/ayahs/{ayah_id}/mark-learning", response_model=ProgressOut)
def mark_learning(
    ayah_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start tracking an ayah for memorization (status 'learning', due immediately)."""
    row = (
        db.query(MemorizationProgress)
        .filter(MemorizationProgress.user_id == current_user.id, MemorizationProgress.ayah_id == ayah_id)
        .first()
    )
    if not row:
        row = MemorizationProgress(user_id=current_user.id, ayah_id=ayah_id)
        db.add(row)
    row.status = "learning"
    row.due_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _to_progress_out(row)


@router.post("/sessions/{session_id}/apply-review", response_model=list[ProgressOut])
def apply_review(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Feeds a completed recitation session's per-ayah accuracy into the SM-2
    scheduler. This is the wiring described in the roadmap: a 'review' is a
    scored recitation session, not a separate manual checkbox.
    """
    session = db.query(RecitationSession).filter(RecitationSession.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.accuracy_score is None:
        raise HTTPException(status_code=400, detail="Session is not complete yet")

    quality = accuracy_to_quality(session.accuracy_score)
    updated = []

    for ayah_num in range(session.start_ayah_number, session.end_ayah_number + 1):
        from app.models import Ayah

        ayah = (
            db.query(Ayah)
            .filter(Ayah.surah_id == session.surah_id, Ayah.ayah_number == ayah_num)
            .first()
        )
        if not ayah:
            continue

        row = (
            db.query(MemorizationProgress)
            .filter(MemorizationProgress.user_id == current_user.id, MemorizationProgress.ayah_id == ayah.id)
            .first()
        )
        if not row:
            row = MemorizationProgress(user_id=current_user.id, ayah_id=ayah.id, status="learning")
            db.add(row)
            db.flush()

        next_state = sm2_update(row.repetitions, row.ease_factor, row.interval_days, quality)
        row.repetitions = next_state["repetitions"]
        row.ease_factor = next_state["ease_factor"]
        row.interval_days = next_state["interval_days"]
        row.due_at = next_state["due_at"]
        row.last_reviewed_at = next_state["last_reviewed_at"]
        if quality >= 4 and row.repetitions >= 2:
            row.status = "memorized"

        updated.append(row)

    db.commit()
    return [_to_progress_out(r) for r in updated]


@router.post("/goals", response_model=GoalOut, status_code=201)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(
        user_id=current_user.id,
        title=payload.title,
        target_surah_id=payload.target_surah_id,
        target_juz=payload.target_juz,
        target_date=datetime.fromisoformat(payload.target_date) if payload.target_date else None,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_goal_out(goal)


@router.get("/goals", response_model=list[GoalOut])
def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = db.query(Goal).filter(Goal.user_id == current_user.id).all()
    return [_to_goal_out(g) for g in goals]


def _to_progress_out(row: MemorizationProgress) -> ProgressOut:
    return ProgressOut(
        ayah_id=row.ayah_id,
        status=row.status,
        repetitions=row.repetitions,
        interval_days=row.interval_days,
        due_at=row.due_at.isoformat() if row.due_at else None,
    )


def _to_goal_out(goal: Goal) -> GoalOut:
    return GoalOut(
        id=goal.id,
        title=goal.title,
        target_surah_id=goal.target_surah_id,
        target_juz=goal.target_juz,
        target_date=goal.target_date.isoformat() if goal.target_date else None,
    )
