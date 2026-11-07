"""Money lent to and borrowed from people, with repayments."""

from fastapi import APIRouter, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession, get_owned
from app.models import Loan, LoanPayment
from app.schemas.life import (
    LoanCreate,
    LoanPaymentCreate,
    LoanRead,
    LoanSummary,
    LoanUpdate,
)
from app.services import loans as svc
from app.timeutil import today_for

router = APIRouter(prefix="/loans", tags=["loans"])


def _all(db: DbSession, user_id: int) -> list[Loan]:
    return list(
        db.scalars(
            select(Loan)
            .options(selectinload(Loan.payments))
            .where(Loan.user_id == user_id)
            .order_by(Loan.date.desc(), Loan.id.desc())
        )
    )


def _loan(db: DbSession, user, loan_id: int) -> Loan:
    return get_owned(db, Loan, loan_id, user, "Loan")


@router.get("", response_model=list[LoanRead])
def list_loans(
    user: CurrentUser,
    db: DbSession,
    status_filter: str = Query(default="all", alias="status", pattern="^(all|open|settled)$"),
) -> list[dict]:
    today = today_for(user)
    items = [svc.describe(loan, today) for loan in _all(db, user.id)]
    if status_filter == "open":
        items = [item for item in items if not item["settled"]]
    elif status_filter == "settled":
        items = [item for item in items if item["settled"]]
    return items


@router.get("/summary", response_model=LoanSummary)
def summary(user: CurrentUser, db: DbSession) -> dict:
    today = today_for(user)
    return svc.summarize([svc.describe(loan, today) for loan in _all(db, user.id)])


@router.post("", response_model=LoanRead, status_code=status.HTTP_201_CREATED)
def create_loan(payload: LoanCreate, user: CurrentUser, db: DbSession) -> dict:
    loan = Loan(user_id=user.id, **payload.model_dump())
    db.add(loan)
    db.commit()
    return svc.describe(loan, today_for(user))


@router.patch("/{loan_id}", response_model=LoanRead)
def update_loan(loan_id: int, payload: LoanUpdate, user: CurrentUser, db: DbSession) -> dict:
    loan = _loan(db, user, loan_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)
    db.commit()
    return svc.describe(loan, today_for(user))


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(loan_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(_loan(db, user, loan_id))
    db.commit()


@router.post("/{loan_id}/payments", response_model=LoanRead, status_code=status.HTTP_201_CREATED)
def add_payment(loan_id: int, payload: LoanPaymentCreate, user: CurrentUser, db: DbSession) -> dict:
    loan = _loan(db, user, loan_id)
    remaining = svc.describe(loan, today_for(user))["remaining_minor"]
    if payload.amount_minor > remaining:
        from fastapi import HTTPException

        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "That is more than what is still owed"
        )
    loan.payments.append(LoanPayment(**payload.model_dump()))
    db.commit()
    db.refresh(loan)
    return svc.describe(loan, today_for(user))


@router.delete("/{loan_id}/payments/{payment_id}", response_model=LoanRead)
def delete_payment(loan_id: int, payment_id: int, user: CurrentUser, db: DbSession) -> dict:
    loan = _loan(db, user, loan_id)
    payment = next((p for p in loan.payments if p.id == payment_id), None)
    if payment is None:
        from fastapi import HTTPException

        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    loan.payments.remove(payment)
    db.delete(payment)
    db.commit()
    db.refresh(loan)
    return svc.describe(loan, today_for(user))
