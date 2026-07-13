from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Follow, MemorizationProgress, RecitationSession
from app.schemas import UserPublicOut, ProfileOut
from app.routes_auth import get_current_user

router = APIRouter(prefix="/social", tags=["social"])


def _memorized_count(db: Session, user_id: str) -> int:
    return (
        db.query(MemorizationProgress)
        .filter(MemorizationProgress.user_id == user_id, MemorizationProgress.status == "memorized")
        .count()
    )


def _follower_count(db: Session, user_id: str) -> int:
    return db.query(Follow).filter(Follow.followed_id == user_id).count()


def _following_count(db: Session, user_id: str) -> int:
    return db.query(Follow).filter(Follow.follower_id == user_id).count()


def _current_streak_days(db: Session, user_id: str) -> int:
    """Consecutive days (ending today or yesterday) with at least one
    completed recitation session."""
    sessions = (
        db.query(RecitationSession)
        .filter(RecitationSession.user_id == user_id, RecitationSession.completed_at.isnot(None))
        .order_by(RecitationSession.completed_at.desc())
        .all()
    )
    if not sessions:
        return 0
    days = sorted({s.completed_at.date() for s in sessions}, reverse=True)
    today = datetime.utcnow().date()
    if days[0] not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    for i in range(1, len(days)):
        if (days[i - 1] - days[i]).days == 1:
            streak += 1
        else:
            break
    return streak


def _to_public_out(db: Session, user: User, following_ids: set[str]) -> UserPublicOut:
    return UserPublicOut(
        id=user.id,
        display_name=user.display_name,
        is_following=user.id in following_ids,
        follower_count=_follower_count(db, user.id),
        following_count=_following_count(db, user.id),
        memorized_ayah_count=_memorized_count(db, user.id),
    )


def _my_following_ids(db: Session, user_id: str) -> set[str]:
    return {f.followed_id for f in db.query(Follow).filter(Follow.follower_id == user_id).all()}


@router.get("/users/search", response_model=list[UserPublicOut])
def search_users(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q) < 2:
        return []
    users = (
        db.query(User)
        .filter(User.display_name.ilike(f"%{q}%"), User.id != current_user.id)
        .limit(20)
        .all()
    )
    following_ids = _my_following_ids(db, current_user.id)
    return [_to_public_out(db, u, following_ids) for u in users]


@router.post("/users/{user_id}/follow", status_code=201)
def follow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't follow yourself")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == current_user.id, Follow.followed_id == user_id)
        .first()
    )
    if existing:
        return {"status": "already following"}

    db.add(Follow(follower_id=current_user.id, followed_id=user_id))
    db.commit()
    return {"status": "following"}


@router.post("/users/{user_id}/unfollow")
def unfollow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == current_user.id, Follow.followed_id == user_id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
    return {"status": "unfollowed"}


@router.get("/users/{user_id}/followers", response_model=list[UserPublicOut])
def list_followers(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    follows = db.query(Follow).filter(Follow.followed_id == user_id).all()
    following_ids = _my_following_ids(db, current_user.id)
    out = []
    for f in follows:
        u = db.query(User).filter(User.id == f.follower_id).first()
        if u:
            out.append(_to_public_out(db, u, following_ids))
    return out


@router.get("/users/{user_id}/following", response_model=list[UserPublicOut])
def list_following(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    follows = db.query(Follow).filter(Follow.follower_id == user_id).all()
    following_ids = _my_following_ids(db, current_user.id)
    out = []
    for f in follows:
        u = db.query(User).filter(User.id == f.followed_id).first()
        if u:
            out.append(_to_public_out(db, u, following_ids))
    return out


@router.get("/me/profile", response_model=ProfileOut)
def my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProfileOut(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        follower_count=_follower_count(db, current_user.id),
        following_count=_following_count(db, current_user.id),
        memorized_ayah_count=_memorized_count(db, current_user.id),
        current_streak_days=_current_streak_days(db, current_user.id),
    )
