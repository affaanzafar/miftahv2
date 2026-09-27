"""
Correction engine: compares a user's recognized speech (a plain string, from
browser speech recognition or a Quran-tuned STT source) against the reference
text of an ayah, word by word, and flags correct / wrong / missed / added.

The important bit is normalization: Quran text is usually Uthmani script,
while speech recognizers often return simplified modern Arabic. We therefore
compare *pronunciation-friendly variants* instead of raw Unicode strings. That
keeps visually different but recitationally equivalent spellings from being
marked wrong: dagger/small alif, tatweel, alef-wasla, hamza seats, standalone
hamza marks, Quran annotation marks, etc.
"""

from dataclasses import dataclass
import unicodedata

# Arabic combining marks: ordinary tashkeel, Quranic annotation signs, and
# Arabic Extended-A/B marks used by several Quran data sources. These are
# display/recitation hints, not separate words, so they should not make an
# otherwise correct transcript fail.
_TASHKEEL_RANGES = [
    (0x0610, 0x061A),
    (0x064B, 0x065F),
    (0x06D6, 0x06ED),
    (0x08D3, 0x08FF),
]

_DAGGER_ALEF = "\u0670"  # superscript/small alef
_ALEF_WASLA = "\u0671"  # ٱ
_PLAIN_ALEF = "\u0627"
_TATWEEL = "\u0640"
_HAMZA_ALEFS = "\u0623\u0625\u0622"  # أ إ آ
_STANDALONE_HAMZA = "\u0621"  # ء
_HAMZA_ON_WAW = "\u0624"  # ؤ
_HAMZA_ON_YA = "\u0626"  # ئ
_TEH_MARBUTA = "\u0629"
_HEH = "\u0647"
_ARABIC_PUNCTUATION = " .,!؟?،؛:؛ـ۝۞﴾﴿()[]{}\"'`“”‘’\n\t\r"


def _is_diacritic(ch: str) -> bool:
    # Keep dagger/small alef so _normalize_variants can accept both the
    # dropped and full-alef spellings. unicodedata marks it as Mn, so it
    # needs this explicit exception.
    if ch == _DAGGER_ALEF:
        return False
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in _TASHKEEL_RANGES) or unicodedata.category(ch) in {"Mn", "Me"}


def _strip_tashkeel(word: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKC", word) if not _is_diacritic(ch))


def _strip_outer_punctuation(word: str) -> str:
    return word.strip(_ARABIC_PUNCTUATION).lower()


def _fold_stable_letter_variants(word: str) -> str:
    """Fold variants that are never useful to distinguish for STT matching."""
    cleaned = word.replace(_ALEF_WASLA, _PLAIN_ALEF)
    for hamza_alef in _HAMZA_ALEFS:
        cleaned = cleaned.replace(hamza_alef, _PLAIN_ALEF)
    # In pause-form STT often swaps ة/ه. Folding both to ه is much less noisy
    # for recitation checking while still leaving the displayed expected word
    # untouched in the UI.
    cleaned = cleaned.replace(_TEH_MARBUTA, _HEH)
    return cleaned


def _expand_hamza_variants(word: str) -> set[str]:
    """Return spellings that STT commonly emits for hamza-bearing words.

    Examples:
    - Uthmani مَسْـُٔولًا can be returned as مسؤولا, مسولا, or مسئولاً.
    - يؤمنون may be returned with ؤ, with plain و, or occasionally with the
      hamza omitted. We keep all variants and match by set intersection.
    """
    variants = {word}
    changed = True
    while changed:
        changed = False
        for item in list(variants):
            additions = set()
            if _STANDALONE_HAMZA in item:
                additions.add(item.replace(_STANDALONE_HAMZA, ""))
            if _HAMZA_ON_WAW in item:
                additions.add(item.replace(_HAMZA_ON_WAW, "و"))
                additions.add(item.replace(_HAMZA_ON_WAW, ""))
            if _HAMZA_ON_YA in item:
                additions.add(item.replace(_HAMZA_ON_YA, "ي"))
                additions.add(item.replace(_HAMZA_ON_YA, ""))
            before = len(variants)
            variants |= {_strip_outer_punctuation(v) for v in additions if _strip_outer_punctuation(v)}
            changed = changed or len(variants) != before
    return {_strip_outer_punctuation(v) for v in variants if _strip_outer_punctuation(v)}


def _normalize_variants(word: str) -> set[str]:
    """Return the set of normalized spellings accepted for a single word.

    This is intentionally used for both the Uthmani reference and recognized
    text. Matching by intersection is more robust than forcing either side to
    one canonical spelling because Quran STT can choose different hamza seats
    and small-alif renderings depending on device/model.
    """
    cleaned = _strip_tashkeel(word).replace(_TATWEEL, "")
    cleaned = _fold_stable_letter_variants(cleaned)

    # Dagger/small alef is ambiguous in text output: sometimes modern Arabic
    # writes the corresponding long vowel as a full ا, sometimes it does not.
    base_forms = {
        cleaned.replace(_DAGGER_ALEF, ""),
        cleaned.replace(_DAGGER_ALEF, _PLAIN_ALEF),
    }

    variants: set[str] = set()
    for base in base_forms:
        base = _strip_outer_punctuation(base)
        if not base:
            continue
        variants |= _expand_hamza_variants(base)

    return variants or {""}


def _normalize(word: str) -> str:
    """Best-effort single canonical form kept for debugging/tests.

    The aligner below uses _normalize_variants for the real comparison.
    """
    variants = sorted(_normalize_variants(word), key=lambda value: (len(value), value))
    return variants[0] if variants else ""


@dataclass
class WordResult:
    position: int | None  # position in the reference ayah, None if this is an "added" word
    expected: str | None
    recognized: str | None
    status: str  # "correct" | "wrong" | "missed" | "added"


def align_words(reference_words: list[str], recognized_words: list[str]) -> list[WordResult]:
    """
    Needleman-Wunsch-style edit-distance alignment between two word sequences.
    A reference word matches if its accepted normalized variants intersect with
    the recognized word's normalized variants.
    """
    ref_variants = [_normalize_variants(w) for w in reference_words]
    rec_variants = [_normalize_variants(w) for w in recognized_words]

    def is_match(i: int, j: int) -> bool:
        return bool(ref_variants[i] & rec_variants[j])

    n, m = len(ref_variants), len(rec_variants)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if is_match(i - 1, j - 1):
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # missed (ref word skipped)
                    dp[i][j - 1],      # added (extra recognized word)
                    dp[i - 1][j - 1],  # substituted (wrong word)
                )

    i, j = n, m
    results: list[WordResult] = []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and is_match(i - 1, j - 1):
            results.append(WordResult(i, reference_words[i - 1], recognized_words[j - 1], "correct"))
            i, j = i - 1, j - 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            results.append(WordResult(i, reference_words[i - 1], recognized_words[j - 1], "wrong"))
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            results.append(WordResult(i, reference_words[i - 1], None, "missed"))
            i -= 1
        else:
            results.append(WordResult(None, None, recognized_words[j - 1], "added"))
            j -= 1

    results.reverse()
    return results


def score_session(results: list[WordResult]) -> int:
    """0-100 accuracy score: correct words / total reference words."""
    ref_word_count = sum(1 for r in results if r.status in ("correct", "wrong", "missed"))
    if ref_word_count == 0:
        return 0
    correct = sum(1 for r in results if r.status == "correct")
    return round(100 * correct / ref_word_count)
