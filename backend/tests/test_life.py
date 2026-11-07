import datetime as dt

from fastapi.testclient import TestClient

from app.services.occasions import next_occurrence
from tests.conftest import today

# ----------------------------------------------------------------------------- loans


def lend(client: TestClient, **fields):
    body = {
        "person": "Rahim",
        "direction": "lent",
        "amount_minor": 100_000,
        "date": today().isoformat(),
        "reason": "Book fair",
    }
    response = client.post("/api/loans", json={**body, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_loan_payments_reduce_what_is_owed(authed: TestClient):
    loan = lend(authed)
    after = authed.post(
        f"/api/loans/{loan['id']}/payments",
        json={"date": today().isoformat(), "amount_minor": 40_000},
    ).json()
    assert after["paid_minor"] == 40_000 and after["remaining_minor"] == 60_000
    assert after["settled"] is False

    too_much = authed.post(
        f"/api/loans/{loan['id']}/payments",
        json={"date": today().isoformat(), "amount_minor": 60_001},
    )
    assert too_much.status_code == 422

    settled = authed.post(
        f"/api/loans/{loan['id']}/payments",
        json={"date": today().isoformat(), "amount_minor": 60_000},
    ).json()
    assert settled["settled"] is True and len(settled["payments"]) == 2

    reopened = authed.delete(f"/api/loans/{loan['id']}/payments/{settled['payments'][0]['id']}")
    assert reopened.json()["settled"] is False


def test_loan_summary_nets_per_person(authed: TestClient):
    lend(authed, person="Rahim", amount_minor=100_000)
    lend(authed, person="rahim ", direction="borrowed", amount_minor=30_000)
    lend(authed, person="Sumi", direction="borrowed", amount_minor=50_000)
    summary = authed.get("/api/loans/summary").json()
    assert summary["lent_outstanding_minor"] == 100_000
    assert summary["borrowed_outstanding_minor"] == 80_000
    assert summary["net_minor"] == 20_000 and summary["open_count"] == 3
    people = {p["person"]: p["net_minor"] for p in summary["people"]}
    assert sorted(people.values()) == [-50_000, 70_000]
    assert len(people) == 2  # "Rahim" and "rahim " are one person


def test_overdue_and_status_filter(authed: TestClient):
    yesterday = (today() - dt.timedelta(days=1)).isoformat()
    lend(authed, due_date=yesterday)
    done = lend(authed, person="Sumi", amount_minor=10_000)
    authed.post(
        f"/api/loans/{done['id']}/payments",
        json={"date": today().isoformat(), "amount_minor": 10_000},
    )
    assert [x["overdue"] for x in authed.get("/api/loans", params={"status": "open"}).json()] == [
        True
    ]
    assert len(authed.get("/api/loans", params={"status": "settled"}).json()) == 1
    assert authed.get("/api/loans", params={"status": "nope"}).status_code == 422


def test_loan_isolation(authed: TestClient, other_client: TestClient):
    loan = lend(authed)
    assert other_client.get("/api/loans").json() == []
    body = {"date": today().isoformat(), "amount_minor": 1}
    assert other_client.post(f"/api/loans/{loan['id']}/payments", json=body).status_code == 404


# ----------------------------------------------------------------------------- books


def book(client: TestClient, **fields):
    body = {"title": "Clean Code", "author": "Robert Martin", "price_minor": 80_000}
    response = client.post("/api/books", json={**body, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_buying_a_book_records_a_books_expense(authed: TestClient):
    wished = book(authed)
    assert wished["status"] == "to_buy" and wished["purchased_on"] is None
    bought = authed.post(f"/api/books/{wished['id']}/purchase", json={}).json()
    assert bought["status"] == "to_read" and bought["purchased_on"] == today().isoformat()
    expense = authed.get("/api/transactions").json()[0]
    assert expense["amount_minor"] == 80_000 and expense["category"]["name"] == "Books"
    assert authed.post(f"/api/books/{wished['id']}/purchase", json={}).status_code == 409


def test_purchase_without_recording_expense(authed: TestClient):
    wished = book(authed)
    authed.post(f"/api/books/{wished['id']}/purchase", json={"record_expense": False})
    assert authed.get("/api/transactions").json() == []


def test_finishing_a_book_sets_dates_and_summary(authed: TestClient):
    first = book(authed, status="reading")
    done = authed.patch(f"/api/books/{first['id']}", json={"status": "read", "rating": 5}).json()
    assert done["finished_on"] == today().isoformat() and done["rating"] == 5
    book(authed, title="Refactoring", price_minor=120_000)
    summary = authed.get("/api/books/summary").json()
    assert summary["read_count"] == 1 and summary["read_this_year"] == 1
    assert summary["to_buy_count"] == 1 and summary["to_buy_total_minor"] == 120_000
    assert summary["spent_on_books_minor"] == 80_000
    assert len(summary["read_by_month"]) == 6 and summary["read_by_month"][-1]["count"] == 1
    back = authed.patch(f"/api/books/{first['id']}", json={"status": "reading"}).json()
    assert back["finished_on"] is None


def test_book_validation(authed: TestClient):
    assert (
        authed.post("/api/books", json={"title": "x", "author": "y", "rating": 6}).status_code
        == 422
    )
    assert authed.post("/api/books", json={"title": "", "author": "y"}).status_code == 422
    assert authed.get("/api/books", params={"status": "bogus"}).status_code == 422


# ----------------------------------------------------------------------------- dates


def test_yearly_dates_roll_forward_and_sort_soonest_first(authed: TestClient):
    t = today()
    soon = t + dt.timedelta(days=3)
    authed.post(
        "/api/dates",
        json={
            "title": "Mom's birthday",
            "date": soon.replace(year=1970).isoformat(),
            "kind": "birthday",
        },
    )
    authed.post(
        "/api/dates",
        json={
            "title": "Passed",
            "date": (t - dt.timedelta(days=30)).isoformat(),
            "repeat_yearly": False,
        },
    )
    authed.post(
        "/api/dates",
        json={
            "title": "Exam",
            "date": (t + dt.timedelta(days=20)).isoformat(),
            "repeat_yearly": False,
        },
    )
    rows = authed.get("/api/dates").json()
    assert [r["title"] for r in rows] == ["Mom's birthday", "Exam", "Passed"]
    assert rows[0]["days_until"] == 3 and rows[0]["years"] == soon.year - 1970
    assert rows[2]["is_past"] is True and rows[2]["days_until"] < 0


def test_today_counts_as_zero_days_and_leap_day_falls_back():
    assert next_occurrence(dt.date(2000, 5, 5), dt.date(2026, 5, 5)) == dt.date(2026, 5, 5)
    assert next_occurrence(dt.date(2000, 2, 29), dt.date(2026, 3, 1)) == dt.date(2027, 2, 28)
    assert next_occurrence(dt.date(2000, 2, 29), dt.date(2027, 1, 1)) == dt.date(2027, 2, 28)
    assert next_occurrence(dt.date(2000, 2, 29), dt.date(2027, 3, 1)) == dt.date(2028, 2, 29)


# ----------------------------------------------------------------------------- tools


def test_tools_sorted_by_priority_and_summarised(authed: TestClient):
    for name, priority, status in (
        ("Docker", "low", "next"),
        ("Rust", "high", "next"),
        ("Redis", "medium", "learning"),
        ("Git", "high", "done"),
    ):
        made = authed.post(
            "/api/tools",
            json={
                "name": name,
                "priority": priority,
                "status": status,
                "source_url": "https://x.dev",
            },
        )
        assert made.status_code == 201
    assert [t["name"] for t in authed.get("/api/tools").json()] == [
        "Rust",
        "Redis",
        "Docker",
        "Git",
    ]
    summary = authed.get("/api/tools/summary").json()
    assert (summary["next_count"], summary["learning_count"], summary["done_count"]) == (2, 1, 1)
    assert summary["by_priority"] == {"high": 1, "medium": 1, "low": 1}


def test_tool_links_must_be_http(authed: TestClient):
    bad = authed.post("/api/tools", json={"name": "X", "source_url": "javascript:alert(1)"})
    assert bad.status_code == 422
    blank = authed.post("/api/tools", json={"name": "X", "source_url": "  "})
    assert blank.status_code == 201 and blank.json()["source_url"] is None


def test_overview_combines_everything(authed: TestClient):
    authed.post("/api/tools", json={"name": "Rust", "priority": "high"})
    lend(authed)
    book(authed, status="reading")
    overview = authed.get("/api/overview").json()
    assert overview["tools"]["next"][0]["name"] == "Rust"
    assert overview["loans"]["lent_outstanding_minor"] == 100_000
    assert overview["books"]["reading"][0]["title"] == "Clean Code"
    assert len(overview["trend"]) == 6
