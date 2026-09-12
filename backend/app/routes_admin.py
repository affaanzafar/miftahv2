from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User
from app.models_learning import Course, Module, Lesson, Enrollment, Announcement, AdminUser
from app.schemas_learning import (
    CourseOut,
    CourseDetailOut,
    CourseCreate,
    ModuleOut,
    ModuleCreate,
    LessonOut,
    LessonCreate,
    AnnouncementOut,
    AnnouncementCreate,
    AdminUserOut,
    DashboardStats,
)
from app.routes_auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    is_admin = db.query(AdminUser).filter(AdminUser.user_id == current_user.id).first()
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/me")
def admin_whoami(current_user: User = Depends(require_admin)):
    return {"email": current_user.email, "display_name": current_user.display_name}


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return DashboardStats(
        total_users=db.query(User).count(),
        active_courses=db.query(Course).filter(Course.is_published == True).count(),  # noqa: E712
        total_enrollments=db.query(Enrollment).count(),
        published_announcements=db.query(Announcement)
        .filter(Announcement.is_published == True)  # noqa: E712
        .count(),
    )


# ------------------------------- Courses -----------------------------------

@router.get("/courses", response_model=list[CourseOut])
def list_all_courses(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    courses = db.query(Course).order_by(Course.order).all()
    return [
        CourseOut(
            id=c.id,
            title=c.title,
            slug=c.slug,
            description=c.description,
            level=c.level,
            is_published=c.is_published,
            lesson_count=sum(len(m.lessons) for m in c.modules),
        )
        for c in courses
    ]


@router.get("/courses/{course_id}/detail", response_model=CourseDetailOut)
def get_course_detail(course_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    course = (
        db.query(Course)
        .options(joinedload(Course.modules).joinedload(Module.lessons))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    modules_out = [
        ModuleOut(
            id=m.id,
            title=m.title,
            order=m.order,
            lessons=[
                LessonOut(
                    id=l.id,
                    title=l.title,
                    content_type=l.content_type,
                    content_url=l.content_url,
                    body=l.body,
                    order=l.order,
                    completed=False,
                )
                for l in sorted(m.lessons, key=lambda x: x.order)
            ],
        )
        for m in sorted(course.modules, key=lambda x: x.order)
    ]
    return CourseDetailOut(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        level=course.level,
        is_published=course.is_published,
        lesson_count=sum(len(m.lessons) for m in course.modules),
        modules=modules_out,
    )


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(payload: CourseCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if db.query(Course).filter(Course.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="That slug is already in use")
    course = Course(**payload.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseOut(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        level=course.level,
        is_published=course.is_published,
        lesson_count=0,
    )


@router.patch("/courses/{course_id}", response_model=CourseOut)
def update_course(
    course_id: str, payload: CourseCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for k, v in payload.model_dump().items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return CourseOut(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        level=course.level,
        is_published=course.is_published,
        lesson_count=sum(len(m.lessons) for m in course.modules),
    )


@router.post("/courses/{course_id}/publish", response_model=CourseOut)
def set_course_published(
    course_id: str, publish: bool = True, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.is_published = publish
    db.commit()
    db.refresh(course)
    return CourseOut(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        level=course.level,
        is_published=course.is_published,
        lesson_count=sum(len(m.lessons) for m in course.modules),
    )


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if course:
        db.delete(course)
        db.commit()


# ------------------------------- Modules ------------------------------------

@router.post("/courses/{course_id}/modules", response_model=ModuleOut, status_code=201)
def create_module(
    course_id: str, payload: ModuleCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    module = Module(course_id=course_id, **payload.model_dump())
    db.add(module)
    db.commit()
    db.refresh(module)
    return ModuleOut(id=module.id, title=module.title, order=module.order, lessons=[])


@router.delete("/modules/{module_id}", status_code=204)
def delete_module(module_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if module:
        db.delete(module)
        db.commit()


# ------------------------------- Lessons ------------------------------------

@router.post("/modules/{module_id}/lessons", response_model=LessonOut, status_code=201)
def create_lesson(
    module_id: str, payload: LessonCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    lesson = Lesson(module_id=module_id, **payload.model_dump())
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return LessonOut(
        id=lesson.id,
        title=lesson.title,
        content_type=lesson.content_type,
        content_url=lesson.content_url,
        body=lesson.body,
        order=lesson.order,
        completed=False,
    )


@router.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(lesson_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if lesson:
        db.delete(lesson)
        db.commit()


# ----------------------------- Announcements ---------------------------------

@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(Announcement).order_by(Announcement.created_at.desc()).all()


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    payload: AnnouncementCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    ann = Announcement(**payload.model_dump())
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@router.patch("/announcements/{ann_id}/publish", response_model=AnnouncementOut)
def set_announcement_published(
    ann_id: str, publish: bool = True, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    ann.is_published = publish
    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/announcements/{ann_id}", status_code=204)
def delete_announcement(ann_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if ann:
        db.delete(ann)
        db.commit()


# --------------------------------- Users --------------------------------------

@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    q: str | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    query = db.query(User)
    if q:
        query = query.filter(User.email.ilike(f"%{q}%"))
    return query.order_by(User.created_at.desc()).limit(100).all()


@router.post("/users/{user_id}/suspend", response_model=AdminUserOut)
def suspend_user(
    user_id: str,
    suspend: bool = True,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="You can't suspend your own account")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_active = not suspend
    db.commit()
    db.refresh(target)
    return target
