from fastapi.testclient import TestClient

from tests.conftest import register


def test_register_seeds_default_categories(client: TestClient):
    user = register(client)
    assert user["currency"] == "BDT" and user["has_vault"] is False
    categories = client.get("/api/categories").json()
    names = {c["name"] for c in categories}
    assert {"Tuition", "Books", "Bills"} <= names


def test_duplicate_email_is_rejected(client: TestClient):
    register(client)
    again = client.post(
        "/api/auth/register",
        json={"name": "X", "email": "ADA@example.com", "password": "correct-horse"},
    )
    assert again.status_code == 409


def test_login_logout_and_protected_routes(client: TestClient):
    register(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    bad = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "nope"})
    assert bad.status_code == 401
    ok = client.post(
        "/api/auth/login", json={"email": "ada@example.com", "password": "correct-horse"}
    )
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_login_is_rate_limited_after_repeated_failures(client: TestClient):
    register(client)
    client.post("/api/auth/logout")
    payload = {"email": "ada@example.com", "password": "wrong"}
    codes = [client.post("/api/auth/login", json=payload).status_code for _ in range(9)]
    assert codes[:8] == [401] * 8
    assert codes[8] == 429
    # Even the right password is refused while locked out.
    right = {"email": "ada@example.com", "password": "correct-horse"}
    assert client.post("/api/auth/login", json=right).status_code == 429


def test_update_currency_and_reject_nulls(authed: TestClient):
    assert authed.patch("/api/auth/me", json={"currency": "USD"}).json()["currency"] == "USD"
    assert authed.patch("/api/auth/me", json={"timezone": None}).status_code == 422
    assert authed.patch("/api/auth/me", json={"currency": "usd"}).status_code == 422


def test_every_data_route_requires_login(client: TestClient):
    for path in (
        "/api/overview",
        "/api/transactions",
        "/api/recurring",
        "/api/loans",
        "/api/books",
        "/api/dates",
        "/api/tools",
        "/api/vault/accounts",
    ):
        assert client.get(path).status_code == 401, path
