from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str | None = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Quran data
# ---------------------------------------------------------------------------

class WordOut(BaseModel):
    position: int
    text_uthmani: str
    transliteration: str | None = None

    class Config:
        from_attributes = True


class AyahOut(BaseModel):
    id: int
    ayah_number: int
    text_uthmani: str
    text_simple: str | None = None
    words: list[WordOut] = []

    class Config:
        from_attributes = True


class SurahOut(BaseModel):
    id: int
    name_arabic: str
    name_transliteration: str
    name_translation: str
    ayah_count: int

    class Config:
        from_attributes = True


class SurahDetailOut(SurahOut):
    ayahs: list[AyahOut] = []


# ---------------------------------------------------------------------------
# Recitation
# ---------------------------------------------------------------------------

class StartSessionRequest(BaseModel):
    surah_id: int
    start_ayah_number: int
    end_ayah_number: int
    is_review: bool = False


class SubmitAttemptRequest(BaseModel):
    ayah_id: int
    recognized_text: str  # raw transcript from the browser's speech recognizer


class WordResultOut(BaseModel):
    position: int | None
    expected: str | None
    recognized: str | None
    status: str


class SubmitAttemptResponse(BaseModel):
    ayah_id: int
    results: list[WordResultOut]
    ayah_accuracy: int


class CompleteSessionResponse(BaseModel):
    session_id: str
    accuracy_score: int
    completed_at: str


# ---------------------------------------------------------------------------
# Hifz
# ---------------------------------------------------------------------------

class ProgressOut(BaseModel):
    ayah_id: int
    status: str
    repetitions: int
    interval_days: int
    due_at: str | None = None
    surah_id: int | None = None
    surah_name: str | None = None
    ayah_number: int | None = None
    text_uthmani: str | None = None

    class Config:
        from_attributes = True


class DueGroupOut(BaseModel):
    """Due ayahs bundled into contiguous ranges per surah, so the UI can
    offer one 'Review now' button per range instead of one per ayah."""

    surah_id: int
    surah_name: str
    start_ayah_number: int
    end_ayah_number: int
    ayah_count: int


class GoalCreate(BaseModel):
    title: str
    target_surah_id: int | None = None
    target_juz: int | None = None
    target_date: str | None = None


class GoalOut(BaseModel):
    id: str
    title: str
    target_surah_id: int | None = None
    target_juz: int | None = None
    target_date: str | None = None
    progress_percent: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Miftah Method
# ---------------------------------------------------------------------------

class MiftahMethodStartRequest(BaseModel):
    surah_id: int
    start_ayah_number: int
    end_ayah_number: int


class MiftahMethodAttemptRequest(BaseModel):
    recognized_text: str  # raw transcript from the browser's speech recognizer


class MiftahMethodSessionOut(BaseModel):
    id: str
    surah_id: int
    start_ayah_number: int
    end_ayah_number: int
    current_ayah_number: int
    phase: str
    repeat_count: int
    attempt_count: int
    status: str

    class Config:
        from_attributes = True


class MiftahMethodSessionDetailOut(MiftahMethodSessionOut):
    surah: SurahOut
    ayahs: list[AyahOut] = []


class MiftahMethodAttemptResponse(BaseModel):
    session: MiftahMethodSessionOut
    results: list[WordResultOut]
    accuracy: int
    passed: bool
    message: str


# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------

class CircleCreate(BaseModel):
    name: str
    description: str | None = None
    is_private: bool = False


class CircleOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_private: bool
    member_count: int = 0

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    reported_user: str
    reason: str


class CircleInvite(BaseModel):
    email: EmailStr


class CircleMemberOut(BaseModel):
    user_id: str
    display_name: str | None = None
    role: str
    memorized_ayah_count: int = 0

