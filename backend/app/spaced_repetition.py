"""
SM-2 spaced repetition, adapted for hifz review.

Standard SM-2 takes a 0-5 quality rating per review. Here we derive that
rating from the recitation session's accuracy_score (0-100) so a review is
never a separate manual checkbox — it's literally scored by the correction
engine (see correction.py) and fed straight into this scheduler.
"""

from datetime import datetime, timedelta


def accuracy_to_quality(accuracy_score: int) -> int:
    """Map a 0-100 correction-engine score to SM-2's 0-5 quality scale."""
    if accuracy_score >= 98:
        return 5
    if accuracy_score >= 90:
        return 4
    if accuracy_score >= 75:
        return 3
    if accuracy_score >= 60:
        return 2
    if accuracy_score >= 40:
        return 1
    return 0


def sm2_update(
    repetitions: int,
    ease_factor: int,  # stored as ease*100, e.g. 250 == 2.50
    interval_days: int,
    quality: int,
    now: datetime | None = None,
) -> dict:
    """
    Returns the next {repetitions, ease_factor, interval_days, due_at} state.
    quality < 3 resets the repetition streak (the ayah needs to be reviewed
    again soon), quality >= 3 advances it per the standard SM-2 intervals.
    """
    now = now or datetime.utcnow()
    ease = ease_factor / 100.0

    if quality < 3:
        repetitions = 0
        interval_days = 1
    else:
        if repetitions == 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = round(interval_days * ease)
        repetitions += 1

    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease = max(1.3, ease)  # SM-2's floor

    return {
        "repetitions": repetitions,
        "ease_factor": round(ease * 100),
        "interval_days": interval_days,
        "due_at": now + timedelta(days=interval_days),
        "last_reviewed_at": now,
    }
