"""
Arabic Learning + Admin Studio models.

Deliberately a separate module from models.py: everything here is a brand
new table, so Base.metadata.create_all() (still the only migration
mechanism in this project — see main.py) can create it safely on next
deploy. Nothing here touches the existing `users` table.

AdminUser is its own table rather than a role column on User for the same
reason: adding a column to an already-populated table needs a real ALTER
TABLE, which create_all() won't do. A new table sidesteps that entirely —
granting someone admin is just inserting a row.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    level = Column(String, nullable=False, default="beginner")  # beginner / intermediate / advanced
    is_published = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    modules = relationship(
        "Module", back_populates="course", order_by="Module.order", cascade="all, delete-orphan"
    )


class Module(Base):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    order = Column(Integer, default=0)

    course = relationship("Course", back_populates="modules")
    lessons = relationship(
        "Lesson", back_populates="module", order_by="Lesson.order", cascade="all, delete-orphan"
    )


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    module_id = Column(UUID(as_uuid=False), ForeignKey("modules.id"), nullable=False)
    title = Column(String, nullable=False)
    content_type = Column(String, nullable=False, default="text")  # text / video / audio
    content_url = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    order = Column(Integer, default=0)

    module = relationship("Module", back_populates="lessons")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)
    enrolled_at = Column(DateTime, default=datetime.utcnow)


class LessonCompletion(Base):
    __tablename__ = "lesson_completions"
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_completion_user_lesson"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    lesson_id = Column(UUID(as_uuid=False), ForeignKey("lessons.id"), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course")
    questions = relationship(
        "QuizQuestion", back_populates="quiz", order_by="QuizQuestion.order", cascade="all, delete-orphan"
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    quiz_id = Column(UUID(as_uuid=False), ForeignKey("quizzes.id"), nullable=False)
    prompt = Column(String, nullable=False)
    options = Column(Text, nullable=False)  # JSON-encoded list[str]
    correct_index = Column(Integer, nullable=False)
    order = Column(Integer, default=0)

    quiz = relationship("Quiz", back_populates="questions")


class QuizResult(Base):
    __tablename__ = "quiz_results"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    quiz_id = Column(UUID(as_uuid=False), ForeignKey("quizzes.id"), nullable=False)
    score_pct = Column(Integer, nullable=False)
    taken_at = Column(DateTime, default=datetime.utcnow)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, unique=True)
    role = Column(String, nullable=False, default="admin")  # admin / super_admin / content_manager
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
