"""Monthly recurring items (tuition you earn, bills you pay) and their paid/unpaid months."""

import datetime as dt

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MonthPayment, RecurringItem, Transaction, User
from app.services.months import (
    add_months,
    due_date_for,
    month_label,
    month_of,
    month_range,
)


def payment_status(month: str, due: dt.date, paid: bool, today: dt.date) -> str:
    if paid:
        return "paid"
    current = month_of(today)
    if month > current:
        return "upcoming"
    if month < current:
        return "overdue"
    return "overdue" if today > due else "due"


def make_cell(
    item: RecurringItem, month: str, payment: MonthPayment | None, today: dt.date
) -> dict:
    due = due_date_for(month, item.due_day)
    return {
        "month": month,
        "status": payment_status(month, due, payment is not None, today),
        "is_current": month == month_of(today),
        "due_date": due,
        "paid_on": payment.paid_on if payment else None,
        "amount_minor": payment.amount_minor if payment else item.amount_minor,
    }


def active_in(item: RecurringItem, month: str) -> bool:
    return item.start_month <= month and (item.end_month is None or month <= item.end_month)


def payments_by_item(
    db: Session, item_ids: list[int], first: str, last: str
) -> dict[tuple[int, str], MonthPayment]:
    if not item_ids:
        return {}
    rows = db.scalars(
        select(MonthPayment).where(
            MonthPayment.item_id.in_(item_ids),
            MonthPayment.month >= first,
            MonthPayment.month <= last,
        )
    )
    return {(row.item_id, row.month): row for row in rows}


def list_items(db: Session, user: User, kind: str | None = None) -> list[RecurringItem]:
    stmt = select(RecurringItem).where(RecurringItem.user_id == user.id)
    if kind:
        stmt = stmt.where(RecurringItem.kind == kind)
    return list(db.scalars(stmt.order_by(RecurringItem.due_day, RecurringItem.name)))


def current_cells(
    db: Session, items: list[RecurringItem], today: dt.date
) -> dict[int, dict | None]:
    """This month's cell for each item (None if the item isn't active this month)."""
    month = month_of(today)
    payments = payments_by_item(db, [item.id for item in items], month, month)
    return {
        item.id: make_cell(item, month, payments.get((item.id, month)), today)
        if active_in(item, month)
        else None
        for item in items
    }


def board_cells(
    db: Session, items: list[RecurringItem], months: list[str], today: dt.date
) -> dict[int, list[dict]]:
    payments = payments_by_item(db, [item.id for item in items], months[0], months[-1])
    return {
        item.id: [
            make_cell(item, month, payments.get((item.id, month)), today)
            for month in months
            if active_in(item, month)
        ]
        for item in items
    }


def board_months(today: dt.date, count: int) -> list[str]:
    current = month_of(today)
    return month_range(add_months(current, -(count - 1)), current)


def set_payment(
    db: Session,
    user: User,
    item: RecurringItem,
    month: str,
    *,
    paid: bool,
    paid_on: dt.date | None,
    amount_minor: int | None,
    today: dt.date,
) -> dict:
    """Mark a month paid or unpaid. Idempotent, and keeps the matching transaction in step."""
    if month > month_of(today):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That month hasn't started yet")
    if not active_in(item, month):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "This item isn't active in that month"
        )

    payment = db.scalar(
        select(MonthPayment).where(MonthPayment.item_id == item.id, MonthPayment.month == month)
    )

    if not paid:
        if payment is not None:
            if payment.transaction_id is not None:
                transaction = db.get(Transaction, payment.transaction_id)
                if transaction is not None:
                    db.delete(transaction)
            db.delete(payment)
            db.commit()
        return make_cell(item, month, None, today)

    day = paid_on or today
    if day > today:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The paid date can't be in the future"
        )
    amount = amount_minor or item.amount_minor

    transaction = (
        db.get(Transaction, payment.transaction_id) if payment and payment.transaction_id else None
    )
    if transaction is None:
        transaction = Transaction(
            user_id=user.id,
            kind=item.kind,
            amount_minor=amount,
            date=day,
            title=f"{item.name} · {month_label(month)}",
            category_id=item.category_id,
        )
        db.add(transaction)
        db.flush()
    else:
        transaction.amount_minor = amount
        transaction.date = day

    if payment is None:
        payment = MonthPayment(item_id=item.id, month=month, paid_on=day, amount_minor=amount)
        db.add(payment)
    payment.paid_on = day
    payment.amount_minor = amount
    payment.transaction_id = transaction.id
    db.commit()
    return make_cell(item, month, payment, today)
