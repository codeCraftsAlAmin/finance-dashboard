from fastapi.testclient import TestClient

from app.services.months import month_of
from tests.conftest import today


def category_id(client: TestClient, name: str) -> int:
    return next(c["id"] for c in client.get("/api/categories").json() if c["name"] == name)


def add(client: TestClient, **fields):
    body = {
        "kind": "expense",
        "amount_minor": 50_000,
        "date": today().isoformat(),
        "title": "Lunch",
    }
    return client.post("/api/transactions", json={**body, **fields})


def test_create_list_update_delete(authed: TestClient):
    food = category_id(authed, "Food")
    created = add(authed, category_id=food, note="  with friends ")
    assert created.status_code == 201
    row = created.json()
    assert row["category"]["name"] == "Food" and row["note"] == "with friends"

    assert len(authed.get("/api/transactions").json()) == 1
    patched = authed.patch(f"/api/transactions/{row['id']}", json={"amount_minor": 70_000})
    assert patched.json()["amount_minor"] == 70_000
    assert authed.delete(f"/api/transactions/{row['id']}").status_code == 204
    assert authed.get("/api/transactions").json() == []


def test_category_kind_must_match(authed: TestClient):
    assert add(authed, kind="income", category_id=category_id(authed, "Food")).status_code == 422


def test_changing_kind_clears_the_old_category(authed: TestClient):
    row = add(authed, category_id=category_id(authed, "Food")).json()
    switched = authed.patch(f"/api/transactions/{row['id']}", json={"kind": "income"}).json()
    assert switched["kind"] == "income" and switched["category"] is None


def test_amount_must_be_positive_whole_number(authed: TestClient):
    assert add(authed, amount_minor=0).status_code == 422
    assert add(authed, amount_minor=-5).status_code == 422
    assert add(authed, amount_minor=10.5).status_code == 422


def test_summary_totals_and_category_breakdown(authed: TestClient):
    tuition = category_id(authed, "Tuition")
    add(authed, kind="income", amount_minor=300_000, title="Tuition", category_id=tuition)
    add(authed, amount_minor=100_000, category_id=category_id(authed, "Food"))
    add(authed, amount_minor=50_000, category_id=category_id(authed, "Books"))
    add(authed, amount_minor=25_000)  # uncategorized

    summary = authed.get("/api/transactions/summary").json()
    assert summary["month"] == month_of(today())
    assert summary["income_minor"] == 300_000
    assert summary["expense_minor"] == 175_000
    assert summary["balance_minor"] == 125_000
    assert summary["savings_rate"] == round(125_000 / 300_000, 4)
    names = [c["name"] for c in summary["expense_by_category"]]
    assert names == ["Food", "Books", "Uncategorized"]
    assert len(summary["trend"]) == 6 and summary["trend"][-1]["expense_minor"] == 175_000
    assert sum(d["expense_minor"] for d in summary["daily"]) == 175_000


def test_summary_without_income_has_no_savings_rate(authed: TestClient):
    add(authed)
    assert authed.get("/api/transactions/summary").json()["savings_rate"] is None


def test_small_categories_are_folded_into_other(authed: TestClient):
    for index in range(8):
        name = f"Cat{index}"
        made = authed.post(
            "/api/categories", json={"kind": "expense", "name": name, "color": "#112233"}
        )
        add(authed, amount_minor=1000 * (index + 1), category_id=made.json()["id"])
    parts = authed.get("/api/transactions/summary").json()["expense_by_category"]
    assert len(parts) == 7 and parts[-1]["name"] == "Other"
    assert parts[-1]["amount_minor"] == 1000 + 2000


def test_filters(authed: TestClient):
    add(authed, title="Rice")
    add(authed, kind="income", title="Tuition")
    assert len(authed.get("/api/transactions", params={"kind": "income"}).json()) == 1
    assert len(authed.get("/api/transactions", params={"q": "ric"}).json()) == 1
    assert authed.get("/api/transactions", params={"month": "2001-01"}).json() == []
    assert authed.get("/api/transactions", params={"month": "2026-13"}).status_code == 422


def test_category_crud_and_delete_keeps_transactions(authed: TestClient):
    made = authed.post(
        "/api/categories", json={"kind": "expense", "name": "Pets", "color": "#aabbcc"}
    ).json()
    dup = authed.post(
        "/api/categories", json={"kind": "expense", "name": "Pets", "color": "#aabbcc"}
    )
    assert dup.status_code == 409
    row = add(authed, category_id=made["id"]).json()
    assert authed.delete(f"/api/categories/{made['id']}").status_code == 204
    after = authed.get("/api/transactions").json()
    assert after[0]["id"] == row["id"] and after[0]["category"] is None


def test_users_cannot_see_or_touch_each_others_rows(authed: TestClient, other_client: TestClient):
    row = add(authed).json()
    assert other_client.get("/api/transactions").json() == []
    assert (
        other_client.patch(f"/api/transactions/{row['id']}", json={"title": "x"}).status_code == 404
    )
    assert other_client.delete(f"/api/transactions/{row['id']}").status_code == 404
    foreign = category_id(authed, "Food")
    assert add(other_client, category_id=foreign).status_code == 404
    assert other_client.get("/api/transactions/summary").json()["expense_minor"] == 0
