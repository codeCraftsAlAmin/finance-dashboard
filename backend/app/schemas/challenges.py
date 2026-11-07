"""Challenge request and response bodies."""

import datetime as dt
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.common import ReadModel, StrictModel, optional_text, short_text

Day = dt.date
ChallengeState = Literal["upcoming", "active", "overdue", "completed"]


class ChallengeCreate(StrictModel):
    title: short_text(80)
    goal: str | None = Field(default=None, max_length=300)
    start_date: Day
    duration_days: int = Field(default=30, ge=7, le=90)

    _clean_goal = field_validator("goal")(lambda value: optional_text(value))

    @field_validator("start_date")
    @classmethod
    def _not_too_far(cls, value: dt.date) -> dt.date:
        if value.year < 2000 or value.year > 2100:
            raise ValueError("Pick a start date between 2000 and 2100")
        return value


class ChallengeUpdate(StrictModel):
    title: short_text(80) | None = None
    goal: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _title_not_null(self) -> "ChallengeUpdate":
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        return self

    _clean_goal = field_validator("goal")(lambda value: optional_text(value))


class DayUpdate(StrictModel):
    done: bool
    note: str | None = Field(default=None, max_length=200)

    _clean_note = field_validator("note")(lambda value: optional_text(value))


class ChallengeComplete(StrictModel):
    outcome: str | None = Field(default=None, max_length=300)

    _clean_outcome = field_validator("outcome")(lambda value: optional_text(value))


class CheckinRead(ReadModel):
    date: Day
    note: str | None


class ChallengeRead(ReadModel):
    id: int
    title: str
    goal: str | None
    start_date: Day
    end_date: Day
    duration_days: int
    state: ChallengeState
    completed_on: Day | None
    completed_early: bool
    days_early: int
    outcome: str | None
    days_done: int
    days_elapsed: int
    days_left: int
    percent: int
    current_streak: int
    best_streak: int
    checked_today: bool
    checkins: list[CheckinRead]


class ChallengeSummary(ReadModel):
    active_count: int
    completed_count: int
    early_count: int
    total_days_done: int
    best_streak: int
