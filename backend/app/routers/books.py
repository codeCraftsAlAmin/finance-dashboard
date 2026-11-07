"""Books to buy, to read, being read and finished."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession, get_owned
from app.models import Book, Category, Transaction
from app.schemas.life import BookCreate, BookPurchase, BookRead, BookStatus, BookSummary, BookUpdate
from app.services.months import add_months, month_of
from app.timeutil import today_for

router = APIRouter(prefix="/books", tags=["books"])


def _apply_status(book: Book, new_status: str, today) -> None:
    """Keep the dates in step with the status."""
    book.status = new_status
    if new_status in ("to_read", "reading", "read") and book.purchased_on is None:
        book.purchased_on = today
    if new_status == "read":
        book.finished_on = book.finished_on or today
    else:
        book.finished_on = None
        if new_status in ("to_buy",):
            book.purchased_on = None


@router.get("", response_model=list[BookRead])
def list_books(
    user: CurrentUser,
    db: DbSession,
    status_filter: BookStatus | None = Query(default=None, alias="status"),
) -> list[Book]:
    stmt = select(Book).where(Book.user_id == user.id)
    if status_filter:
        stmt = stmt.where(Book.status == status_filter)
    return list(db.scalars(stmt.order_by(Book.created_at.desc(), Book.id.desc())))


@router.get("/summary", response_model=BookSummary)
def summary(user: CurrentUser, db: DbSession) -> dict:
    today = today_for(user)
    books = list(db.scalars(select(Book).where(Book.user_id == user.id)))
    to_buy = [b for b in books if b.status == "to_buy"]
    read = [b for b in books if b.status == "read"]
    this_year = [b for b in read if b.finished_on and b.finished_on.year == today.year]

    current = month_of(today)
    months = [add_months(current, -offset) for offset in range(5, -1, -1)]
    counts = {m: 0 for m in months}
    for book in read:
        if book.finished_on and month_of(book.finished_on) in counts:
            counts[month_of(book.finished_on)] += 1

    spent = sum(b.price_minor or 0 for b in books if b.status != "to_buy" and b.purchased_on)
    return {
        "to_buy_count": len(to_buy),
        "to_buy_total_minor": sum(b.price_minor or 0 for b in to_buy),
        "to_read_count": sum(1 for b in books if b.status == "to_read"),
        "reading_count": sum(1 for b in books if b.status == "reading"),
        "read_count": len(read),
        "read_this_year": len(this_year),
        "spent_on_books_minor": spent,
        "read_by_month": [{"month": m, "count": counts[m]} for m in months],
    }


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(payload: BookCreate, user: CurrentUser, db: DbSession) -> Book:
    data = payload.model_dump()
    new_status = data.pop("status")
    book = Book(user_id=user.id, **data)
    _apply_status(book, new_status, today_for(user))
    db.add(book)
    db.commit()
    return book


@router.patch("/{book_id}", response_model=BookRead)
def update_book(book_id: int, payload: BookUpdate, user: CurrentUser, db: DbSession) -> Book:
    book = get_owned(db, Book, book_id, user, "Book")
    changes = payload.model_dump(exclude_unset=True)
    new_status = changes.pop("status", None)
    for field, value in changes.items():
        setattr(book, field, value)
    if new_status and new_status != book.status:
        _apply_status(book, new_status, today_for(user))
    db.commit()
    return book


@router.post("/{book_id}/purchase", response_model=BookRead)
def purchase(book_id: int, payload: BookPurchase, user: CurrentUser, db: DbSession) -> Book:
    """Move a book from the wish list to your shelf and, optionally, record the expense."""
    book = get_owned(db, Book, book_id, user, "Book")
    if book.status != "to_buy":
        raise HTTPException(status.HTTP_409_CONFLICT, "This book is already on your shelf")
    today = today_for(user)
    day = payload.date or today
    if day > today:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The date can't be in the future"
        )

    book.status = "to_read"
    book.purchased_on = day
    if payload.record_expense and book.price_minor:
        category = db.scalar(
            select(Category).where(
                Category.user_id == user.id, Category.kind == "expense", Category.name == "Books"
            )
        )
        db.add(
            Transaction(
                user_id=user.id,
                kind="expense",
                amount_minor=book.price_minor,
                date=day,
                title=f"Book · {book.title}"[:80],
                category_id=category.id if category else None,
            )
        )
    db.commit()
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(get_owned(db, Book, book_id, user, "Book"))
    db.commit()
