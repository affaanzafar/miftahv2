from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StudyCircle, CircleMembership, Report, User, MemorizationProgress, CircleMessage
from app.schemas import CircleCreate, CircleOut, ReportCreate, CircleInvite, CircleMemberOut, MessageCreate, MessageOut
from app.routes_auth import get_current_user

router = APIRouter(prefix="/community", tags=["community"])


def _require_membership(db: Session, circle_id: str, user_id: str) -> CircleMembership:
    membership = (
        db.query(CircleMembership)
        .filter(CircleMembership.circle_id == circle_id, CircleMembership.user_id == user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this circle")
    return membership


@router.post("/circles/{circle_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    circle_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_membership(db, circle_id, current_user.id)

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    if len(body) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long")

    msg = CircleMessage(circle_id=circle_id, user_id=current_user.id, body=body)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return MessageOut(
        id=msg.id,
        circle_id=msg.circle_id,
        user_id=msg.user_id,
        display_name=current_user.display_name,
        body=msg.body,
        created_at=msg.created_at.isoformat(),
    )


@router.get("/circles/{circle_id}/messages", response_model=list[MessageOut])
def list_messages(
    circle_id: str,
    after_id: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_membership(db, circle_id, current_user.id)

    query = db.query(CircleMessage).filter(CircleMessage.circle_id == circle_id)
    if after_id:
        query = query.filter(CircleMessage.id > after_id)
    messages = query.order_by(CircleMessage.id.asc()).limit(200).all()

    out = []
    for m in messages:
        user = db.query(User).filter(User.id == m.user_id).first()
        out.append(
            MessageOut(
                id=m.id,
                circle_id=m.circle_id,
                user_id=m.user_id,
                display_name=user.display_name if user else None,
                body=m.body,
                created_at=m.created_at.isoformat(),
            )
        )
    return out


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


@router.get("/circles/discover", response_model=list[CircleOut])
def discover_circles(
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Public circles the current user hasn't joined yet, optionally filtered by name."""
    joined_ids = {
        m.circle_id
        for m in db.query(CircleMembership).filter(CircleMembership.user_id == current_user.id).all()
    }
    query = db.query(StudyCircle).filter(StudyCircle.is_private == False)  # noqa: E712
    if q:
        query = query.filter(StudyCircle.name.ilike(f"%{q}%"))
    circles = [c for c in query.order_by(StudyCircle.created_at.desc()).all() if c.id not in joined_ids]
    return [_to_circle_out(c, db) for c in circles]


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


@router.post("/circles/{circle_id}/invite", response_model=CircleMemberOut, status_code=201)
def invite_member(
    circle_id: str,
    payload: CircleInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add someone to the circle by email. Any current member can invite —
    a study circle is meant to grow through its members, not gatekept by one owner."""
    acting_membership = (
        db.query(CircleMembership)
        .filter(CircleMembership.circle_id == circle_id, CircleMembership.user_id == current_user.id)
        .first()
    )
    if not acting_membership:
        raise HTTPException(status_code=403, detail="Only members of this circle can invite others")

    target_user = db.query(User).filter(User.email == payload.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="No Miftah account found with that email")

    existing = (
        db.query(CircleMembership)
        .filter(CircleMembership.circle_id == circle_id, CircleMembership.user_id == target_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="They're already a member of this circle")

    membership = CircleMembership(circle_id=circle_id, user_id=target_user.id, role="member")
    db.add(membership)
    db.commit()

    return CircleMemberOut(
        user_id=target_user.id,
        display_name=target_user.display_name,
        role=membership.role,
        memorized_ayah_count=0,
    )


@router.get("/circles/{circle_id}/progress", response_model=list[CircleMemberOut])
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
            CircleMemberOut(
                user_id=m.user_id,
                display_name=user.display_name if user else None,
                memorized_ayah_count=memorized_count,
                role=m.role,
            )
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
