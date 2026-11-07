"""Lend and borrow: what is still owed on each loan and per person."""

import datetime as dt

from app.models import Loan


def describe(loan: Loan, today: dt.date) -> dict:
    paid = sum(payment.amount_minor for payment in loan.payments)
    remaining = max(0, loan.amount_minor - paid)
    return {
        "id": loan.id,
        "person": loan.person,
        "direction": loan.direction,
        "amount_minor": loan.amount_minor,
        "date": loan.date,
        "reason": loan.reason,
        "due_date": loan.due_date,
        "paid_minor": paid,
        "remaining_minor": remaining,
        "settled": remaining == 0,
        "overdue": remaining > 0 and loan.due_date is not None and loan.due_date < today,
        "payments": loan.payments,
    }


def summarize(loans: list[dict]) -> dict:
    lent = sum(item["remaining_minor"] for item in loans if item["direction"] == "lent")
    borrowed = sum(item["remaining_minor"] for item in loans if item["direction"] == "borrowed")

    people: dict[str, dict] = {}
    for item in loans:
        # Group "Rahim" and "rahim " together; the first one seen (newest loan) names the person.
        key = item["person"].strip().casefold()
        person = people.setdefault(
            key, {"person": item["person"], "net_minor": 0, "lent_minor": 0, "borrowed_minor": 0}
        )
        if item["direction"] == "lent":
            person["lent_minor"] += item["remaining_minor"]
            person["net_minor"] += item["remaining_minor"]
        else:
            person["borrowed_minor"] += item["remaining_minor"]
            person["net_minor"] -= item["remaining_minor"]

    balances = [
        p for p in people.values() if p["net_minor"] != 0 or p["lent_minor"] or p["borrowed_minor"]
    ]
    balances.sort(key=lambda p: -abs(p["net_minor"]))
    open_count = sum(1 for item in loans if not item["settled"])
    return {
        "lent_outstanding_minor": lent,
        "borrowed_outstanding_minor": borrowed,
        "net_minor": lent - borrowed,
        "open_count": open_count,
        "settled_count": len(loans) - open_count,
        "people": balances,
    }
