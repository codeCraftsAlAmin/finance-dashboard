"""Dates worth remembering: birthdays, anniversaries, exams, deadlines."""

from fastapi import APIRouter, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession, get_owned
from app.models import ImportantDate
from app.schemas.life import DateCreate, DateRead, DateUpdate
from app.services import occasions
from app.timeutil import today_for

router = APIRouter(prefix="/dates", tags=["dates"])


def _present(item: ImportantDate, today) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "date": item.date,
        "kind": item.kind,
        "repeat_yearly": item.repeat_yearly,
        "notes": item.notes,
        **occasions.describe(item, today),
    }


@router.get("", response_model=list[DateRead])
def list_dates(user: CurrentUser, db: DbSession) -> list[dict]:
    today = today_for(user)
    items = db.scalars(select(ImportantDate).where(ImportantDate.user_id == user.id))
    described = [_present(item, today) for item in items]
    return sorted(described, key=occasions.sort_key)


@router.post("", response_model=DateRead, status_code=status.HTTP_201_CREATED)
def create_date(payload: DateCreate, user: CurrentUser, db: DbSession) -> dict:
    item = ImportantDate(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return _present(item, today_for(user))


@router.patch("/{date_id}", response_model=DateRead)
def update_date(date_id: int, payload: DateUpdate, user: CurrentUser, db: DbSession) -> dict:
    item = get_owned(db, ImportantDate, date_id, user, "Date")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    return _present(item, today_for(user))


@router.delete("/{date_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_date(date_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(get_owned(db, ImportantDate, date_id, user, "Date"))
    db.commit()
