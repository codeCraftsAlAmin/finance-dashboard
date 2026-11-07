"""Income and expense categories."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.deps import CurrentUser, DbSession, get_owned
from app.models import Category
from app.schemas.finance import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])

_DUPLICATE = "You already have a category with that name"


@router.get("", response_model=list[CategoryRead])
def list_categories(user: CurrentUser, db: DbSession) -> list[Category]:
    return list(
        db.scalars(
            select(Category)
            .where(Category.user_id == user.id)
            .order_by(Category.kind, Category.name)
        )
    )


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, user: CurrentUser, db: DbSession) -> Category:
    category = Category(user_id=user.id, **payload.model_dump())
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, _DUPLICATE) from None
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int, payload: CategoryUpdate, user: CurrentUser, db: DbSession
) -> Category:
    category = get_owned(db, Category, category_id, user, "Category")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, _DUPLICATE) from None
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, user: CurrentUser, db: DbSession) -> None:
    """Transactions keep existing; they just become uncategorized."""
    db.delete(get_owned(db, Category, category_id, user, "Category"))
    db.commit()
