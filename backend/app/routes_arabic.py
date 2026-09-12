from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User
from app.models_learning import Course, Module, Lesson, Enrollment, LessonCompletion
from app.schemas_learning import CourseOut, CourseDetailOut, ModuleOut, LessonOut
from app.auth import decode_access_token

router = APIRouter(prefix="/arabic", tags=["arabic"])

# Same auth scheme as the rest of the app, but auto_error=False: course
# browsing works for guests (matching the guest-recitation pattern Miftah
# already has), and just gets personalized (enrolled/progress) if a valid
# token is present.
_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user_optional(
    token: str | None = Depends(_optional_oauth2), db: Session = Depends(get_db)
) -> User | None:
    if not token:
        return None
    user_id = decode_access_token(token)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def _require_user(token: str | None = Depends(_optional_oauth2), db: Session = Depends(get_db)) -> User:
    user = get_current_user_optional(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to do that")
    return user


@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    courses = (
        db.query(Course)
        .filter(Course.is_published == True)  # noqa: E712
        .order_by(Course.order)
        .options(joinedload(Course.modules).joinedload(Module.lessons))
        .all()
    )

    completed_ids: set[str] = set()
    enrolled_course_ids: set[str] = set()
    if current_user:
        completed_ids = {
            row.lesson_id for row in db.query(LessonCompletion).filter_by(user_id=current_user.id).all()
        }
        enrolled_course_ids = {
            row.course_id for row in db.query(Enrollment).filter_by(user_id=current_user.id).all()
        }

    out = []
    for c in courses:
        lesson_ids = [l.id for m in c.modules for l in m.lessons]
        progress_pct = 0
        if lesson_ids:
            done = len([lid for lid in lesson_ids if lid in completed_ids])
            progress_pct = round(100 * done / len(lesson_ids))
        out.append(
            CourseOut(
                id=c.id,
                title=c.title,
                slug=c.slug,
                description=c.description,
                level=c.level,
                is_published=c.is_published,
                lesson_count=len(lesson_ids),
                enrolled=c.id in enrolled_course_ids,
                progress_pct=progress_pct,
            )
        )
    return out


@router.get("/courses/{slug}", response_model=CourseDetailOut)
def get_course(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    course = (
        db.query(Course)
        .options(joinedload(Course.modules).joinedload(Module.lessons))
        .filter(Course.slug == slug, Course.is_published == True)  # noqa: E712
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    completed_ids: set[str] = set()
    enrolled = False
    if current_user:
        completed_ids = {
            row.lesson_id for row in db.query(LessonCompletion).filter_by(user_id=current_user.id).all()
        }
        enrolled = (
            db.query(Enrollment).filter_by(user_id=current_user.id, course_id=course.id).first()
            is not None
        )

    modules_out = []
    total, done = 0, 0
    for m in sorted(course.modules, key=lambda x: x.order):
        lessons_out = []
        for l in sorted(m.lessons, key=lambda x: x.order):
            total += 1
            is_done = l.id in completed_ids
            if is_done:
                done += 1
            lessons_out.append(
                LessonOut(
                    id=l.id,
                    title=l.title,
                    content_type=l.content_type,
                    content_url=l.content_url,
                    body=l.body,
                    order=l.order,
                    completed=is_done,
                )
            )
        modules_out.append(ModuleOut(id=m.id, title=m.title, order=m.order, lessons=lessons_out))

    return CourseDetailOut(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        level=course.level,
        is_published=course.is_published,
        lesson_count=total,
        enrolled=enrolled,
        progress_pct=round(100 * done / total) if total else 0,
        modules=modules_out,
    )


@router.post("/courses/{slug}/enroll", status_code=204)
def enroll(slug: str, db: Session = Depends(get_db), current_user: User = Depends(_require_user)):
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    existing = db.query(Enrollment).filter_by(user_id=current_user.id, course_id=course.id).first()
    if not existing:
        db.add(Enrollment(user_id=current_user.id, course_id=course.id))
        db.commit()


@router.post("/lessons/{lesson_id}/complete", status_code=204)
def complete_lesson(lesson_id: str, db: Session = Depends(get_db), current_user: User = Depends(_require_user)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    existing = db.query(LessonCompletion).filter_by(user_id=current_user.id, lesson_id=lesson_id).first()
    if not existing:
        db.add(LessonCompletion(user_id=current_user.id, lesson_id=lesson_id))

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    already_enrolled = (
        db.query(Enrollment).filter_by(user_id=current_user.id, course_id=module.course_id).first()
    )
    if not already_enrolled:
        db.add(Enrollment(user_id=current_user.id, course_id=module.course_id))

    db.commit()
