"""Registration, login, logout and the current user."""

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.deps import CurrentUser, DbSession
from app.models import User
from app.ratelimit import login_limiter
from app.schemas.auth import LoginRequest, UserCreate, UserRead, UserUpdate
from app.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.defaults import seed_categories

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_OPTIONS = {"path": "/", "httponly": True, "samesite": "lax"}


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=create_access_token(user_id),
        max_age=settings.access_token_expire_minutes * 60,
        secure=settings.secure_cookies,
        **_COOKIE_OPTIONS,
    )


def _client_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{email.lower()}"


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, response: Response, db: DbSession) -> User:
    conflict = HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if db.scalar(select(User.id).where(User.email == payload.email)) is not None:
        raise conflict

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        timezone=payload.timezone,
    )
    db.add(user)
    try:
        db.flush()
        seed_categories(db, user.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict from None

    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserRead)
def login(payload: LoginRequest, request: Request, response: Response, db: DbSession) -> User:
    key = _client_key(request, payload.email)
    login_limiter.check(key)

    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    password_ok = verify_password(
        payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_ok:
        login_limiter.fail(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    login_limiter.reset(key)
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(
        key=settings.cookie_name, secure=settings.secure_cookies, **_COOKIE_OPTIONS
    )


@router.get("/me", response_model=UserRead)
def read_me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserUpdate, user: CurrentUser, db: DbSession) -> User:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return user
