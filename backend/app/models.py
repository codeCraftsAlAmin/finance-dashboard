"""SQLAlchemy ORM models.

Money is stored as integers in minor units (paisa for BDT) so sums are always exact.
Dates are plain DATE columns; months are "YYYY-MM" strings.
Enumerated fields are short strings guarded by CHECK constraints, which behave the same on
SQLite and PostgreSQL.
"""

import datetime as dt

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(60))
    password_hash: Mapped[str] = mapped_column(String(128))
    # IANA name such as "Asia/Dhaka". Decides what "today" and "this month" mean.
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", server_default="UTC")
    currency: Mapped[str] = mapped_column(String(3), default="BDT", server_default="BDT")
    # Vault: a random salt for the key derivation, and a small encrypted value used to check
    # a master password. The master password itself is never stored.
    vault_salt: Mapped[bytes | None] = mapped_column(LargeBinary(16), default=None)
    vault_verifier: Mapped[bytes | None] = mapped_column(LargeBinary(128), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    @property
    def has_vault(self) -> bool:
        return self.vault_salt is not None


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("user_id", "kind", "name", name="uq_categories_user_kind_name"),
        CheckConstraint("kind IN ('income', 'expense')", name="kind_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(7))
    name: Mapped[str] = mapped_column(String(40))
    color: Mapped[str] = mapped_column(String(7))


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("kind IN ('income', 'expense')", name="kind_valid"),
        CheckConstraint("amount_minor > 0", name="amount_positive"),
        Index("ix_transactions_user_id_date", "user_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(7))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    date: Mapped[dt.date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(String(200), default=None)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), default=None, index=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    category: Mapped[Category | None] = relationship()


class RecurringItem(Base):
    """Something that repeats every month: tuition you earn, a wifi bill you pay."""

    __tablename__ = "recurring_items"
    __table_args__ = (
        CheckConstraint("kind IN ('income', 'expense')", name="kind_valid"),
        CheckConstraint("amount_minor > 0", name="amount_positive"),
        CheckConstraint("due_day BETWEEN 1 AND 31", name="due_day_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(7))
    name: Mapped[str] = mapped_column(String(60))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    due_day: Mapped[int] = mapped_column()
    start_month: Mapped[str] = mapped_column(String(7))
    end_month: Mapped[str | None] = mapped_column(String(7), default=None)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), default=None
    )
    note: Mapped[str | None] = mapped_column(String(200), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    category: Mapped[Category | None] = relationship()
    payments: Mapped[list["MonthPayment"]] = relationship(
        back_populates="item", cascade="all, delete-orphan", passive_deletes=True
    )


class MonthPayment(Base):
    """A row exists only for months that are paid (or received)."""

    __tablename__ = "month_payments"
    __table_args__ = (UniqueConstraint("item_id", "month", name="uq_month_payments_item_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("recurring_items.id", ondelete="CASCADE"))
    month: Mapped[str] = mapped_column(String(7))
    paid_on: Mapped[dt.date] = mapped_column(Date)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    item: Mapped[RecurringItem] = relationship(back_populates="payments")


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint("direction IN ('lent', 'borrowed')", name="direction_valid"),
        CheckConstraint("amount_minor > 0", name="amount_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    person: Mapped[str] = mapped_column(String(60))
    direction: Mapped[str] = mapped_column(String(8))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    date: Mapped[dt.date] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(String(120), default=None)
    due_date: Mapped[dt.date | None] = mapped_column(Date, default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    payments: Mapped[list["LoanPayment"]] = relationship(
        back_populates="loan",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LoanPayment.date, LoanPayment.id",
    )


class LoanPayment(Base):
    """A (partial) repayment of a loan, in either direction."""

    __tablename__ = "loan_payments"
    __table_args__ = (CheckConstraint("amount_minor > 0", name="amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id", ondelete="CASCADE"), index=True)
    date: Mapped[dt.date] = mapped_column(Date)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    note: Mapped[str | None] = mapped_column(String(120), default=None)

    loan: Mapped[Loan] = relationship(back_populates="payments")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint("status IN ('to_buy', 'to_read', 'reading', 'read')", name="status_valid"),
        CheckConstraint("rating IS NULL OR rating BETWEEN 1 AND 5", name="rating_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    author: Mapped[str] = mapped_column(String(80))
    price_minor: Mapped[int | None] = mapped_column(BigInteger, default=None)
    status: Mapped[str] = mapped_column(String(8), default="to_buy")
    rating: Mapped[int | None] = mapped_column(default=None)
    purchased_on: Mapped[dt.date | None] = mapped_column(Date, default=None)
    finished_on: Mapped[dt.date | None] = mapped_column(Date, default=None)
    notes: Mapped[str | None] = mapped_column(String(300), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class ImportantDate(Base):
    __tablename__ = "important_dates"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('birthday', 'anniversary', 'exam', 'deadline', 'memory', 'other')",
            name="kind_valid",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(100))
    date: Mapped[dt.date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(11), default="other")
    repeat_yearly: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(String(300), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class LearnTool(Base):
    __tablename__ = "learn_tools"
    __table_args__ = (
        CheckConstraint("priority IN ('high', 'medium', 'low')", name="priority_valid"),
        CheckConstraint("status IN ('next', 'learning', 'done')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    details: Mapped[str | None] = mapped_column(String(500), default=None)
    source_url: Mapped[str | None] = mapped_column(String(500), default=None)
    priority: Mapped[str] = mapped_column(String(6), default="medium")
    status: Mapped[str] = mapped_column(String(8), default="next")
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class Challenge(Base):
    """A time-boxed challenge, such as learning a skill in 30 days, with one check-in per day."""

    __tablename__ = "challenges"
    __table_args__ = (
        CheckConstraint("duration_days BETWEEN 7 AND 90", name="duration_valid"),
        CheckConstraint("status IN ('active', 'completed')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(80))
    goal: Mapped[str | None] = mapped_column(String(300), default=None)
    start_date: Mapped[dt.date] = mapped_column(Date)
    duration_days: Mapped[int] = mapped_column(default=30)
    status: Mapped[str] = mapped_column(String(9), default="active")
    completed_on: Mapped[dt.date | None] = mapped_column(Date, default=None)
    outcome: Mapped[str | None] = mapped_column(String(300), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    checkins: Mapped[list["ChallengeCheckin"]] = relationship(
        back_populates="challenge",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ChallengeCheckin.date",
    )

    @property
    def end_date(self) -> dt.date:
        return self.start_date + dt.timedelta(days=self.duration_days - 1)


class ChallengeCheckin(Base):
    """One day of a challenge marked as done."""

    __tablename__ = "challenge_checkins"
    __table_args__ = (UniqueConstraint("challenge_id", "date", name="one_checkin_per_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(
        ForeignKey("challenges.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[dt.date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(200), default=None)

    challenge: Mapped[Challenge] = relationship(back_populates="checkins")


class VaultAccount(Base):
    """A saved login. The password and notes are stored encrypted (AES-GCM)."""

    __tablename__ = "vault_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    service: Mapped[str] = mapped_column(String(80))
    username: Mapped[str] = mapped_column(String(120))
    url: Mapped[str | None] = mapped_column(String(300), default=None)
    category: Mapped[str] = mapped_column(String(30), default="Other")
    password_encrypted: Mapped[bytes] = mapped_column(LargeBinary(1024))
    notes_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary(2048), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
