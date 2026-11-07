"""Monthly items (tuition you earn, wifi and tutor fees you pay) and which months are paid."""

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import CurrentUser, DbSession, get_owned
from app.models import Category, RecurringItem, User
from app.schemas.common import Kind, is_month
from app.schemas.finance import (
    Board,
    MonthCell,
    PaymentUpdate,
    RecurringCreate,
    RecurringRead,
    RecurringUpdate,
)
from app.services import recurring as svc
from app.services.months import month_of
from app.timeutil import today_for

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _present(db: DbSession, user: User, items: list[RecurringItem]) -> list[dict]:
    cells = svc.current_cells(db, items, today_for(user))
    return [
        {
            "id": item.id,
            "kind": item.kind,
            "name": item.name,
            "amount_minor": item.amount_minor,
            "due_day": item.due_day,
            "start_month": item.start_month,
            "end_month": item.end_month,
            "category": item.category,
            "note": item.note,
            "current": cells[item.id],
        }
        for item in items
    ]


def _check_category(db: DbSession, user: User, category_id: int | None, kind: str) -> None:
    if category_id is None:
        return
    category = get_owned(db, Category, category_id, user, "Category")
    if category.kind != kind:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"That category is for {category.kind}, not {kind}",
        )


def _load(db: DbSession, user: User, item_id: int) -> RecurringItem:
    return get_owned(db, RecurringItem, item_id, user, "Item")


@router.get("", response_model=list[RecurringRead])
def list_items(user: CurrentUser, db: DbSession, kind: Kind | None = None) -> list[dict]:
    items = svc.list_items(db, user, kind)
    return _present(db, user, items)


@router.get("/board", response_model=Board)
def board(
    user: CurrentUser,
    db: DbSession,
    kind: Kind | None = None,
    months: int = Query(default=6, ge=1, le=24),
) -> dict:
    today = today_for(user)
    items = svc.list_items(db, user, kind)
    month_list = svc.board_months(today, months)
    cells = svc.board_cells(db, items, month_list, today)
    presented = _present(db, user, items)
    rows = []
    for item in presented:
        row_cells = cells[item["id"]]
        paid = sum(1 for cell in row_cells if cell["status"] == "paid")
        rows.append(
            {
                "item": item,
                "cells": row_cells,
                "paid_count": paid,
                "unpaid_count": len(row_cells) - paid,
            }
        )
    return {"months": month_list, "current_month": month_of(today), "rows": rows}


@router.post("", response_model=RecurringRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: RecurringCreate, user: CurrentUser, db: DbSession) -> dict:
    _check_category(db, user, payload.category_id, payload.kind)
    item = RecurringItem(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return _present(db, user, [item])[0]


@router.patch("/{item_id}", response_model=RecurringRead)
def update_item(item_id: int, payload: RecurringUpdate, user: CurrentUser, db: DbSession) -> dict:
    item = _load(db, user, item_id)
    changes = payload.model_dump(exclude_unset=True)
    _check_category(db, user, changes.get("category_id", item.category_id), item.kind)
    start = changes.get("start_month", item.start_month)
    end = changes.get("end_month", item.end_month)
    if end is not None and end < start:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "End month can't be before the start month"
        )
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return _present(db, user, [item])[0]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, user: CurrentUser, db: DbSession) -> None:
    """Removes the item and its payment history. Transactions already recorded stay."""
    db.delete(_load(db, user, item_id))
    db.commit()


@router.put("/{item_id}/payments/{month}", response_model=MonthCell)
def set_payment(
    item_id: int, month: str, payload: PaymentUpdate, user: CurrentUser, db: DbSession
) -> dict:
    if not is_month(month):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Month must look like 2026-11")
    item = _load(db, user, item_id)
    return svc.set_payment(
        db,
        user,
        item,
        month,
        paid=payload.paid,
        paid_on=payload.paid_on,
        amount_minor=payload.amount_minor,
        today=today_for(user),
    )
