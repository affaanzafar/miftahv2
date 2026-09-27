import unittest

from app.correction import align_words, score_session


class QuranNormalizationTests(unittest.TestCase):
    def assert_single_word_correct(self, reference: str, recognized: str):
        result = align_words([reference], [recognized])
        self.assertEqual(result[0].status, "correct", f"{reference!r} should match {recognized!r}")
        self.assertEqual(score_session(result), 100)

    def test_dagger_alef_and_tatweel_match_modern_spelling(self):
        self.assert_single_word_correct("الْإِنسَـٰنَ", "الانسان")
        self.assert_single_word_correct("الرَّحْمَـٰنِ", "الرحمان")

    def test_alef_wasla_and_small_alef_do_not_break_matching(self):
        self.assert_single_word_correct("وَٱلضُّحَىٰ", "والضحى")

    def test_standalone_hamza_and_hamza_seats_match_stt_spellings(self):
        self.assert_single_word_correct("مَسْـُٔولًا", "مسؤولا")
        self.assert_single_word_correct("مَسْـُٔولًا", "مسئولا")
        self.assert_single_word_correct("مَسْـُٔولًا", "مسولا")
        self.assert_single_word_correct("يُؤْمِنُونَ", "يومنون")

    def test_wrong_word_still_fails(self):
        result = align_words(["الْحَمْدُ"], ["العالمين"])
        self.assertEqual(result[0].status, "wrong")


if __name__ == "__main__":
    unittest.main()
