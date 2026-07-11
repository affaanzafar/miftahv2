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


def _normalize(word: str) -> str:
    """Strip diacritics/punctuation for comparison. Covers standard Arabic
    tashkeel (U+064B-U+0652), the Quranic superscript alef and related marks
    (U+0653-U+065F, U+0670), and Quranic annotation signs (U+06D6-U+06ED) —
    the Uthmani script uses all of these and recognized speech from STT
    typically includes none of them, so we strip them from the reference too
    before comparing."""
    diacritic_ranges = [
        (0x064B, 0x065F),
        (0x0670, 0x0670),
        (0x06D6, 0x06ED),
    ]

    def is_diacritic(ch: str) -> bool:
        cp = ord(ch)
        return any(lo <= cp <= hi for lo, hi in diacritic_ranges)

    cleaned = "".join(ch for ch in word if not is_diacritic(ch))
    return cleaned.strip(" \u0640.,!?").lower()


@dataclass
class WordResult:
    position: int | None  # position in the reference ayah, None if this is an "added" word
    expected: str | None
    recognized: str | None
    status: str  # "correct" | "wrong" | "missed" | "added"


def align_words(reference_words: list[str], recognized_words: list[str]) -> list[WordResult]:
    """
    Standard Needleman-Wunsch-style edit-distance alignment between two word
    sequences, then walk the alignment to classify each position.
    """
    ref_norm = [_normalize(w) for w in reference_words]
    rec_norm = [_normalize(w) for w in recognized_words]

    n, m = len(ref_norm), len(rec_norm)
    # dp[i][j] = edit distance between ref[:i] and rec[:j]
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_norm[i - 1] == rec_norm[j - 1]:
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
        if i > 0 and j > 0 and ref_norm[i - 1] == rec_norm[j - 1]:
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
