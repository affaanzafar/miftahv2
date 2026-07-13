# Miftah (مفتاح) — Quran recitation & hifz tracker

"Miftah" means "key." Full-stack app covering recitation, hifz (memorization) tracking
with spaced repetition, the **Miftah Method** of guided incremental memorization, and
study circles. Backend is fully functional against a small offline sample of Quran
data (Al-Fatiha + Al-Ikhlas) so you can run it end-to-end with zero network access —
run `ingest_quran.py` once you have network access to load the full 114 surahs.

## Stack

- **Frontend:** Next.js 14 (App Router), plain CSS, `MediaRecorder` capture for STT input
- **Backend:** FastAPI + SQLAlchemy, tarteel-ai/whisper-base-ar-quran (via Transformers) for STT
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
- **The Miftah Method** (`backend/app/routes_miftah_method.py`, frontend at
  `/miftah-method`) — a guided memorization state machine: for a chosen ayah range,
  each ayah is (1) recited aloud 4 times with the text visible, checked against the
  correction engine each time; (2) recited alone from memory, looping until fluent;
  then (3) recited together with every ayah already mastered in the session, from
  memory, looping until that's fluent too — only then does it move to the next ayah.
  A passed recall attempt feeds straight into the SM-2 hifz schedule.
- Hifz dashboard: due reviews grouped into contiguous per-surah ranges with a
  one-click "Review now" (launches a scoped recitation session and auto-applies the
  result to the schedule), goals with live progress bars against a target surah, and
  a readable per-ayah progress list (surah + ayah number, not raw IDs).
- Study circles: create, browse/search public circles under "Find circles", join,
  and add people directly by email under "My circles" — plus progress sharing and
  basic moderation (report / remove member).
- Speech-to-text via **tarteel-ai/whisper-base-ar-quran** (`backend/app/stt.py`,
  `POST /stt/transcribe`) — a Whisper model Tarteel AI fine-tuned specifically on
  Quranic recitation, not conversational Arabic. This replaced an earlier browser
  Web Speech API version after real testing showed two problems with it: poor
  accuracy on tajweed-governed recitation, and — worse — mic feedback, since the
  browser API doesn't expose its MediaStream, so echo cancellation couldn't be
  applied and audio played back on speakers got picked back up as "recitation".
  The frontend now captures audio itself via `getUserMedia` (with
  `echoCancellation`/`noiseSuppression`/`autoGainControl` explicitly on), chunks it
  on a volume-based pause detector (`frontend/lib/useSpeechRecognition.js`), and
  uploads each chunk for transcription. The hook keeps the exact same
  `{transcript, finalTranscript, isListening, isSupported, start, stop, reset}`
  interface the old one had, so the recitation and Miftah Method pages needed no
  changes.

**Placeholders you need to fill in with network/compute access this sandbox doesn't have:**
- `backend/app/seed_data.py` ships only 2 surahs so the app boots offline. Run
  `backend/app/ingest_quran.py` (needs internet — this repo was built in a sandbox
  with no outbound network access, so this step has to happen on your own machine)
  to pull all 114 surahs / 6,236 ayahs from Quran.com, with word-level segmentation.
  The script now paginates correctly through long surahs (e.g. Al-Baqarah's 286
  ayahs), retries transient failures, and verifies each surah's ayah count against
  what the API reports.
- Reciter reference audio (Everyayah) isn't downloaded — `ingest_quran.py` notes where
  to plug that in.
- The Whisper model (`tarteel-ai/whisper-base-ar-quran`, ~290MB) downloads from
  Hugging Face on first use of `/stt/transcribe` — needs network access on first run
  (this sandbox has none, so this hasn't been exercised end-to-end here). After that
  first download it's cached locally and loads from disk.
- `av`/`torch`/`transformers` in `requirements.txt` add real install weight (`torch`
  especially). Runs on CPU fine for short recitation clips; a GPU host would speed up
  the `whisper-large-v3` fine-tune if you upgrade to it later for higher accuracy.
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
Al-Ikhlas) seeds automatically on first startup. Once you have network access, run
`python -m app.ingest_quran` from the same venv to replace the sample with the full
Quran.

## Run the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Visit http://localhost:3000. Register an account, pick a surah, start a session,
and recite — any modern browser with mic access works now (recognition runs
server-side, not in the browser).

## Project layout

```
backend/
  app/
    main.py            FastAPI entrypoint, wires up all routers
    config.py, database.py, auth.py
    models.py            All tables: users, quran data, recitation sessions,
                           word attempts, memorization progress, goals, circles,
                           miftah method sessions
    schemas.py             Pydantic request/response models
    routes_auth.py           /auth/*
    routes_quran.py           /quran/*  (browse surahs/ayahs/words)
    routes_recitation.py       /recitation/*  (sessions, submit attempt, complete)
    routes_hifz.py               /hifz/*  (due reviews grouped by surah, progress, goals)
    routes_community.py            /community/*  (circles, discover, invite, membership, reports)
    routes_miftah_method.py          /miftah-method/*  (the guided memorization state machine)
    correction.py                     Word-diff correction engine
    spaced_repetition.py                SM-2 algorithm
    stt.py                                Whisper-based STT (tarteel-ai/whisper-base-ar-quran)
    routes_stt.py                          /stt/transcribe  (accepts one audio chunk, returns text)
    seed_data.py                         Offline sample data (2 surahs)
    ingest_quran.py                       Real ingestion script — run separately, needs network
frontend/
  app/                Next.js pages: home, login, register, recite/[surahId], hifz,
                        circles, miftah-method, miftah-method/session/[sessionId]
  components/Nav.js
  lib/api.js           Fetch wrapper + auth token handling + STT upload
  lib/useSpeechRecognition.js   MediaRecorder capture + pause-based chunking + server STT
```

## Suggested next steps, in order

1. Run `ingest_quran.py` to get the full Quran instead of the 2-surah sample.
2. Recite a few ayahs yourself and see how `tarteel-ai/whisper-base-ar-quran` holds up
   in practice — the Miftah Method's recall/cumulative phases use a stricter accuracy
   threshold (95%) than the plain recitation checker, so this matters even more there.
   If accuracy still isn't enough, the `whisper-large-v3` fine-tune on the Tarteel
   Everyayah dataset is a drop-in upgrade in `backend/app/stt.py` (slower, needs a GPU
   to be practical).
3. Add Alembic migrations before the schema moves further (currently using
   `create_all`, fine for now, not for production).
4. Tune the VAD thresholds in `useSpeechRecognition.js` (`SILENCE_FLUSH_MS`,
   `VAD_VOLUME_THRESHOLD`) against real recitation pacing/mic setups — these were
   picked as reasonable defaults, not measured against real usage yet.
5. Circle invites currently require the invitee to already have a Miftah account —
   an email-based invite-to-register flow would be a natural next step.
