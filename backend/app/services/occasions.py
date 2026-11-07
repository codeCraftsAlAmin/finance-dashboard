"""Important dates: when they next happen and how far away that is."""

import calendar
import datetime as dt

from app.models import ImportantDate


def _safe_date(year: int, month: int, day: int) -> dt.date:
    """Feb 29 becomes Feb 28 in years that aren't leap years."""
    return dt.date(year, month, min(day, calendar.monthrange(year, month)[1]))


def next_occurrence(day: dt.date, today: dt.date) -> dt.date:
    this_year = _safe_date(today.year, day.month, day.day)
    return this_year if this_year >= today else _safe_date(today.year + 1, day.month, day.day)


def describe(item: ImportantDate, today: dt.date) -> dict:
    if item.repeat_yearly:
        upcoming = next_occurrence(item.date, today)
        years = upcoming.year - item.date.year
        return {
            "next_date": upcoming,
            "days_until": (upcoming - today).days,
            "is_past": False,
            "years": years if years > 0 else None,
        }
    return {
        "next_date": item.date,
        "days_until": (item.date - today).days,
        "is_past": item.date < today,
        "years": None,
    }


def sort_key(described: dict) -> tuple[int, int]:
    """Upcoming first (soonest first), then one-off events that already happened (latest first)."""
    days = described["days_until"]
    return (0, days) if days >= 0 else (1, -days)
