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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


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

