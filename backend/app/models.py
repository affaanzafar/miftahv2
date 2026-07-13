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


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Surah(Base):
    """One of the 114 chapters of the Quran. Seeded once from Quran.com/Tanzil data."""

    __tablename__ = "surahs"

    id = Column(Integer, primary_key=True)  # 1-114, matches Quran numbering
    name_arabic = Column(String, nullable=False)
    name_transliteration = Column(String, nullable=False)
    name_translation = Column(String, nullable=False)
    revelation_place = Column(String, nullable=True)  # "meccan" / "medinan"
    ayah_count = Column(Integer, nullable=False)

    ayahs = relationship("Ayah", back_populates="surah", order_by="Ayah.ayah_number")


class Ayah(Base):
    """A single verse. text_uthmani is the reference text used for correction/alignment."""

    __tablename__ = "ayahs"

    id = Column(Integer, primary_key=True)  # global ayah index, 1-6236
    surah_id = Column(Integer, ForeignKey("surahs.id"), nullable=False)
    ayah_number = Column(Integer, nullable=False)  # number within the surah
    text_uthmani = Column(Text, nullable=False)
    text_simple = Column(Text, nullable=True)  # no diacritics, useful for fuzzy matching
    juz = Column(Integer, nullable=True)
    page = Column(Integer, nullable=True)

    surah = relationship("Surah", back_populates="ayahs")
    words = relationship("Word", back_populates="ayah", order_by="Word.position")

    __table_args__ = (UniqueConstraint("surah_id", "ayah_number", name="uq_surah_ayah"),)


class Word(Base):
    """Word-by-word segmentation of an ayah. Powers word-level highlighting and mistake flagging."""

    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ayah_id = Column(Integer, ForeignKey("ayahs.id"), nullable=False)
    position = Column(Integer, nullable=False)  # 1-indexed position within the ayah
    text_uthmani = Column(String, nullable=False)
    transliteration = Column(String, nullable=True)

    ayah = relationship("Ayah", back_populates="words")


class Reciter(Base):
    __tablename__ = "reciters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    style = Column(String, nullable=True)  # e.g. "murattal", "mujawwad"
    source = Column(String, nullable=True)  # e.g. "everyayah"


class AyahAudio(Base):
    """Reference recitation audio for an ayah, mirrored locally from Everyayah."""

    __tablename__ = "ayah_audio"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ayah_id = Column(Integer, ForeignKey("ayahs.id"), nullable=False)
    reciter_id = Column(Integer, ForeignKey("reciters.id"), nullable=False)
    audio_path = Column(String, nullable=False)  # path in your storage (S3/local), not a live URL

    __table_args__ = (UniqueConstraint("ayah_id", "reciter_id", name="uq_ayah_reciter"),)


# ---------------------------------------------------------------------------
# Phase 1: recitation sessions
# ---------------------------------------------------------------------------

class RecitationSession(Base):
    """One attempt at reciting a range of ayahs, scored against the correction engine."""

    __tablename__ = "recitation_sessions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    surah_id = Column(Integer, ForeignKey("surahs.id"), nullable=False)
    start_ayah_number = Column(Integer, nullable=False)
    end_ayah_number = Column(Integer, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    # aggregate score 0-100, computed from word_attempts once the session ends
    accuracy_score = Column(Integer, nullable=True)
    # if this session was triggered by the SM-2 scheduler as a due review
    is_review = Column(Boolean, default=False)

    word_attempts = relationship("WordAttempt", back_populates="session")


class WordAttempt(Base):
    """Per-word result within a recitation session: correct / wrong / missed / added."""

    __tablename__ = "word_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(UUID(as_uuid=False), ForeignKey("recitation_sessions.id"), nullable=False)
    ayah_id = Column(Integer, ForeignKey("ayahs.id"), nullable=False)
    word_position = Column(Integer, nullable=True)  # null if this was an "added" word not in the reference
    expected_text = Column(String, nullable=True)
    recognized_text = Column(String, nullable=True)
    status = Column(String, nullable=False)  # "correct" | "wrong" | "missed" | "added"

    session = relationship("RecitationSession", back_populates="word_attempts")


# ---------------------------------------------------------------------------
# Phase 2: hifz (memorization) tracking
# ---------------------------------------------------------------------------

class MemorizationProgress(Base):
    """
    Per-ayah memorization + SM-2 spaced-repetition state for a user.
    One row per (user, ayah). Created the first time a user marks an ayah as
    'learning' or completes a session covering it.
    """

    __tablename__ = "memorization_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    ayah_id = Column(Integer, ForeignKey("ayahs.id"), nullable=False)

    # "new" -> "learning" -> "memorized" (memorized ayahs still get reviewed via SM-2)
    status = Column(String, default="new")

    # SM-2 state
    repetitions = Column(Integer, default=0)
    ease_factor = Column(Integer, default=250)  # stored as ease*100 (2.50 -> 250) to avoid floats
    interval_days = Column(Integer, default=0)
    due_at = Column(DateTime, nullable=True)
    last_reviewed_at = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "ayah_id", name="uq_user_ayah_progress"),)


