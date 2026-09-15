from datetime import datetime

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Lessons / Modules / Courses
# ---------------------------------------------------------------------------

class LessonOut(BaseModel):
    id: str
    title: str
    content_type: str
    content_url: str | None = None
    body: str | None = None
    order: int
    completed: bool = False

    class Config:
        from_attributes = True


class LessonCreate(BaseModel):
    title: str
    content_type: str = "text"
    content_url: str | None = None
    body: str | None = None
    order: int = 0


class ModuleOut(BaseModel):
    id: str
    title: str
    order: int
    lessons: list[LessonOut] = []

    class Config:
        from_attributes = True


class ModuleCreate(BaseModel):
    title: str
    order: int = 0


class CourseOut(BaseModel):
    id: str
    title: str
    slug: str
    description: str | None = None
    level: str
    is_published: bool
    lesson_count: int = 0
    enrolled: bool = False
    progress_pct: int = 0

    class Config:
        from_attributes = True


class CourseDetailOut(CourseOut):
    modules: list[ModuleOut] = []


class CourseCreate(BaseModel):
    title: str
    slug: str
    description: str | None = None
    level: str = "beginner"


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

class AnnouncementOut(BaseModel):
    id: str
    title: str
    body: str
    image_url: str | None = None
    is_published: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    image_url: str | None = None
    is_published: bool = False


# ---------------------------------------------------------------------------
# Quizzes
# ---------------------------------------------------------------------------

class QuizQuestionCreate(BaseModel):
    prompt: str
    options: list[str]
    correct_index: int
    order: int = 0


class QuizCreate(BaseModel):
    title: str
    questions: list[QuizQuestionCreate]


class QuizQuestionPublicOut(BaseModel):
    """No correct_index — this is what a person taking the quiz sees."""
    id: str
    prompt: str
    options: list[str]
    order: int


class QuizSummaryOut(BaseModel):
    id: str
    title: str
    course_title: str
    course_slug: str
    question_count: int


class QuizDetailOut(BaseModel):
    id: str
    title: str
    course_title: str
    questions: list[QuizQuestionPublicOut]


class QuizSubmission(BaseModel):
    answers: list[int]


class QuizResultOut(BaseModel):
    quiz_id: str
    quiz_title: str
    score_pct: int
    correct_count: int
    total: int


class QuizHistoryOut(BaseModel):
    quiz_id: str
    quiz_title: str
    course_title: str
    score_pct: int
    taken_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Admin / users
# ---------------------------------------------------------------------------

class AdminUserOut(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_users: int
    active_courses: int
    total_enrollments: int
    published_announcements: int
