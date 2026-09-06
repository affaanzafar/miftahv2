# Miftah (مفتاح) — Quran recitation & hifz tracker

"Miftah" means "key." It's a Quran recitation and hifz (memorization) app: recite an
ayah out loud, get word-by-word correction in real time, and let spaced repetition
handle when you review it next — instead of "read it a bunch of times and hope."

Live at **[miftahv2.vercel.app](https://miftahv2.vercel.app)** — you can recite right
now without an account (see [Guest mode](#guest-mode), below).

Built and maintained by one person ([@affaanzafar](https://github.com/affaanzafar)),
in the open, as an ongoing project rather than a finished product.

## What it actually does

1. **Recites and corrects.** Listens through your microphone as you recite, and tells
   you word-by-word what you got right, wrong, skipped, or added — not just "done" on
   a checkbox.
2. **Tracks hifz with spaced repetition.** SM-2, the same idea flashcard apps like
   Anki use: recall something well and it comes back further out; recall it badly and
   it comes back sooner.
3. **Runs the Miftah Method.** A structured way of actually memorizing a new ayah —
   recite-with-text four times, then recite-from-memory alone until fluent, then
   recite-from-memory together with everything else you've locked in that session —
   rather than repetition with no structure. There's also a **blind-recitation mode**
   that skips the 4x-visible-repeat step entirely, for testing what you already know
   rather than learning it fresh.
4. **Lets you set your own goals.** Whole-surah/juz goals auto-track from your
   memorization status. Custom ayah-range goals (e.g. "revise ayahs 5–12 of
   Al-Baqarah") are pending until you mark them done yourself — for memorization or
   revision.
5. **Runs in circles.** Study groups, streaks, shared accountability — memorization
   doesn't have to be solitary.

None of these are individually novel — spaced repetition is decades old, word-level
diffing is the same algorithm family used to diff DNA sequences. What's actually here
is all of it stitched together specifically for Quran memorization, with a correction
engine that checks real Arabic recitation rather than marking a checkbox.

## Guest mode

You can recite and get live word-by-word correction **without creating an account** —
try it at the link above. Nothing is saved until you register (no hifz tracking, no
spaced repetition, no history), but the correction itself is the real thing, not a
crippled demo. This works through a separate stateless endpoint
(`POST /recitation/guest-check`) rather than the authenticated session flow, so it
needed zero database changes to add.

## Stack

- **Frontend:** Next.js 14 (App Router), plain CSS (no Tailwind, no component
  library), browser Web Speech API for speech-to-text
- **Backend:** FastAPI + SQLAlchemy
- **Database:** Postgres (hosted on [Neon](https://neon.tech), free tier)
- **Hosting:** frontend on Vercel, backend on Render

## The correction engine

`backend/app/correction.py` does word-level alignment between what you recited and the
actual Uthmani text — real Levenshtein-style diffing, not a stub, flagging each word
correct / wrong / missed / added.

The part that actually took the work: **normalizing Arabic text so a correct
recitation doesn't fail on encoding technicalities.** The browser's speech recognizer
and the Quran's Uthmani script represent the exact same sounds differently — a
recognizer writes `انسان`, the reference script has `الْإِنسَـٰنَ` — and naive
diacritic-stripping doesn't close that gap. The engine specifically normalizes:

- **Tatweel** (`ـ`, the elongation stroke used throughout Uthmani typesetting,
  e.g. `سَـٰنَ`) — stripped everywhere in a word, not just at the edges.
- **Hamza-seat alefs** (`أ إ آ`) — folded to a plain `ا`, since STT essentially never
  reproduces the hamza seat.
- **Teh marbuta vs. heh** (`ة` / `ه`) — phonetically identical in pause form, folded
  together.
- **Dagger alef ambiguity** — some words' standard spelling keeps a long vowel as a
  full letter, others drop it; both spellings are accepted rather than guessing wrong.

If you're touching this file: print the actual code points before assuming a mismatch
is a threshold problem. It usually isn't.

## What's real vs. what's a placeholder

**Fully working, no external services needed beyond what's already wired up:**

- Auth (register/login/JWT), and full **guest access** to recitation with no account
- Quran data browsing (surah/ayah/word) — public, no auth required
- Recitation sessions + the word-level correction engine described above
- SM-2 spaced repetition, fed automatically from recitation accuracy scores
- The Miftah Method, including blind-recitation ("skip repeat") mode
- Hifz dashboard: due reviews grouped by surah, goals (whole-surah/juz auto-tracked,
  or custom ayah-range goals you mark done yourself), readable per-ayah progress
- Study circles: create, browse/search, join, invite by email, progress sharing,
  basic moderation
- Speech-to-text via the **browser's built-in Web Speech API** — zero infrastructure,
  a deliberate choice to get the whole loop working before investing in ML

**Not yet built:**

- A fine-tuned STT model. Browser STT is genuinely good enough to be useful today, but
  a Whisper/Wav2Vec2 model tuned on Quranic Arabic would be a real accuracy upgrade —
  swappable behind the same `useSpeechRecognition` interface without touching the rest
  of the app.
- Forced alignment (live word-by-word highlighting while you're still speaking,
  instead of record-then-score per ayah).
- Reciter reference audio (Everyayah) isn't downloaded — `ingest_quran.py` notes where
  to plug it in.
- Proper database migrations — see below, this one's overdue.

## Running this locally

### Backend

```bash
cd backend
docker compose up -d          # starts Postgres
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit JWT_SECRET_KEY at minimum
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API docs. A small offline sample
(Al-Fatiha, Al-Ikhlas) seeds automatically on first startup so you can run this with
zero network access. Once you have network access, run `python -m app.ingest_quran`
from the same venv to pull the full 114 surahs / 6,236 ayahs from Quran.com.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Visit `http://localhost:3000`. You can recite immediately as a guest, or register to
save progress. Chrome or Edge required — Web Speech API isn't implemented consistently
elsewhere.

## ⚠️ If you're pulling schema changes: read this before you deploy

The backend calls `Base.metadata.create_all()` on startup, which creates missing
**tables** — it does **not** add new columns to tables that already exist. If a change
adds a column to an existing model (check `git log` / `models.py` diffs), you have to
run the `ALTER TABLE` yourself against the live database before deploying the code
that depends on it, or every route touching that column will fail with a Postgres
error the moment it runs. Proper Alembic migrations are the real fix for this and
they're not set up yet — see [Next steps](#suggested-next-steps-in-order).

## Project layout

```
backend/
  app/
    main.py                    FastAPI entrypoint, wires up all routers
    config.py, database.py, auth.py
    models.py                  All tables: users, quran data, recitation sessions,
                                word attempts, memorization progress, goals (with
                                custom ayah-range + revision support), circles,
                                miftah method sessions (with skip_repeat)
    schemas.py                 Pydantic request/response models
    routes_auth.py             /auth/*
    routes_quran.py            /quran/*  (browse surahs/ayahs/words — public)
    routes_recitation.py       /recitation/*  (sessions, submit attempt, complete,
                                plus /recitation/guest-check — no auth, no persistence)
    routes_hifz.py             /hifz/*  (due reviews, progress, goals + completion)
    routes_community.py        /community/*  (circles, discover, invite, moderation)
    routes_miftah_method.py    /miftah-method/*  (guided memorization state machine,
                                including blind-recitation mode)
    correction.py              Word-diff correction engine + Arabic normalization
    spaced_repetition.py       SM-2 algorithm
    seed_data.py                Offline sample data (2 surahs)
    ingest_quran.py             Real ingestion script — run separately, needs network
frontend/
  app/
    page.js                    Home — hero, shortcuts, guest notice, surah browser,
                                About section
    recite/[surahId]/page.js   Recitation flow — branches on logged-in vs. guest
    hifz/page.js               Dashboard, due reviews, goals (auto + custom)
    miftah-method/             Start form (incl. skip-repeat) + live session page
    circles/page.js, login/, register/, account/
    globals.css                 Theme — parchment/deep-green, single source for
                                every class name used across the app
  components/Nav.js
  lib/api.js                    Fetch wrapper + auth token handling
  lib/useSpeechRecognition.js   Web Speech API hook
```

## Deployment

Frontend on **Vercel**, backend on **Render**, database on **Neon** (all free tier).
Pushing to `main` auto-deploys both frontend and backend. Neon's free tier
auto-archives the database branch after inactivity — querying it (including via a
Render cold start) automatically unarchives it, no action needed, just expect the
first request after idle time to be slow.

## Suggested next steps, in order

1. **Set up Alembic.** The `create_all()` limitation above has already caused one
   avoidable deploy headache; it'll cause more as the schema keeps growing.
2. **Log real STT-transcript-vs-reference pairs** from production recitations, to
   build an actual regression corpus for the correction engine instead of testing
   normalization fixes against whatever ayah happens to be broken that day.
3. Prototype a fine-tuned Whisper/Wav2Vec2 model against saved recitation audio, once
   there's enough of it, to see whether it actually beats browser STT on Quranic
   Arabic before committing to hosting one.
4. Forced alignment for live, word-by-word highlighting while reciting, instead of the
   current record-then-score-per-ayah flow.
5. A read-only guest preview for Circles, mirroring what guest mode already does for
   recitation — see what a circle's activity looks like before joining requires an
   account.
