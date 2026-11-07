"""Skill challenges (for example "learn Docker in 30 days") with daily check-ins."""

import datetime as dt

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession, get_owned
from app.models import Challenge
from app.schemas.challenges import (
    ChallengeComplete,
    ChallengeCreate,
    ChallengeRead,
    ChallengeSummary,
    ChallengeUpdate,
    DayUpdate,
)
from app.services import challenges as svc
from app.timeutil import today_for

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _all(db: DbSession, user_id: int) -> list[Challenge]:
    return list(
        db.scalars(
            select(Challenge)
            .options(selectinload(Challenge.checkins))
            .where(Challenge.user_id == user_id)
        )
    )


def _load(db: DbSession, user, challenge_id: int) -> Challenge:
    return get_owned(db, Challenge, challenge_id, user, "Challenge")


@router.get("", response_model=list[ChallengeRead])
def list_challenges(user: CurrentUser, db: DbSession) -> list[dict]:
    """Running challenges first (newest start first), then completed ones (latest first)."""
    today = today_for(user)
    items = [svc.describe(c, today) for c in _all(db, user.id)]
    open_items = sorted((i for i in items if i["state"] != "completed"), key=lambda i: i["start_date"], reverse=True)
    done_items = sorted((i for i in items if i["state"] == "completed"), key=lambda i: i["completed_on"], reverse=True)
    return open_items + done_items


@router.get("/summary", response_model=ChallengeSummary)
def summary(user: CurrentUser, db: DbSession) -> dict:
    today = today_for(user)
    return svc.summarize([svc.describe(c, today) for c in _all(db, user.id)])


@router.post("", response_model=ChallengeRead, status_code=status.HTTP_201_CREATED)
def create_challenge(payload: ChallengeCreate, user: CurrentUser, db: DbSession) -> dict:
    challenge = Challenge(user_id=user.id, **payload.model_dump())
    db.add(challenge)
    db.commit()
    return svc.describe(challenge, today_for(user))


@router.patch("/{challenge_id}", response_model=ChallengeRead)
def update_challenge(
    challenge_id: int, payload: ChallengeUpdate, user: CurrentUser, db: DbSession
) -> dict:
    challenge = _load(db, user, challenge_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(challenge, field, value)
    db.commit()
    return svc.describe(challenge, today_for(user))


@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_challenge(challenge_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(_load(db, user, challenge_id))
    db.commit()


@router.put("/{challenge_id}/days/{day}", response_model=ChallengeRead)
def set_day(
    challenge_id: int, day: dt.date, payload: DayUpdate, user: CurrentUser, db: DbSession
) -> dict:
    challenge = _load(db, user, challenge_id)
    today = today_for(user)
    svc.set_day(db, challenge, day, done=payload.done, note=payload.note, today=today)
    return svc.describe(challenge, today)


@router.post("/{challenge_id}/complete", response_model=ChallengeRead)
def complete(
    challenge_id: int, payload: ChallengeComplete, user: CurrentUser, db: DbSession
) -> dict:
    """Claim a challenge as completed, at any time, even before its deadline."""
    challenge = _load(db, user, challenge_id)
    today = today_for(user)
    svc.complete(db, challenge, payload.outcome, today)
    return svc.describe(challenge, today)
