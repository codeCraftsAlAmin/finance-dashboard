"""Building blocks shared by every schema."""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"
_MONTH_RE = re.compile(MONTH_PATTERN)

Month = Annotated[str, StringConstraints(pattern=MONTH_PATTERN)]
# Whole numbers of minor units (paisa). Up to 1,000,000,000.00 in major units.
Minor = Annotated[int, Field(gt=0, le=100_000_000_000)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Kind = Literal["income", "expense"]


def short_text(max_length: int, min_length: int = 1):
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)
    ]


def optional_text(value: str | None) -> str | None:
    """Blank strings become None so empty form fields don't store ''."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def is_month(value: str) -> bool:
    return bool(_MONTH_RE.match(value))


class StrictModel(BaseModel):
    """Request bodies reject unknown fields so typos fail loudly."""

    model_config = ConfigDict(extra="forbid")


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
