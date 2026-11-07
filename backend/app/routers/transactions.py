"""Income and expense transactions, plus the monthly summary that feeds the charts."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession, get_owned
from app.models import Category, Transaction, User
from app.schemas.common import MONTH_PATTERN, Kind
from app.schemas.finance import (
    TransactionCreate,
    TransactionRead,
    TransactionSummary,
    TransactionUpdate,
)
from app.services import stats
from app.services.months import month_end, month_of, month_start
from app.timeutil import today_for

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _check_category(db: DbSession, user: User, category_id: int | None, kind: str) -> None:
    if category_id is None:
        return
    category = get_owned(db, Category, category_id, user, "Category")
    if category.kind != kind:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"That category is for {category.kind}, not {kind}",
        )


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    user: CurrentUser,
    db: DbSession,
    month: str | None = Query(default=None, pattern=MONTH_PATTERN),
    kind: Kind | None = None,
    category_id: int | None = None,
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[Transaction]:
    stmt = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.user_id == user.id)
    )
    if month:
        stmt = stmt.where(
            Transaction.date >= month_start(month), Transaction.date <= month_end(month)
        )
    if kind:
        stmt = stmt.where(Transaction.kind == kind)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if q:
        stmt = stmt.where(Transaction.title.ilike(f"%{q.strip()}%"))
    stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit)
    return list(db.scalars(stmt))


@router.get("/summary", response_model=TransactionSummary)
def summary(
    user: CurrentUser,
    db: DbSession,
    month: str | None = Query(default=None, pattern=MONTH_PATTERN),
    months: int = Query(default=6, ge=2, le=24),
) -> dict:
    month = month or month_of(today_for(user))
    start, end = month_start(month), month_end(month)
    income, expense = stats.totals(db, user.id, start, end)
    return {
        "month": month,
        "income_minor": income,
        "expense_minor": expense,
        "balance_minor": income - expense,
        "savings_rate": stats.savings_rate(income, expense),
        "expense_by_category": stats.by_category(db, user.id, "expense", start, end),
        "income_by_category": stats.by_category(db, user.id, "income", start, end),
        "daily": stats.daily(db, user.id, start, end),
        "trend": stats.trend(db, user.id, month, months),
    }


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, user: CurrentUser, db: DbSession) -> Transaction:
    _check_category(db, user, payload.category_id, payload.kind)
    transaction = Transaction(user_id=user.id, **payload.model_dump())
    db.add(transaction)
    db.commit()
    return transaction


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int, payload: TransactionUpdate, user: CurrentUser, db: DbSession
) -> Transaction:
    transaction = get_owned(db, Transaction, transaction_id, user, "Transaction")
    changes = payload.model_dump(exclude_unset=True)
    kind = changes.get("kind", transaction.kind)
    category_id = changes.get("category_id", transaction.category_id)
    if "kind" in changes and "category_id" not in changes and category_id is not None:
        # Switching income/expense: a category of the old kind no longer fits.
        category_id = None
        changes["category_id"] = None
    _check_category(db, user, category_id, kind)
    for field, value in changes.items():
        setattr(transaction, field, value)
    db.commit()
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(get_owned(db, Transaction, transaction_id, user, "Transaction"))
    db.commit()
