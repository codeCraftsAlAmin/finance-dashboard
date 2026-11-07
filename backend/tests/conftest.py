import os

# Must be set before the app is imported so it binds to an isolated in-memory database.
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def _fresh_database():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def register(client: TestClient, email: str = "ada@example.com", **overrides) -> dict:
    body = {
        "name": "Ada",
        "email": email,
        "password": "correct-horse",
        "timezone": "Asia/Dhaka",
        **overrides,
    }
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def authed(client: TestClient) -> TestClient:
    register(client)
    return client


@pytest.fixture
def other_client() -> TestClient:
    """A second, independent browser session for a different user."""
    second = TestClient(app)
    register(second, email="bob@example.com", name="Bob")
    return second


@pytest.fixture(autouse=True)
def _reset_limiters():
    from app.ratelimit import login_limiter, vault_limiter

    login_limiter.reset()
    vault_limiter.reset()


def today():
    """Today's date in the test users' timezone (Asia/Dhaka), which is what the API uses."""
    import datetime as dt
    from zoneinfo import ZoneInfo

    return dt.datetime.now(ZoneInfo("Asia/Dhaka")).date()
