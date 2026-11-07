"""Challenge progress: counts, streaks and what state a challenge is in."""

import datetime as dt
import itertools

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Challenge, ChallengeCheckin


def _streaks(days: list[dt.date], today: dt.date) -> tuple[int, int]:
    """(current, best) runs of consecutive check-in days.

    The current streak is still alive if the last check-in was today or yesterday.
    """
    if not days:
        return 0, 0
    ordered = sorted(set(days))
    best = run = 1
    for previous, day in itertools.pairwise(ordered):
        run = run + 1 if (day - previous).days == 1 else 1
        best = max(best, run)
    current = 0
    if (today - ordered[-1]).days <= 1:
        current = 1
        for later, earlier in zip(reversed(ordered), reversed(ordered[:-1]), strict=False):
            if (later - earlier).days != 1:
                break
            current += 1
    return current, best


def describe(challenge: Challenge, today: dt.date) -> dict:
    days = [c.date for c in challenge.checkins]
    end = challenge.end_date
    done = challenge.status == "completed"

    if done:
        state = "completed"
    elif today < challenge.start_date:
        state = "upcoming"
    elif today > end:
        state = "overdue"
    else:
        state = "active"

    elapsed = max(0, min(challenge.duration_days, (today - challenge.start_date).days + 1))
    current, best = _streaks(days, today)
    early_by = (end - challenge.completed_on).days if done and challenge.completed_on else 0
    return {
        "id": challenge.id,
        "title": challenge.title,
        "goal": challenge.goal,
        "start_date": challenge.start_date,
        "end_date": end,
        "duration_days": challenge.duration_days,
        "state": state,
        "completed_on": challenge.completed_on,
        "completed_early": early_by > 0,
        "days_early": max(0, early_by),
        "outcome": challenge.outcome,
        "days_done": len(days),
        "days_elapsed": elapsed,
        "days_left": max(0, (end - today).days) if not done else 0,
        "percent": round(100 * len(days) / challenge.duration_days),
        "current_streak": 0 if done else current,
        "best_streak": best,
        "checked_today": today in days,
        "checkins": challenge.checkins,
    }


def set_day(
    db: Session,
    challenge: Challenge,
    day: dt.date,
    *,
    done: bool,
    note: str | None,
    today: dt.date,
) -> None:
    """Mark a day done or not done. Idempotent."""
    if challenge.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This challenge is already completed")
    if day < challenge.start_date or day > challenge.end_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "That day is outside this challenge"
        )
    if day > today:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You can't check in for a future day")

    existing = next((c for c in challenge.checkins if c.date == day), None)
    if done:
        if existing is None:
            challenge.checkins.append(ChallengeCheckin(date=day, note=note))
        elif note is not None:
            existing.note = note
    elif existing is not None:
        challenge.checkins.remove(existing)
        db.delete(existing)
    db.commit()
    db.refresh(challenge)


def complete(db: Session, challenge: Challenge, outcome: str | None, today: dt.date) -> None:
    if challenge.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This challenge is already completed")
    if not challenge.checkins:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Check in at least one day before claiming it"
        )
    challenge.status = "completed"
    challenge.completed_on = today
    challenge.outcome = outcome
    db.commit()


def summarize(described: list[dict]) -> dict:
    finished = [item for item in described if item["state"] == "completed"]
    return {
        "active_count": sum(1 for item in described if item["state"] != "completed"),
        "completed_count": len(finished),
        "early_count": sum(1 for item in finished if item["completed_early"]),
        "total_days_done": sum(item["days_done"] for item in described),
        "best_streak": max((item["best_streak"] for item in described), default=0),
    }
