"""Create a demo account full of realistic data: `python -m scripts.seed_demo`.

Login: demo@example.com / demo-password. The vault master password is "demo-master-pass".
Safe to run again: it replaces the demo account.
"""

import datetime as dt
import random

from sqlalchemy import select

from app import vault
from app.database import SessionLocal
from app.models import (
    Book,
    Category,
    Challenge,
    ChallengeCheckin,
    ImportantDate,
    LearnTool,
    Loan,
    LoanPayment,
    MonthPayment,
    RecurringItem,
    Transaction,
    User,
    VaultAccount,
)
from app.security import hash_password
from app.services.defaults import seed_categories
from app.services.months import add_months, month_of, month_start
from app.timeutil import today_for

EMAIL = "demo@example.com"


def main() -> None:
    random.seed(7)
    with SessionLocal() as db:
        old = db.scalar(select(User).where(User.email == EMAIL))
        if old:
            db.delete(old)
            db.commit()

        user = User(email=EMAIL, name="Demo", password_hash=hash_password("demo-password"), timezone="Asia/Dhaka")
        db.add(user)
        db.flush()
        seed_categories(db, user.id)
        db.flush()
        cat = {(c.kind, c.name): c.id for c in db.scalars(select(Category).where(Category.user_id == user.id))}
        today = today_for(user)
        now = month_of(today)
        first = add_months(now, -5)

        tuition = RecurringItem(user_id=user.id, kind="income", name="Tuition", amount_minor=300_000, due_day=5,
                                start_month=first, category_id=cat["income", "Tuition"])
        wifi = RecurringItem(user_id=user.id, kind="expense", name="WiFi bill", amount_minor=120_000, due_day=10,
                             start_month=first, category_id=cat["expense", "Bills"])
        tutor = RecurringItem(user_id=user.id, kind="expense", name="Tutor fee", amount_minor=200_000, due_day=15,
                              start_month=first, category_id=cat["expense", "Learning"])
        db.add_all([tuition, wifi, tutor])
        db.flush()

        for item in (tuition, wifi, tutor):
            for offset in range(5, -1, -1):
                month = add_months(now, -offset)
                due = month_start(month).replace(day=item.due_day)
                if offset == 0 and (today < due or item is tutor):
                    continue  # leave this month's bills open so the board has something to show
                if item is wifi and offset == 2:
                    continue  # one missed bill → "overdue"
                tx = Transaction(user_id=user.id, kind=item.kind, amount_minor=item.amount_minor, date=due,
                                 title=f"{item.name} · {month}", category_id=item.category_id)
                db.add(tx)
                db.flush()
                db.add(MonthPayment(item_id=item.id, month=month, paid_on=due, amount_minor=item.amount_minor,
                                    transaction_id=tx.id))

        spend = [("Food", 80, 450), ("Books", 400, 1200), ("Clothes", 600, 2200), ("Transport", 30, 200),
                 ("Entertainment", 100, 600)]
        for offset in range(5, -1, -1):
            month = add_months(now, -offset)
            for name, low, high in spend:
                for _ in range(random.randint(2, 5) if name in ("Food", "Transport") else 1):
                    day = month_start(month) + dt.timedelta(days=random.randint(0, 26))
                    if day > today:
                        continue
                    db.add(Transaction(user_id=user.id, kind="expense", amount_minor=random.randint(low, high) * 100,
                                       date=day, title=name, category_id=cat["expense", name]))
        db.add(Transaction(user_id=user.id, kind="income", amount_minor=80_000, date=today - dt.timedelta(days=9),
                           title="Freelance logo", category_id=cat["income", "Freelance"]))

        rahim = Loan(user_id=user.id, person="Rahim", direction="lent", amount_minor=500_000,
                     date=today - dt.timedelta(days=40), reason="Admission fee", due_date=today - dt.timedelta(days=5))
        rahim.payments.append(LoanPayment(date=today - dt.timedelta(days=20), amount_minor=200_000))
        db.add_all([
            rahim,
            Loan(user_id=user.id, person="Karim", direction="borrowed", amount_minor=150_000,
                 date=today - dt.timedelta(days=12), reason="Laptop repair", due_date=today + dt.timedelta(days=18)),
            Loan(user_id=user.id, person="Sadia", direction="lent", amount_minor=60_000,
                 date=today - dt.timedelta(days=60), reason="Lunch money"),
        ])

        db.add_all([
            Book(user_id=user.id, title="Clean Code", author="Robert C. Martin", price_minor=85_000, status="to_buy"),
            Book(user_id=user.id, title="Designing Data-Intensive Applications", author="Martin Kleppmann",
                 price_minor=160_000, status="to_buy"),
            Book(user_id=user.id, title="The Pragmatic Programmer", author="Hunt & Thomas", price_minor=95_000,
                 status="reading", purchased_on=today - dt.timedelta(days=30)),
            Book(user_id=user.id, title="Atomic Habits", author="James Clear", price_minor=55_000, status="read",
                 rating=5, purchased_on=today - dt.timedelta(days=90), finished_on=today - dt.timedelta(days=35)),
            Book(user_id=user.id, title="Deep Work", author="Cal Newport", price_minor=50_000, status="read",
                 rating=4, purchased_on=today - dt.timedelta(days=120), finished_on=today - dt.timedelta(days=70)),
        ])

        db.add_all([
            ImportantDate(user_id=user.id, title="Mom's birthday", date=dt.date(1975, 12, 3), kind="birthday"),
            ImportantDate(user_id=user.id, title="Friend's wedding", date=today + dt.timedelta(days=21), kind="other",
                          repeat_yearly=False),
            ImportantDate(user_id=user.id, title="First day at university", date=dt.date(2022, 11, 20), kind="memory"),
            ImportantDate(user_id=user.id, title="Final exam", date=today + dt.timedelta(days=45), kind="exam",
                          repeat_yearly=False),
        ])

        db.add_all([
            LearnTool(user_id=user.id, name="PostgreSQL", details="Indexes, EXPLAIN, transactions", priority="high",
                      status="learning", source_url="https://www.postgresql.org/docs/"),
            LearnTool(user_id=user.id, name="Docker", details="Containers for local dev", priority="high",
                      source_url="https://docs.docker.com/get-started/"),
            LearnTool(user_id=user.id, name="Playwright", details="End-to-end tests", priority="medium",
                      source_url="https://playwright.dev"),
            LearnTool(user_id=user.id, name="Redis", details="Caching and queues", priority="low"),
            LearnTool(user_id=user.id, name="Git rebase", priority="medium", status="done"),
        ])

        docker = Challenge(user_id=user.id, title="Learn Docker", goal="Containerise and deploy my app",
                           start_date=today - dt.timedelta(days=11), duration_days=30)
        for back in (11, 10, 9, 8, 6, 5, 4, 2, 1, 0):  # a few missed days
            docker.checkins.append(ChallengeCheckin(date=today - dt.timedelta(days=back)))
        typing = Challenge(user_id=user.id, title="Touch typing", goal="Reach 50 words per minute",
                           start_date=today - dt.timedelta(days=50), duration_days=30, status="completed",
                           completed_on=today - dt.timedelta(days=28), outcome="Hit 52 WPM")
        for back in range(50, 30, -1):
            typing.checkins.append(ChallengeCheckin(date=today - dt.timedelta(days=back)))
        git = Challenge(user_id=user.id, title="Git in depth", start_date=today - dt.timedelta(days=100),
                        duration_days=14, status="completed", completed_on=today - dt.timedelta(days=87),
                        outcome="Comfortable with rebase and bisect")
        for back in range(100, 86, -1):
            git.checkins.append(ChallengeCheckin(date=today - dt.timedelta(days=back)))
        db.add_all([docker, typing, git])

        salt = vault.new_salt()
        key = vault.derive_key("demo-master-pass", salt)
        user.vault_salt, user.vault_verifier = salt, vault.make_verifier(key)
        for service, username, category, url in (
            ("Gmail", "demo@gmail.com", "Email", "https://mail.google.com"),
            ("Facebook", "demo.user", "Social", "https://facebook.com"),
            ("GitHub", "demo-dev", "Developer", "https://github.com"),
        ):
            db.add(VaultAccount(user_id=user.id, service=service, username=username, category=category, url=url,
                                password_encrypted=vault.encrypt(key, f"demo-{service.lower()}-pw")))
        db.commit()
    print(f"Demo account ready: {EMAIL} / demo-password  (vault master password: demo-master-pass)")


if __name__ == "__main__":
    main()
