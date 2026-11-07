from datetime import datetime

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.common import ReadModel, StrictModel, short_text
from app.timeutil import is_valid_timezone


def _check_timezone(value: str) -> str:
    if not is_valid_timezone(value):
        raise ValueError("Unknown timezone. Use an IANA name such as 'Asia/Dhaka'.")
    return value


class UserCreate(StrictModel):
    name: short_text(60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    timezone: str = "UTC"

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def _password_fits_bcrypt(cls, value: str) -> str:
        # bcrypt only reads the first 72 bytes; multi-byte characters can exceed that.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes long")
        return value

    _validate_timezone = field_validator("timezone")(_check_timezone)


class LoginRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserUpdate(StrictModel):
    name: short_text(60) | None = None
    timezone: str | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def _no_explicit_nulls(self) -> "UserUpdate":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    @field_validator("timezone")
    @classmethod
    def _validate_timezone(cls, value: str | None) -> str | None:
        return value if value is None else _check_timezone(value)


class UserRead(ReadModel):
    id: int
    email: str
    name: str
    timezone: str
    currency: str
    has_vault: bool
    created_at: datetime
