"""Categories every new account starts with. Colors come from the chart palette."""

from sqlalchemy.orm import Session

from app.models import Category

# (kind, name, color)
DEFAULT_CATEGORIES = [
    ("income", "Tuition", "#1baf7a"),
    ("income", "Freelance", "#2a78d6"),
    ("income", "Gift", "#e87ba4"),
    ("income", "Other income", "#6250d6"),
    ("expense", "Food", "#eb6834"),
    ("expense", "Books", "#2a78d6"),
    ("expense", "Clothes", "#e87ba4"),
    ("expense", "Bills", "#6250d6"),
    ("expense", "Transport", "#eda100"),
    ("expense", "Learning", "#1baf7a"),
    ("expense", "Entertainment", "#e34948"),
    ("expense", "Other", "#8a8a85"),
]


def seed_categories(db: Session, user_id: int) -> None:
    db.add_all(
        Category(user_id=user_id, kind=kind, name=name, color=color)
        for kind, name, color in DEFAULT_CATEGORIES
    )
