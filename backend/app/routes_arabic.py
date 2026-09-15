import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User
from app.models_learning import (
    Course,
    Module,
    Lesson,
    Enrollment,
    LessonCompletion,
    Quiz,
    QuizQuestion,
    QuizResult,
)
from app.schemas_learning import (
    CourseOut,
    CourseDetailOut,
    ModuleOut,
    LessonOut,
    QuizSummaryOut,
    QuizDetailOut,
    QuizQuestionPublicOut,
    QuizSubmission,
    QuizResultOut,
    QuizHistoryOut,
)
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


# --------------------------------- Quizzes -----------------------------------

@router.get("/quizzes", response_model=list[QuizSummaryOut])
def list_quizzes(db: Session = Depends(get_db)):
    quizzes = (
        db.query(Quiz)
        .join(Course, Quiz.course_id == Course.id)
        .filter(Course.is_published == True)  # noqa: E712
        .options(joinedload(Quiz.course), joinedload(Quiz.questions))
        .all()
    )
    return [
        QuizSummaryOut(
            id=q.id,
            title=q.title,
            course_title=q.course.title,
            course_slug=q.course.slug,
            question_count=len(q.questions),
        )
        for q in quizzes
    ]


@router.get("/quizzes/{quiz_id}", response_model=QuizDetailOut)
def get_quiz(quiz_id: str, db: Session = Depends(get_db)):
    quiz = (
        db.query(Quiz)
        .options(joinedload(Quiz.course), joinedload(Quiz.questions))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        course_title=quiz.course.title,
        questions=[
            QuizQuestionPublicOut(id=q.id, prompt=q.prompt, options=json.loads(q.options), order=q.order)
            for q in sorted(quiz.questions, key=lambda x: x.order)
        ],
    )


@router.post("/quizzes/{quiz_id}/submit", response_model=QuizResultOut)
def submit_quiz(
    quiz_id: str,
    payload: QuizSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user),
):
    quiz = db.query(Quiz).options(joinedload(Quiz.questions)).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = sorted(quiz.questions, key=lambda x: x.order)
    if len(payload.answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count doesn't match question count")

    correct = sum(1 for q, a in zip(questions, payload.answers) if a == q.correct_index)
    total = len(questions)
    score_pct = round(100 * correct / total) if total else 0

    db.add(QuizResult(user_id=current_user.id, quiz_id=quiz_id, score_pct=score_pct))
    db.commit()

    return QuizResultOut(quiz_id=quiz_id, quiz_title=quiz.title, score_pct=score_pct, correct_count=correct, total=total)


@router.get("/my-quiz-results", response_model=list[QuizHistoryOut])
def my_quiz_results(db: Session = Depends(get_db), current_user: User = Depends(_require_user)):
    results = (
        db.query(QuizResult)
        .filter(QuizResult.user_id == current_user.id)
        .order_by(QuizResult.taken_at.desc())
        .all()
    )
    out = []
    for r in results:
        quiz = db.query(Quiz).options(joinedload(Quiz.course)).filter(Quiz.id == r.quiz_id).first()
        if not quiz:
            continue
        out.append(
            QuizHistoryOut(
                quiz_id=r.quiz_id,
                quiz_title=quiz.title,
                course_title=quiz.course.title,
                score_pct=r.score_pct,
                taken_at=r.taken_at,
            )
        )
    return out