class Goal(Base):
    """A user-set memorization target, e.g. 'memorize Juz 30 in 3 months'."""

    __tablename__ = "goals"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    target_surah_id = Column(Integer, ForeignKey("surahs.id"), nullable=True)
    target_juz = Column(Integer, nullable=True)
    target_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Miftah Method: guided incremental + cumulative memorization
# ---------------------------------------------------------------------------

class MiftahMethodSession(Base):
    """
    State machine for the 'Miftah Method'.

    For a chosen range of ayahs, each new ayah goes through three phases:
      1. "repeat"     — text visible, recite aloud 4 times (each checked
                         against the correction engine so it can't be skipped).
      2. "recall"     — text hidden, recite that ayah alone from memory,
                         looping until the accuracy is high enough to call it
                         fluent.
      3. "cumulative" — text hidden, recite every ayah mastered so far in
                         this session (start_ayah_number..current_ayah_number)
                         back to back from memory, looping until fluent.

    Once cumulative passes, current_ayah_number advances and the cycle
    repeats for the next ayah — so ayah N is always tested together with
    every ayah before it, not in isolation.
    """

    __tablename__ = "miftah_method_sessions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    surah_id = Column(Integer, ForeignKey("surahs.id"), nullable=False)
    start_ayah_number = Column(Integer, nullable=False)
    end_ayah_number = Column(Integer, nullable=False)

    current_ayah_number = Column(Integer, nullable=False)
    phase = Column(String, default="repeat")  # "repeat" | "recall" | "cumulative"
    repeat_count = Column(Integer, default=0)  # completed read-alouds (0-4) for current ayah
    attempt_count = Column(Integer, default=0)  # attempts in the current recall/cumulative loop

    status = Column(String, default="active")  # "active" | "completed"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


# ---------------------------------------------------------------------------
# Phase 3: community
# ---------------------------------------------------------------------------

class StudyCircle(Base):
    __tablename__ = "study_circles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_private = Column(Boolean, default=False)

    memberships = relationship("CircleMembership", back_populates="circle")


class CircleMembership(Base):
    __tablename__ = "circle_memberships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    circle_id = Column(UUID(as_uuid=False), ForeignKey("study_circles.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # "member" | "moderator" | "owner"
    joined_at = Column(DateTime, default=datetime.utcnow)

    circle = relationship("StudyCircle", back_populates="memberships")

    __table_args__ = (UniqueConstraint("circle_id", "user_id", name="uq_circle_member"),)


class Report(Base):
    """Minimal moderation: a member flags another member or a piece of shared content."""

    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    circle_id = Column(UUID(as_uuid=False), ForeignKey("study_circles.id"), nullable=False)
    reported_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    reported_user = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)


# ---------------------------------------------------------------------------
# Social: following + circle chat
# ---------------------------------------------------------------------------

class Follow(Base):
    """Twitter-style one-way follow — no approval needed. follower_id follows
    followed_id."""

    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    follower_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    followed_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("follower_id", "followed_id", name="uq_follow_pair"),)


class CircleMessage(Base):
    """A chat message within a study circle. Fetched via polling (after_id
    cursor) rather than a live socket — simple and reliable on free hosting."""

    __tablename__ = "circle_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    circle_id = Column(UUID(as_uuid=False), ForeignKey("study_circles.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=True)
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=True)  # "image" | "video" | "file"
    created_at = Column(DateTime, default=datetime.utcnow)
