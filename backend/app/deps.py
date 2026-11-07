"""Shared FastAPI dependencies."""

from typing import Annotated, TypeVar

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import vault
from app.config import settings
from app.database import Base, get_db
from app.models import User
from app.security import decode_access_token

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(request: Request, db: DbSession) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise unauthorized

    user_id = decode_access_token(token)
    if user_id is None:
        raise unauthorized

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_vault_key(
    user: CurrentUser, x_vault_token: Annotated[str | None, Header()] = None
) -> bytes:
    """The vault key from the unlock token header, or 423 (locked) if missing or expired."""
    locked = HTTPException(status.HTTP_423_LOCKED, "The vault is locked. Unlock it first.")
    if not x_vault_token:
        raise locked
    key = vault.read_token(x_vault_token, user.id)
    if key is None:
        raise locked
    return key


VaultKey = Annotated[bytes, Depends(get_vault_key)]

Model = TypeVar("Model", bound=Base)


def get_owned(db: Session, model: type[Model], object_id: int, user: User, label: str) -> Model:
    """Load a row that belongs to `user`. A 404 (not 403) so other people's ids can't be probed."""
    row = db.get(model, object_id)
    if row is None or getattr(row, "user_id", None) != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    return row
