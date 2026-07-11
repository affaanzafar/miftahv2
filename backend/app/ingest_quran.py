"""
Phase 0, step 2: pull the FULL Quran (114 surahs, 6236 ayahs) with word-by-word
segmentation from the Quran.com API and write it into your Postgres DB.

Run this from your own machine / a server with network access — it won't run
inside this chat's sandbox. Usage:

    python -m app.ingest_quran

Requires `requests` (add to requirements.txt: `pip install requests`).

Quran.com API docs: https://api-docs.quran.com/
Reciter audio: https://everyayah.com/data/ (see EVERYAYAH_BASE_URL below —
download files and point AyahAudio.audio_path at your own storage, don't
serve directly from everyayah.com in production).
"""

import requests

from app.database import SessionLocal
from app.models import Surah, Ayah, Word

QURAN_API_BASE = "https://api.quran.com/api/v4"
EVERYAYAH_BASE_URL = "https://everyayah.com/data"


def fetch_surah_list() -> list[dict]:
    resp = requests.get(f"{QURAN_API_BASE}/chapters", params={"language": "en"})
    resp.raise_for_status()
    return resp.json()["chapters"]


def fetch_ayahs_with_words(surah_id: int) -> list[dict]:
    """Uthmani text + word segmentation for every ayah in a surah."""
    resp = requests.get(
        f"{QURAN_API_BASE}/verses/by_chapter/{surah_id}",
        params={
            "language": "en",
            "words": "true",
            "word_fields": "text_uthmani,transliteration",
            "fields": "text_uthmani,text_indopak,juz_number,page_number",
            "per_page": 50,
        },
    )
    resp.raise_for_status()
    return resp.json()["verses"]


def ingest_all():
    db = SessionLocal()
    try:
        if db.query(Surah).count() > 2:  # more than the offline sample means real data is in
            print("DB already has more than the sample data — aborting to avoid duplicates. "
                  "Wipe the surahs/ayahs/words tables first if you want to re-ingest.")
            return

        # clear the small offline sample before loading the real thing
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

            verses = fetch_ayahs_with_words(chapter["id"])
            for v in verses:
                ayah_number = int(v["verse_key"].split(":")[1])
                ayah = Ayah(
                    id=global_ayah_id,
                    surah_id=surah.id,
                    ayah_number=ayah_number,
                    text_uthmani=v["text_uthmani"],
                    text_simple=v["text_uthmani"],  # replace with a real de-diacritization pass if needed
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
            print(f"  ingested surah {surah.id}: {surah.name_transliteration}")

        print("Done. Next: download reciter audio from Everyayah and populate ayah_audio "
              "(see EVERYAYAH_BASE_URL — mirror files into your own storage, don't hotlink).")
    finally:
        db.close()


if __name__ == "__main__":
    ingest_all()
