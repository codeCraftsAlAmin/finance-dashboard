"""Categories, transactions and recurring monthly items."""

import datetime as dt
from typing import Literal

from pydantic import field_validator, model_validator

from app.schemas.common import (
    HexColor,
    Kind,
    Minor,
    Month,
    ReadModel,
    StrictModel,
    optional_text,
    short_text,
)

Day = dt.date

# ------------------------------------------------------------------------- categories


class CategoryCreate(StrictModel):
    kind: Kind
    name: short_text(40)
    color: HexColor


class CategoryUpdate(StrictModel):
    name: short_text(40) | None = None
    color: HexColor | None = None

    @model_validator(mode="after")
    def _no_explicit_nulls(self) -> "CategoryUpdate":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class CategoryRead(ReadModel):
    id: int
    kind: Kind
    name: str
    color: str


class CategoryMini(ReadModel):
    id: int
    name: str
    color: str


# ----------------------------------------------------------------------- transactions


class TransactionCreate(StrictModel):
    kind: Kind
    amount_minor: Minor
    date: Day
    title: short_text(80)
    note: str | None = None
    category_id: int | None = None

    _clean_note = field_validator("note")(lambda value: optional_text(value))


class TransactionUpdate(StrictModel):
    kind: Kind | None = None
    amount_minor: Minor | None = None
    date: Day | None = None
    title: short_text(80) | None = None
    note: str | None = None
    category_id: int | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "TransactionUpdate":
        for field in ("kind", "amount_minor", "date", "title"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    _clean_note = field_validator("note")(lambda value: optional_text(value))


class TransactionRead(ReadModel):
    id: int
    kind: Kind
    amount_minor: int
    date: Day
    title: str
    note: str | None
    category: CategoryMini | None


class CategoryTotal(ReadModel):
    category_id: int | None
    name: str
    color: str
    amount_minor: int


class DayTotal(ReadModel):
    date: Day
    income_minor: int
    expense_minor: int


class MonthTotal(ReadModel):
    month: Month
    income_minor: int
    expense_minor: int


class TransactionSummary(ReadModel):
    month: Month
    income_minor: int
    expense_minor: int
    balance_minor: int
    savings_rate: float | None
    expense_by_category: list[CategoryTotal]
    income_by_category: list[CategoryTotal]
    daily: list[DayTotal]
    trend: list[MonthTotal]


# ------------------------------------------------------------------- recurring items

PaymentStatus = Literal["paid", "due", "overdue", "upcoming"]


class RecurringBase(StrictModel):
    name: short_text(60)
    amount_minor: Minor
    due_day: int
    start_month: Month
    end_month: Month | None = None
    category_id: int | None = None
    note: str | None = None

    @field_validator("due_day")
    @classmethod
    def _valid_day(cls, value: int) -> int:
        if not 1 <= value <= 31:
            raise ValueError("Due day must be between 1 and 31")
        return value

    _clean_note = field_validator("note")(lambda value: optional_text(value))


class RecurringCreate(RecurringBase):
    kind: Kind

    @model_validator(mode="after")
    def _end_after_start(self) -> "RecurringCreate":
        if self.end_month is not None and self.end_month < self.start_month:
            raise ValueError("End month can't be before the start month")
        return self


class RecurringUpdate(StrictModel):
    name: short_text(60) | None = None
    amount_minor: Minor | None = None
    due_day: int | None = None
    start_month: Month | None = None
    end_month: Month | None = None
    category_id: int | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "RecurringUpdate":
        for field in ("name", "amount_minor", "due_day", "start_month"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if self.due_day is not None and not 1 <= self.due_day <= 31:
            raise ValueError("Due day must be between 1 and 31")
        return self

    _clean_note = field_validator("note")(lambda value: optional_text(value))


class MonthCell(ReadModel):
    month: Month
    status: PaymentStatus
    is_current: bool
    due_date: Day
    paid_on: Day | None
    amount_minor: int


class RecurringRead(ReadModel):
    id: int
    kind: Kind
    name: str
    amount_minor: int
    due_day: int
    start_month: Month
    end_month: Month | None
    category: CategoryMini | None
    note: str | None
    current: MonthCell | None


class BoardRow(ReadModel):
    item: RecurringRead
    cells: list[MonthCell]
    paid_count: int
    unpaid_count: int


class Board(ReadModel):
    months: list[Month]
    current_month: Month
    rows: list[BoardRow]


class PaymentUpdate(StrictModel):
    paid: bool
    paid_on: Day | None = None
    amount_minor: Minor | None = None
