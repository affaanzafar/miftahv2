"""
Correction engine: compares a user's recognized speech (a plain string, from
the browser's Web Speech API or any STT source) against the reference text of
an ayah, word by word, and flags correct / wrong / missed / added words.

Uses a Levenshtein-based sequence alignment (same family of algorithm as
`difflib`), operating on words rather than characters. This is intentionally
simple and deterministic — no ML — which makes it a solid baseline you can
later replace or augment with a proper forced-alignment model without
changing the API shape below.
"""

from dataclasses import dataclass

_TASHKEEL_RANGES = [
    (0x064B, 0x065F),  # standard tashkeel + extended Quranic marks
    (0x06D6, 0x06ED),  # Quranic annotation signs (sajda, pause marks, etc.)
]

_DAGGER_ALEF = "\u0670"   # superscript alef — represents a long "aa" that
                          # Uthmani script sometimes writes as a full letter
                          # and sometimes omits, word by word (e.g. omitted
                          # in الرحمن/الرحيم, kept in العالمين) — no single
                          # rule is correct for every word.
_ALEF_WASLA = "\u0671"    # connecting-hamza alef — always folds to a plain
                          # alef in ordinary spelling, no ambiguity here.
_PLAIN_ALEF = "\u0627"
_TATWEEL = "\u0640"       # elongation stroke — purely typographic (used to
                          # stretch a letter, often paired with a dagger
                          # alef, e.g. سَـٰنَ). Carries no sound of its own,
                          # so it must be removed everywhere in the word, not
                          # just trimmed off the ends — it was previously
                          # only stripped at the boundaries, so any tatweel
                          # sitting mid-word (very common in Uthmani script,
                          # e.g. الْإِنسَـٰنَ) survived normalization and
                          # silently broke the match against STT output.
_HAMZA_ALEFS = "\u0623\u0625\u0622"  # أ إ آ — hamza/madda-on-alef forms.
                          # Web Speech API (and STT generally) essentially
                          # never reproduces the hamza seat and just writes
                          # a plain alef, so إِنسَـٰنَ (reference) vs انسان
                          # (recognized) mismatched even after tashkeel and
                          # tatweel were both removed. Folding both sides to
                          # plain alef removes that gap. This does mean two
                          # reference words that differ ONLY by hamza seat
                          # (rare) become indistinguishable from STT input —
                          # an acceptable trade since STT can't tell them
                          # apart either.
_TEH_MARBUTA = "\u0629"   # ة — sounds identical to plain heh (ه) in pause
                          # form, and STT reliably picks one or the other
                          # inconsistently (e.g. نُّطْفَةٍ recognized as
                          # نطفه). Folded to heh on both sides for the same
                          # reason as the hamza-seat alefs above.
_HEH = "\u0647"


def _strip_tashkeel(word: str) -> str:
    def is_diacritic(ch: str) -> bool:
        cp = ord(ch)
        return any(lo <= cp <= hi for lo, hi in _TASHKEEL_RANGES)

    return "".join(ch for ch in word if not is_diacritic(ch))


def _fold_letter_variants(word: str) -> str:
    cleaned = word.replace(_ALEF_WASLA, _PLAIN_ALEF)
    for hamza_alef in _HAMZA_ALEFS:
        cleaned = cleaned.replace(hamza_alef, _PLAIN_ALEF)
    cleaned = cleaned.replace(_TEH_MARBUTA, _HEH)
    return cleaned


def _normalize(word: str) -> str:
    """Normalize a recognized (STT) word: strip tashkeel and tatweel, fold
    alef wasla and hamza-seat alefs to a plain alef, drop dagger alef (STT
    output never contains dagger alef or tatweel in the first place, so
    there's nothing to fold on this side beyond cleanup)."""
    cleaned = _strip_tashkeel(word)
    cleaned = cleaned.replace(_TATWEEL, "")
    cleaned = _fold_letter_variants(cleaned)
    cleaned = cleaned.replace(_DAGGER_ALEF, "")
    return cleaned.strip(" .,!?").lower()


def _normalize_variants(word: str) -> set[str]:
    """Normalize a *reference* (Uthmani) word to the set of spellings a
    correct recitation could plausibly be transcribed as. Tatweel is removed
    everywhere (purely typographic, no sound). Alef wasla and hamza-seat
    alefs always fold to a plain alef (STT doesn't distinguish them). A
    dagger alef is ambiguous — some words' standard spelling drops the long
    vowel entirely, others keep it as a full alef — so both variants are
    accepted rather than guessing."""
    cleaned = _strip_tashkeel(word)
    cleaned = cleaned.replace(_TATWEEL, "")
    cleaned = _fold_letter_variants(cleaned)
    dropped = cleaned.replace(_DAGGER_ALEF, "").strip(" .,!?").lower()
    expanded = cleaned.replace(_DAGGER_ALEF, _PLAIN_ALEF).strip(" .,!?").lower()
    return {dropped, expanded}


@dataclass
class WordResult:
    position: int | None  # position in the reference ayah, None if this is an "added" word
    expected: str | None
    recognized: str | None
    status: str  # "correct" | "wrong" | "missed" | "added"


def align_words(reference_words: list[str], recognized_words: list[str]) -> list[WordResult]:
    """
    Standard Needleman-Wunsch-style edit-distance alignment between two word
    sequences, then walk the alignment to classify each position. A
    reference word matches if the recognized word equals ANY of its accepted
    spelling variants (see _normalize_variants).
    """
    ref_variants = [_normalize_variants(w) for w in reference_words]
    rec_norm = [_normalize(w) for w in recognized_words]

    def is_match(i: int, j: int) -> bool:
        return rec_norm[j] in ref_variants[i]

    n, m = len(ref_variants), len(rec_norm)
    # dp[i][j] = edit distance between ref[:i] and rec[:j]
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

    # backtrack
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
