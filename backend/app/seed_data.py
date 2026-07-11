"""
Seeds a small sample of Quran data (Al-Fatiha + Al-Ikhlas) directly in code,
so the app is fully usable with zero network access.

This is NOT a substitute for real data. Run `ingest_quran.py` (needs network)
to pull the full 114 surahs / 6236 ayahs with proper word segmentation from
Quran.com's API before going anywhere near real users.
"""

from app.database import SessionLocal
from app.models import Surah, Ayah, Word

SAMPLE_SURAHS = [
    {
        "id": 1,
        "name_arabic": "الفاتحة",
        "name_transliteration": "Al-Fatihah",
        "name_translation": "The Opening",
        "revelation_place": "meccan",
        "ayahs": [
            "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
            "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
            "الرَّحْمَٰنِ الرَّحِيمِ",
            "مَالِكِ يَوْمِ الدِّينِ",
            "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
            "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
            "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
        ],
    },
    {
        "id": 112,
        "name_arabic": "الإخلاص",
        "name_transliteration": "Al-Ikhlas",
        "name_translation": "Sincerity",
        "revelation_place": "meccan",
        "ayahs": [
            "قُلْ هُوَ اللَّهُ أَحَدٌ",
            "اللَّهُ الصَّمَدُ",
            "لَمْ يَلِدْ وَلَمْ يُولَدْ",
            "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
        ],
    },
]


def seed_if_empty():
    db = SessionLocal()
    try:
        if db.query(Surah).count() > 0:
            return  # already seeded

        global_ayah_id = 1
        for s in SAMPLE_SURAHS:
            surah = Surah(
                id=s["id"],
                name_arabic=s["name_arabic"],
                name_transliteration=s["name_transliteration"],
                name_translation=s["name_translation"],
                revelation_place=s["revelation_place"],
                ayah_count=len(s["ayahs"]),
            )
            db.add(surah)
            db.flush()

            for i, text in enumerate(s["ayahs"], start=1):
                ayah = Ayah(
                    id=global_ayah_id,
                    surah_id=surah.id,
                    ayah_number=i,
                    text_uthmani=text,
                    text_simple=text,  # TODO: strip diacritics properly during real ingestion
                )
                db.add(ayah)
                db.flush()

                for pos, word_text in enumerate(text.split(), start=1):
                    db.add(Word(ayah_id=ayah.id, position=pos, text_uthmani=word_text))

                global_ayah_id += 1

        db.commit()
        print(f"Seeded {len(SAMPLE_SURAHS)} surahs (sample data).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_if_empty()
