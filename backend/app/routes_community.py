from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StudyCircle, CircleMembership, Report, User, MemorizationProgress
from app.schemas import CircleCreate, CircleOut, ReportCreate
from app.routes_auth import get_current_user

router = APIRouter(prefix="/community", tags=["community"])


@router.post("/circles", response_model=CircleOut, status_code=201)
def create_circle(
    payload: CircleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = StudyCircle(
        name=payload.name,
        description=payload.description,
        is_private=payload.is_private,
        created_by=current_user.id,
    )
    db.add(circle)
    db.commit()
    db.refresh(circle)

    db.add(CircleMembership(circle_id=circle.id, user_id=current_user.id, role="owner"))
    db.commit()

    return _to_circle_out(circle, db)


@router.get("/circles", response_model=list[CircleOut])
def list_my_circles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = db.query(CircleMembership).filter(CircleMembership.user_id == current_user.id).all()
    circles = [db.query(StudyCircle).filter(StudyCircle.id == m.circle_id).first() for m in memberships]
    return [_to_circle_out(c, db) for c in circles if c]


@router.post("/circles/{circle_id}/join", status_code=201)
def join_circle(
    circle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(StudyCircle).filter(StudyCircle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")

    existing = (
        db.query(CircleMembership)
        .filter(CircleMembership.circle_id == circle_id, CircleMembership.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")

    db.add(CircleMembership(circle_id=circle_id, user_id=current_user.id, role="member"))
    db.commit()
    return {"status": "joined"}


@router.get("/circles/{circle_id}/progress")
def circle_progress(
    circle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simple progress-sharing feed: each member's memorized-ayah count, for streaks/milestones."""
    members = db.query(CircleMembership).filter(CircleMembership.circle_id == circle_id).all()
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this circle")

    feed = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        memorized_count = (
            db.query(MemorizationProgress)
            .filter(MemorizationProgress.user_id == m.user_id, MemorizationProgress.status == "memorized")
            .count()
        )
        feed.append(
            {
                "user_id": m.user_id,
                "display_name": user.display_name if user else None,
                "memorized_ayah_count": memorized_count,
                "role": m.role,
            }
        )
    return feed


@router.post("/circles/{circle_id}/report", status_code=201)
def report_member(
    circle_id: str,
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = Report(
        circle_id=circle_id,
        reported_by=current_user.id,
        reported_user=payload.reported_user,
        reason=payload.reason,
    )
    db.add(report)
    db.commit()
    return {"status": "reported"}


@router.post("/circles/{circle_id}/members/{user_id}/remove")
def remove_member(
    circle_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Only the circle owner/moderator can remove a member — minimal moderation tooling."""
    acting_membership = (
        db.query(CircleMembership)
        .filter(CircleMembership.circle_id == circle_id, CircleMembership.user_id == current_user.id)
        .first()
    )
    if not acting_membership or acting_membership.role not in ("owner", "moderator"):
        raise HTTPException(status_code=403, detail="Not authorized to remove members")

    target = (
        db.query(CircleMembership)
        .filter(CircleMembership.circle_id == circle_id, CircleMembership.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(target)
    db.commit()
    return {"status": "removed"}


def _to_circle_out(circle: StudyCircle, db: Session) -> CircleOut:
    count = db.query(CircleMembership).filter(CircleMembership.circle_id == circle.id).count()
    return CircleOut(
        id=circle.id,
        name=circle.name,
        description=circle.description,
        is_private=circle.is_private,
        member_count=count,
    )
