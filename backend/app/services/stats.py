"""Aggregations over transactions, written to run unchanged on SQLite and PostgreSQL."""

import datetime as dt

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models import Category, Transaction
from app.services.months import add_months, month_end, month_start

OTHER_COLOR = "#8a8a85"


def totals(db: Session, user_id: int, start: dt.date, end: dt.date) -> tuple[int, int]:
    """(income, expense) in minor units between two dates, inclusive."""
    rows = db.execute(
        select(Transaction.kind, func.coalesce(func.sum(Transaction.amount_minor), 0))
        .where(Transaction.user_id == user_id, Transaction.date >= start, Transaction.date <= end)
        .group_by(Transaction.kind)
    )
    sums = {kind: int(total) for kind, total in rows}
    return sums.get("income", 0), sums.get("expense", 0)


def month_totals(db: Session, user_id: int, month: str) -> tuple[int, int]:
    return totals(db, user_id, month_start(month), month_end(month))


def trend(db: Session, user_id: int, last_month: str, count: int) -> list[dict]:
    """Income and expense for each of the `count` months ending at `last_month`."""
    first = add_months(last_month, -(count - 1))
    year = extract("year", Transaction.date)
    number = extract("month", Transaction.date)
    rows = db.execute(
        select(year, number, Transaction.kind, func.sum(Transaction.amount_minor))
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= month_start(first),
            Transaction.date <= month_end(last_month),
        )
        .group_by(year, number, Transaction.kind)
    )
    sums: dict[tuple[str, str], int] = {}
    for y, m, kind, total in rows:
        sums[(f"{int(y):04d}-{int(m):02d}", kind)] = int(total)

    result = []
    for offset in range(count):
        month = add_months(first, offset)
        result.append(
            {
                "month": month,
                "income_minor": sums.get((month, "income"), 0),
                "expense_minor": sums.get((month, "expense"), 0),
            }
        )
    return result


def by_category(
    db: Session, user_id: int, kind: str, start: dt.date, end: dt.date, top: int = 6
) -> list[dict]:
    """Totals per category, largest first. Everything past `top` is folded into "Other"."""
    rows = db.execute(
        select(
            Category.id,
            func.coalesce(Category.name, "Uncategorized"),
            func.coalesce(Category.color, OTHER_COLOR),
            func.sum(Transaction.amount_minor),
        )
        .select_from(Transaction)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.kind == kind,
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Category.id, Category.name, Category.color)
    ).all()

    items = sorted(
        (
            {"category_id": cid, "name": name, "color": color, "amount_minor": int(total)}
            for cid, name, color, total in rows
        ),
        key=lambda item: -item["amount_minor"],
    )
    if len(items) <= top:
        return items
    rest = sum(item["amount_minor"] for item in items[top:])
    return [
        *items[:top],
        {"category_id": None, "name": "Other", "color": OTHER_COLOR, "amount_minor": rest},
    ]


def daily(db: Session, user_id: int, start: dt.date, end: dt.date) -> list[dict]:
    rows = db.execute(
        select(Transaction.date, Transaction.kind, func.sum(Transaction.amount_minor))
        .where(Transaction.user_id == user_id, Transaction.date >= start, Transaction.date <= end)
        .group_by(Transaction.date, Transaction.kind)
    )
    sums: dict[tuple[dt.date, str], int] = {(day, kind): int(total) for day, kind, total in rows}
    result = []
    day = start
    while day <= end:
        result.append(
            {
                "date": day,
                "income_minor": sums.get((day, "income"), 0),
                "expense_minor": sums.get((day, "expense"), 0),
            }
        )
        day += dt.timedelta(days=1)
    return result


def savings_rate(income: int, expense: int) -> float | None:
    """Share of income kept, e.g. 0.25 for 25%. None when there was no income."""
    if income <= 0:
        return None
    return round((income - expense) / income, 4)
