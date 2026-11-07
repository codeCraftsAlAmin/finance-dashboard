"""Loans, books, important dates, tools to learn and the vault."""

import datetime as dt
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator

from app.schemas.common import Minor, ReadModel, StrictModel, optional_text, short_text

Day = dt.date


def _check_url(value: str | None) -> str | None:
    value = optional_text(value)
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Enter a full link starting with http:// or https://")
    return value


def _forbid_nulls(model: StrictModel, required: tuple[str, ...]) -> None:
    for field in required:
        if field in model.model_fields_set and getattr(model, field) is None:
            raise ValueError(f"{field} cannot be null")


# ------------------------------------------------------------------------------ loans

Direction = Literal["lent", "borrowed"]


class LoanCreate(StrictModel):
    person: short_text(60)
    direction: Direction
    amount_minor: Minor
    date: Day
    reason: str | None = None
    due_date: Day | None = None

    _clean_reason = field_validator("reason")(lambda value: optional_text(value))


class LoanUpdate(StrictModel):
    person: short_text(60) | None = None
    direction: Direction | None = None
    amount_minor: Minor | None = None
    date: Day | None = None
    reason: str | None = None
    due_date: Day | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "LoanUpdate":
        _forbid_nulls(self, ("person", "direction", "amount_minor", "date"))
        return self

    _clean_reason = field_validator("reason")(lambda value: optional_text(value))


class LoanPaymentCreate(StrictModel):
    date: Day
    amount_minor: Minor
    note: str | None = None

    _clean_note = field_validator("note")(lambda value: optional_text(value))


class LoanPaymentRead(ReadModel):
    id: int
    date: Day
    amount_minor: int
    note: str | None


class LoanRead(ReadModel):
    id: int
    person: str
    direction: Direction
    amount_minor: int
    date: Day
    reason: str | None
    due_date: Day | None
    paid_minor: int
    remaining_minor: int
    settled: bool
    overdue: bool
    payments: list[LoanPaymentRead]


class PersonBalance(ReadModel):
    person: str
    # Positive: they owe you. Negative: you owe them.
    net_minor: int
    lent_minor: int
    borrowed_minor: int


class LoanSummary(ReadModel):
    lent_outstanding_minor: int
    borrowed_outstanding_minor: int
    net_minor: int
    open_count: int
    settled_count: int
    people: list[PersonBalance]


# ----------------------------------------------------------------------------- books

BookStatus = Literal["to_buy", "to_read", "reading", "read"]


class BookCreate(StrictModel):
    title: short_text(120)
    author: short_text(80)
    price_minor: Minor | None = None
    status: BookStatus = "to_buy"
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None

    _clean_notes = field_validator("notes")(lambda value: optional_text(value))


class BookUpdate(StrictModel):
    title: short_text(120) | None = None
    author: short_text(80) | None = None
    price_minor: Minor | None = None
    status: BookStatus | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "BookUpdate":
        _forbid_nulls(self, ("title", "author", "status"))
        return self

    _clean_notes = field_validator("notes")(lambda value: optional_text(value))


class BookPurchase(StrictModel):
    date: Day | None = None
    record_expense: bool = True


class BookRead(ReadModel):
    id: int
    title: str
    author: str
    price_minor: int | None
    status: BookStatus
    rating: int | None
    purchased_on: Day | None
    finished_on: Day | None
    notes: str | None


class MonthCount(ReadModel):
    month: str
    count: int


class BookSummary(ReadModel):
    to_buy_count: int
    to_buy_total_minor: int
    to_read_count: int
    reading_count: int
    read_count: int
    read_this_year: int
    spent_on_books_minor: int
    read_by_month: list[MonthCount]


# ----------------------------------------------------------------------------- dates

DateKind = Literal["birthday", "anniversary", "exam", "deadline", "memory", "other"]


class DateCreate(StrictModel):
    title: short_text(100)
    date: Day
    kind: DateKind = "other"
    repeat_yearly: bool = True
    notes: str | None = None

    _clean_notes = field_validator("notes")(lambda value: optional_text(value))


class DateUpdate(StrictModel):
    title: short_text(100) | None = None
    date: Day | None = None
    kind: DateKind | None = None
    repeat_yearly: bool | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "DateUpdate":
        _forbid_nulls(self, ("title", "date", "kind", "repeat_yearly"))
        return self

    _clean_notes = field_validator("notes")(lambda value: optional_text(value))


class DateRead(ReadModel):
    id: int
    title: str
    date: Day
    kind: DateKind
    repeat_yearly: bool
    notes: str | None
    # The next time it happens (or the date itself for a one-off event).
    next_date: Day
    days_until: int
    is_past: bool
    # For yearly events: how many years it will have been (age, anniversary number).
    years: int | None


# ----------------------------------------------------------------------------- tools

Priority = Literal["high", "medium", "low"]
ToolStatus = Literal["next", "learning", "done"]


class ToolCreate(StrictModel):
    name: short_text(80)
    details: str | None = Field(default=None, max_length=500)
    source_url: str | None = None
    priority: Priority = "medium"
    status: ToolStatus = "next"

    _clean_details = field_validator("details")(lambda value: optional_text(value))
    _clean_url = field_validator("source_url")(_check_url)


class ToolUpdate(StrictModel):
    name: short_text(80) | None = None
    details: str | None = Field(default=None, max_length=500)
    source_url: str | None = None
    priority: Priority | None = None
    status: ToolStatus | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "ToolUpdate":
        _forbid_nulls(self, ("name", "priority", "status"))
        return self

    _clean_details = field_validator("details")(lambda value: optional_text(value))
    _clean_url = field_validator("source_url")(_check_url)


class ToolRead(ReadModel):
    id: int
    name: str
    details: str | None
    source_url: str | None
    priority: Priority
    status: ToolStatus
    created_at: dt.datetime


class ToolSummary(ReadModel):
    next_count: int
    learning_count: int
    done_count: int
    by_priority: dict[str, int]


# ---------------------------------------------------------------------------- vault


class VaultStatus(ReadModel):
    initialized: bool


class MasterPassword(StrictModel):
    master_password: str = Field(min_length=10, max_length=128)


class VaultUnlockRead(ReadModel):
    token: str
    expires_in: int


class VaultReset(StrictModel):
    password: str = Field(min_length=1, max_length=128)


class AccountCreate(StrictModel):
    service: short_text(80)
    username: short_text(120)
    url: str | None = None
    category: short_text(30) = "Other"
    password: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)

    _clean_notes = field_validator("notes")(lambda value: optional_text(value))
    _clean_url = field_validator("url")(_check_url)


class AccountUpdate(StrictModel):
    service: short_text(80) | None = None
    username: short_text(120) | None = None
    url: str | None = None
    category: short_text(30) | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "AccountUpdate":
        _forbid_nulls(self, ("service", "username", "category"))
        return self

    _clean_url = field_validator("url")(_check_url)


class SecretUpdate(StrictModel):
    """Changing secrets needs an unlocked vault, so it has its own endpoint."""

    password: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)

    _clean_notes = field_validator("notes")(lambda value: optional_text(value))


class AccountRead(ReadModel):
    id: int
    service: str
    username: str
    url: str | None
    category: str
    has_notes: bool
    updated_at: dt.datetime


class AccountSecret(ReadModel):
    password: str
    notes: str | None
