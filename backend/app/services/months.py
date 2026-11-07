"""Month arithmetic. A month is a "YYYY-MM" string; days are `datetime.date`."""

import calendar
import datetime as dt


def parse_month(month: str) -> tuple[int, int]:
    year, number = month.split("-")
    return int(year), int(number)


def month_of(day: dt.date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def month_start(month: str) -> dt.date:
    year, number = parse_month(month)
    return dt.date(year, number, 1)


def month_end(month: str) -> dt.date:
    year, number = parse_month(month)
    return dt.date(year, number, calendar.monthrange(year, number)[1])


def add_months(month: str, count: int) -> str:
    year, number = parse_month(month)
    index = year * 12 + (number - 1) + count
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def month_range(first: str, last: str) -> list[str]:
    """Every month from `first` to `last`, inclusive. Empty if `last` is before `first`."""
    months: list[str] = []
    current = first
    while current <= last:
        months.append(current)
        current = add_months(current, 1)
    return months


def due_date_for(month: str, due_day: int) -> dt.date:
    """The due date in `month`; a due day of 31 becomes the last day of a shorter month."""
    year, number = parse_month(month)
    return dt.date(year, number, min(due_day, calendar.monthrange(year, number)[1]))


def month_label(month: str) -> str:
    year, number = parse_month(month)
    return f"{calendar.month_abbr[number]} {year}"
