"""
Pull the FULL Quran (114 surahs, 6236 ayahs) with word-by-word segmentation
from the Quran.com API and write it into your Postgres DB, replacing the
2-surah offline sample from seed_data.py.

Run this from your own machine / a server with real network access -- it
can't run inside the chat sandbox this project was scaffolded in. Usage:

    cd backend
    source venv/bin/activate
    python -m app.ingest_quran

Requires `requests` (already in requirements.txt).

Quran.com API docs: https://api-docs.quran.com/
Reciter audio: https://everyayah.com/data/ (see EVERYAYAH_BASE_URL below --
download files and point AyahAudio.audio_path at your own storage, don't
serve directly from everyayah.com in production).
"""

import time
import unicodedata

import requests

from app.database import SessionLocal
from app.models import Surah, Ayah, Word

QURAN_API_BASE = "https://api.quran.com/api/v4"
EVERYAYAH_BASE_URL = "https://everyayah.com/data"

PER_PAGE = 50          # Quran.com caps page size; we paginate rather than raise this
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2

# Same diacritic ranges the correction engine strips at comparison time --
# used here to precompute text_simple so the frontend can offer a
# no-tashkeel display mode without re-deriving it client-side.
_DIACRITIC_RANGES = [(0x064B, 0x065F), (0x0670, 0x0670), (0x06D6, 0x06ED)]


def _strip_diacritics(text: str) -> str:
    return "".join(
        ch for ch in text
        if not any(lo <= ord(ch) <= hi for lo, hi in _DIACRITIC_RANGES)
    )


def _get_with_retries(url: str, params: dict) -> dict:
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            last_error = e
            print(f"  request failed (attempt {attempt}/{MAX_RETRIES}): {e}")
            time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    raise RuntimeError(f"Giving up on {url} after {MAX_RETRIES} attempts") from last_error


def fetch_surah_list() -> list[dict]:
    data = _get_with_retries(f"{QURAN_API_BASE}/chapters", {"language": "en"})
    return data["chapters"]


def fetch_all_ayahs_with_words(surah_id: int, expected_count: int) -> list[dict]:
    """Uthmani text + word segmentation for every ayah in a surah, paginated
    until every ayah is collected (some surahs, e.g. Al-Baqarah with 286
    ayahs, span several pages at PER_PAGE=50)."""
    verses: list[dict] = []
    page = 1
    while len(verses) < expected_count:
        data = _get_with_retries(
            f"{QURAN_API_BASE}/verses/by_chapter/{surah_id}",
            {
                "language": "en",
                "words": "true",
                "word_fields": "text_uthmani,transliteration",
                "fields": "text_uthmani,text_indopak,juz_number,page_number",
                "per_page": PER_PAGE,
                "page": page,
            },
        )
        batch = data["verses"]
        if not batch:
            break
        verses.extend(batch)
        page += 1
    return verses


def ingest_all(force: bool = False):
    db = SessionLocal()
    try:
        surah_count = db.query(Surah).count()
        if surah_count > 2 and not force:
            print(
                f"DB already has {surah_count} surahs (more than the 2-surah sample) -- "
                "aborting to avoid duplicates. Pass --force (or wipe the surahs/ayahs/"
                "words tables) to re-ingest."
            )
            return

        # clear whatever's there (the small offline sample, or a previous partial run)
        db.query(Word).delete()
        db.query(Ayah).delete()
        db.query(Surah).delete()
        db.commit()

        chapters = fetch_surah_list()
        print(f"Fetched {len(chapters)} surahs from Quran.com")

        global_ayah_id = 1
        for chapter in chapters:
            surah = Surah(
                id=chapter["id"],
                name_arabic=chapter["name_arabic"],
                name_transliteration=chapter["name_simple"],
                name_translation=chapter["translated_name"]["name"],
                revelation_place=chapter.get("revelation_place"),
                ayah_count=chapter["verses_count"],
            )
            db.add(surah)
            db.flush()

            verses = fetch_all_ayahs_with_words(chapter["id"], chapter["verses_count"])
            if len(verses) != chapter["verses_count"]:
                print(
                    f"  WARNING: surah {surah.id} expected {chapter['verses_count']} ayahs, "
                    f"got {len(verses)} -- check for an API change before trusting this surah's data."
                )

            for v in verses:
                ayah_number = int(v["verse_key"].split(":")[1])
                text_uthmani = v["text_uthmani"]
                ayah = Ayah(
                    id=global_ayah_id,
                    surah_id=surah.id,
                    ayah_number=ayah_number,
                    text_uthmani=text_uthmani,
                    text_simple=unicodedata.normalize("NFC", _strip_diacritics(text_uthmani)),
                    juz=v.get("juz_number"),
                    page=v.get("page_number"),
                )
                db.add(ayah)
                db.flush()

                for w in v.get("words", []):
                    if w.get("char_type_name") == "end":  # skip ayah-number markers
                        continue
                    db.add(
                        Word(
                            ayah_id=ayah.id,
                            position=w["position"],
                            text_uthmani=w["text_uthmani"],
                            transliteration=(w.get("transliteration") or {}).get("text"),
                        )
                    )

                global_ayah_id += 1

            db.commit()
            print(f"  ingested surah {surah.id}: {surah.name_transliteration} ({len(verses)} ayahs)")

        total_ayahs = db.query(Ayah).count()
        print(f"Done. {len(chapters)} surahs, {total_ayahs} ayahs ingested (expect 6236 total).")
        print(
            "Next: download reciter audio from Everyayah and populate ayah_audio "
            "(see EVERYAYAH_BASE_URL -- mirror files into your own storage, don't hotlink)."
        )
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    ingest_all(force="--force" in sys.argv)
