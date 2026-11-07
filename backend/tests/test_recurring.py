from fastapi.testclient import TestClient

from app.services.months import add_months, month_of
from tests.conftest import today

NOW = month_of(today())


def make(client: TestClient, **fields):
    body = {
        "kind": "expense",
        "name": "Wifi",
        "amount_minor": 120_000,
        "due_day": 10,
        "start_month": add_months(NOW, -3),
    }
    response = client.post("/api/recurring", json={**body, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_board_marks_unpaid_past_months_overdue(authed: TestClient):
    item = make(authed)
    board = authed.get("/api/recurring/board").json()
    assert board["current_month"] == NOW
    cells = board["rows"][0]["cells"]
    assert [c["month"] for c in cells] == [add_months(NOW, -offset) for offset in (3, 2, 1, 0)]
    assert [c["status"] for c in cells[:3]] == ["overdue"] * 3
    assert cells[-1]["is_current"] is True
    assert board["rows"][0]["unpaid_count"] == 4 and item["current"]["month"] == NOW


def test_current_month_is_due_until_the_due_day_passes(authed: TestClient):
    day = today().day
    upcoming = make(authed, name="A", due_day=min(31, day + 1) if day < 28 else 28)
    late = make(authed, name="B", due_day=max(1, day - 1))
    if day < 28:
        assert upcoming["current"]["status"] == "due"
    if day > 1:
        assert late["current"]["status"] == "overdue"


def test_paying_a_month_creates_one_linked_transaction(authed: TestClient):
    item = make(authed)
    month = add_months(NOW, -1)
    path = f"/api/recurring/{item['id']}/payments/{month}"
    first = authed.put(path, json={"paid": True})
    assert first.status_code == 200 and first.json()["status"] == "paid"
    again = authed.put(path, json={"paid": True})  # idempotent
    assert again.status_code == 200

    transactions = authed.get("/api/transactions").json()
    assert len(transactions) == 1
    assert transactions[0]["amount_minor"] == 120_000 and transactions[0]["kind"] == "expense"
    assert transactions[0]["title"].startswith("Wifi")

    row = authed.get("/api/recurring/board").json()["rows"][0]
    assert row["paid_count"] == 1 and row["unpaid_count"] == 3


def test_paid_with_a_different_amount_updates_the_transaction(authed: TestClient):
    item = make(authed)
    path = f"/api/recurring/{item['id']}/payments/{NOW}"
    authed.put(path, json={"paid": True})
    authed.put(path, json={"paid": True, "amount_minor": 99_000})
    transactions = authed.get("/api/transactions").json()
    assert len(transactions) == 1 and transactions[0]["amount_minor"] == 99_000


def test_unpaying_removes_the_transaction(authed: TestClient):
    item = make(authed)
    path = f"/api/recurring/{item['id']}/payments/{NOW}"
    authed.put(path, json={"paid": True})
    undone = authed.put(path, json={"paid": False})
    assert undone.json()["status"] in ("due", "overdue")
    assert authed.get("/api/transactions").json() == []
    assert authed.put(path, json={"paid": False}).status_code == 200  # idempotent


def test_income_item_records_income(authed: TestClient):
    item = make(authed, kind="income", name="Tuition", amount_minor=300_000)
    authed.put(f"/api/recurring/{item['id']}/payments/{NOW}", json={"paid": True})
    summary = authed.get("/api/transactions/summary").json()
    assert summary["income_minor"] == 300_000 and summary["expense_minor"] == 0


def test_cannot_pay_future_or_inactive_months(authed: TestClient):
    item = make(authed)
    base = f"/api/recurring/{item['id']}/payments"
    assert authed.put(f"{base}/{add_months(NOW, 1)}", json={"paid": True}).status_code == 422
    assert authed.put(f"{base}/{add_months(NOW, -9)}", json={"paid": True}).status_code == 422
    assert authed.put(f"{base}/2026-13", json={"paid": True}).status_code == 422
    future_day = authed.put(f"{base}/{NOW}", json={"paid": True, "paid_on": "2999-01-01"})
    assert future_day.status_code == 422


def test_ended_items_stop_appearing(authed: TestClient):
    make(authed, end_month=add_months(NOW, -2))
    cells = authed.get("/api/recurring/board").json()["rows"][0]["cells"]
    assert len(cells) == 2
    assert authed.get("/api/recurring").json()[0]["current"] is None


def test_due_day_31_is_clamped_in_short_months(authed: TestClient):
    make(authed, due_day=31, start_month="2026-02")
    cells = authed.get("/api/recurring/board", params={"months": 24}).json()["rows"][0]["cells"]
    feb = next(c for c in cells if c["month"] == "2026-02")
    assert feb["due_date"] == "2026-02-28"


def test_validation_and_isolation(authed: TestClient, other_client: TestClient):
    bad = {"kind": "expense", "name": "x", "amount_minor": 1, "due_day": 32, "start_month": NOW}
    assert authed.post("/api/recurring", json=bad).status_code == 422
    reversed_range = {**bad, "due_day": 5, "end_month": add_months(NOW, -1)}
    assert authed.post("/api/recurring", json=reversed_range).status_code == 422

    item = make(authed)
    assert other_client.get("/api/recurring").json() == []
    assert other_client.delete(f"/api/recurring/{item['id']}").status_code == 404
    assert (
        other_client.put(f"/api/recurring/{item['id']}/payments/{NOW}", json={"paid": True})
    ).status_code == 404


def test_deleting_an_item_keeps_past_transactions(authed: TestClient):
    item = make(authed)
    authed.put(f"/api/recurring/{item['id']}/payments/{NOW}", json={"paid": True})
    assert authed.delete(f"/api/recurring/{item['id']}").status_code == 204
    assert len(authed.get("/api/transactions").json()) == 1
