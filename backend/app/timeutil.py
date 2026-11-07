"""Timezone helpers. "Today" is always evaluated in the user's own timezone."""

from datetime import date, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones

from app.models import User


@lru_cache(maxsize=1)
def _known_timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def is_valid_timezone(name: str) -> bool:
    return name in _known_timezones()


def get_zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):  # unknown key or no tz database
        return ZoneInfo("UTC")


def today_for(user: User) -> date:
    return datetime.now(get_zone(user.timezone)).date()
