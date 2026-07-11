# Miftah (مفتاح) — Quran recitation & hifz tracker

"Miftah" means "key." Full-stack scaffold covering all four phases of the roadmap:
recitation engine, hifz (memorization) tracking with spaced repetition, and study
circles. Backend is fully functional against a small offline sample of Quran data
(Al-Fatiha + Al-Ikhlas) so you can run it end-to-end with zero network access.

## Stack

- **Frontend:** Next.js 14 (App Router), plain CSS, browser Web Speech API for STT
- **Backend:** FastAPI + SQLAlchemy
- **DB:** Postgres

## What's real vs. what's a placeholder

**Fully working, no external services needed:**
- Auth (register/login/JWT)
- Quran data browsing (surah/ayah/word)
- Recitation sessions + word-level correction engine (`backend/app/correction.py`) —
  a Levenshtein-style word alignment that flags correct/wrong/missed/added words.
  This is real logic, not a stub.
- SM-2 spaced repetition (`backend/app/spaced_repetition.py`) — standard algorithm,
  fed automatically from recitation session accuracy scores.
- Hifz progress tracking, goals, study circles, membership, progress sharing, and
  basic moderation (report / remove member).
- Speech-to-text via the **browser's built-in Web Speech API** (`lib/useSpeechRecognition.js`)
  — works in Chrome/Edge today, zero infrastructure. This is a deliberate MVP choice,
  not a corner cut: it lets the whole recitation loop work before you've built or
  fine-tuned anything.

**Placeholders you need to fill in with network/compute access this sandbox doesn't have:**
- `backend/app/seed_data.py` ships only 2 surahs so the app boots offline. Run
  `backend/app/ingest_quran.py` (needs internet) to pull all 114 surahs from Quran.com.
- Reciter reference audio (Everyayah) isn't downloaded — `ingest_quran.py` notes where
  to plug that in.
- If/when browser STT accuracy isn't good enough for real Quranic recitation (likely,
  eventually), that's where a fine-tuned Whisper/Wav2Vec2 model comes in — swap it in
  behind the same `useSpeechRecognition` interface without touching the rest of the app.
- Forced alignment (word-level timing sync while speaking, for live highlighting as
  you recite rather than after-the-fact scoring) isn't built — current flow is
  record-then-submit-then-score per ayah, not live word-by-word tracking.

## Run the backend

```bash
cd backend
docker compose up -d          # starts Postgres
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit JWT_SECRET_KEY at minimum
uvicorn app.main:app --reload
```

Visit http://localhost:8000/docs for interactive API docs. Sample data (Al-Fatiha,
Al-Ikhlas) seeds automatically on first startup.

## Run the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Visit http://localhost:3000. Register an account, pick a surah, start a session,
and recite — Chrome or Edge required for the microphone/speech recognition to work.

## Project layout

```
backend/
  app/
    main.py            FastAPI entrypoint, wires up all routers
    config.py, database.py, auth.py
    models.py            All tables: users, quran data, recitation sessions,
                           word attempts, memorization progress, goals, circles
    schemas.py             Pydantic request/response models
    routes_auth.py           /auth/*
    routes_quran.py           /quran/*  (browse surahs/ayahs/words)
    routes_recitation.py       /recitation/*  (sessions, submit attempt, complete)
    routes_hifz.py               /hifz/*  (due reviews, progress, goals)
    routes_community.py            /community/*  (circles, membership, reports)
    correction.py                    Word-diff correction engine
    spaced_repetition.py               SM-2 algorithm
    seed_data.py                        Offline sample data (2 surahs)
    ingest_quran.py                      Real ingestion script — run separately, needs network
frontend/
  app/                Next.js pages: home, login, register, recite/[surahId], hifz, circles
  components/Nav.js
  lib/api.js           Fetch wrapper + auth token handling
  lib/useSpeechRecognition.js   Web Speech API hook
```

## Suggested next steps, in order

1. Run `ingest_quran.py` to get the full Quran instead of the 2-surah sample.
2. Recite a few ayahs yourself and see how the browser's speech recognition holds up
   on Arabic — this tells you fast whether you need a custom model sooner rather
   than later.
3. Add Alembic migrations before the schema moves further (currently using
   `create_all`, fine for now, not for production).
4. If Web Speech API accuracy is the bottleneck: prototype Whisper (no fine-tuning
   yet) on a few recorded samples to compare, per the original roadmap's step 5.
