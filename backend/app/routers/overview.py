"""One call that feeds the whole home page."""

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import Book, ImportantDate, LearnTool, Loan, Transaction
from app.services import loans as loan_svc
from app.services import occasions, stats
from app.services import recurring as recurring_svc
from app.services.months import month_end, month_of, month_start
from app.timeutil import today_for

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("")
def overview(user: CurrentUser, db: DbSession) -> dict:
    today = today_for(user)
    month = month_of(today)
    start, end = month_start(month), month_end(month)
    income, expense = stats.totals(db, user.id, start, end)

    # Bills and monthly income that still need attention this month.
    items = recurring_svc.list_items(db, user)
    cells = recurring_svc.current_cells(db, items, today)
    monthly = []
    for item in items:
        cell = cells[item.id]
        if cell is None:
            continue
        monthly.append(
            {
                "id": item.id,
                "kind": item.kind,
                "name": item.name,
                "amount_minor": cell["amount_minor"],
                "status": cell["status"],
                "due_date": cell["due_date"],
            }
        )
    monthly.sort(key=lambda row: (row["status"] == "paid", row["due_date"]))
    unpaid_bills = sum(
        row["amount_minor"]
        for row in monthly
        if row["kind"] == "expense" and row["status"] != "paid"
    )
    expected_income = sum(
        row["amount_minor"]
        for row in monthly
        if row["kind"] == "income" and row["status"] != "paid"
    )

    dates = [
        {"id": d.id, "title": d.title, "kind": d.kind, **occasions.describe(d, today)}
        for d in db.scalars(select(ImportantDate).where(ImportantDate.user_id == user.id))
    ]
    upcoming_dates = sorted(
        (d for d in dates if d["days_until"] >= 0), key=lambda d: d["days_until"]
    )[:4]

    loans = [
        loan_svc.describe(loan, today)
        for loan in db.scalars(
            select(Loan).options(selectinload(Loan.payments)).where(Loan.user_id == user.id)
        )
    ]
    loan_summary = loan_svc.summarize(loans)
    loan_summary["people"] = loan_summary["people"][:5]

    books = list(db.scalars(select(Book).where(Book.user_id == user.id)))
    tools = list(db.scalars(select(LearnTool).where(LearnTool.user_id == user.id)))
    recent = db.scalars(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(6)
    )

    return {
        "today": today,
        "month": month,
        "income_minor": income,
        "expense_minor": expense,
        "balance_minor": income - expense,
        "savings_rate": stats.savings_rate(income, expense),
        "unpaid_bills_minor": unpaid_bills,
        "expected_income_minor": expected_income,
        "trend": stats.trend(db, user.id, month, 6),
        "expense_by_category": stats.by_category(db, user.id, "expense", start, end),
        "monthly_items": monthly,
        "upcoming_dates": [
            {k: d[k] for k in ("id", "title", "kind", "next_date", "days_until", "years")}
            for d in upcoming_dates
        ],
        "loans": loan_summary,
        "books": {
            "reading": [
                {"id": b.id, "title": b.title, "author": b.author}
                for b in books
                if b.status == "reading"
            ][:3],
            "to_buy_count": sum(1 for b in books if b.status == "to_buy"),
            "read_count": sum(1 for b in books if b.status == "read"),
        },
        "tools": {
            "next": [
                {"id": t.id, "name": t.name, "priority": t.priority}
                for t in sorted(
                    (t for t in tools if t.status != "done"),
                    key=lambda t: ("high", "medium", "low").index(t.priority),
                )
            ][:4],
            "learning_count": sum(1 for t in tools if t.status == "learning"),
            "done_count": sum(1 for t in tools if t.status == "done"),
        },
        "recent_transactions": [
            {
                "id": t.id,
                "kind": t.kind,
                "title": t.title,
                "amount_minor": t.amount_minor,
                "date": t.date,
                "category": {"name": t.category.name, "color": t.category.color}
                if t.category
                else None,
            }
            for t in recent
        ],
    }
