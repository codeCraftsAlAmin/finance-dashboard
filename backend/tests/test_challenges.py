import datetime as dt

from fastapi.testclient import TestClient

from app.models import Challenge
from app.services.challenges import describe
from tests.conftest import today


def make(client: TestClient, **fields):
    body = {"title": "Learn Docker", "goal": "Ship a container", "start_date": today().isoformat(), **fields}
    response = client.post("/api/challenges", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def check(client: TestClient, cid: int, day: dt.date, done: bool = True):
    return client.put(f"/api/challenges/{cid}/days/{day.isoformat()}", json={"done": done})


def test_create_defaults_to_30_days(authed: TestClient):
    c = make(authed)
    assert c["duration_days"] == 30
    assert c["end_date"] == (today() + dt.timedelta(days=29)).isoformat()
    assert c["state"] == "active" and c["days_done"] == 0 and c["days_left"] == 29


def test_duration_limits(authed: TestClient):
    for days in (3, 91):
        r = authed.post("/api/challenges", json={"title": "x", "start_date": today().isoformat(), "duration_days": days})
        assert r.status_code == 422


def test_checkin_is_idempotent_and_toggles(authed: TestClient):
    c = make(authed, start_date=(today() - dt.timedelta(days=5)).isoformat())
    assert check(authed, c["id"], today()).json()["days_done"] == 1
    assert check(authed, c["id"], today()).json()["days_done"] == 1  # same day twice
    after = check(authed, c["id"], today() - dt.timedelta(days=1)).json()
    assert after["days_done"] == 2 and after["current_streak"] == 2 and after["checked_today"] is True
    assert check(authed, c["id"], today(), done=False).json()["days_done"] == 1
    assert check(authed, c["id"], today(), done=False).status_code == 200  # un-checking twice is fine


def test_checkin_day_rules(authed: TestClient):
    c = make(authed, start_date=(today() - dt.timedelta(days=3)).isoformat())
    assert check(authed, c["id"], today() + dt.timedelta(days=1)).status_code == 422  # future
    assert check(authed, c["id"], today() - dt.timedelta(days=4)).status_code == 422  # before start
    late = make(authed, start_date=(today() - dt.timedelta(days=40)).isoformat(), duration_days=30)
    assert check(authed, late["id"], today()).status_code == 422  # after the end


def test_streaks_and_percent(authed: TestClient):
    c = make(authed, start_date=(today() - dt.timedelta(days=9)).isoformat(), duration_days=10)
    for back in (9, 8, 7, 3, 2, 1, 0):
        check(authed, c["id"], today() - dt.timedelta(days=back))
    got = authed.get("/api/challenges").json()[0]
    assert got["days_done"] == 7 and got["percent"] == 70
    assert got["best_streak"] == 4 and got["current_streak"] == 4


def test_state_overdue_and_upcoming(authed: TestClient):
    old = make(authed, title="Old", start_date=(today() - dt.timedelta(days=40)).isoformat(), duration_days=30)
    soon = make(authed, title="Soon", start_date=(today() + dt.timedelta(days=3)).isoformat())
    states = {c["title"]: c for c in authed.get("/api/challenges").json()}
    assert states["Old"]["state"] == "overdue" and states["Old"]["days_left"] == 0
    assert states["Soon"]["state"] == "upcoming" and states["Soon"]["days_elapsed"] == 0
    assert old["id"] != soon["id"]


def test_claim_early_goes_to_achievements(authed: TestClient):
    c = make(authed)
    assert authed.post(f"/api/challenges/{c['id']}/complete", json={}).status_code == 422  # nothing checked yet
    check(authed, c["id"], today())
    done = authed.post(f"/api/challenges/{c['id']}/complete", json={"outcome": "Deployed my app"}).json()
    assert done["state"] == "completed" and done["completed_on"] == today().isoformat()
    assert done["completed_early"] is True and done["days_early"] == 29
    assert done["outcome"] == "Deployed my app" and done["current_streak"] == 0

    assert authed.post(f"/api/challenges/{c['id']}/complete", json={}).status_code == 409  # twice
    assert check(authed, c["id"], today(), done=False).status_code == 409  # locked

    summary = authed.get("/api/challenges/summary").json()
    assert summary == {"active_count": 0, "completed_count": 1, "early_count": 1, "total_days_done": 1, "best_streak": 1}


def test_claim_on_deadline_is_not_early(authed: TestClient):
    c = make(authed, start_date=(today() - dt.timedelta(days=6)).isoformat(), duration_days=7)
    check(authed, c["id"], today())
    done = authed.post(f"/api/challenges/{c['id']}/complete", json={}).json()
    assert done["completed_early"] is False and done["days_early"] == 0


def test_list_order_and_delete(authed: TestClient):
    a = make(authed, title="A", start_date=(today() - dt.timedelta(days=2)).isoformat())
    b = make(authed, title="B")
    check(authed, a["id"], today())
    authed.post(f"/api/challenges/{a['id']}/complete", json={})
    assert [c["title"] for c in authed.get("/api/challenges").json()] == ["B", "A"]  # running first
    assert authed.delete(f"/api/challenges/{b['id']}").status_code == 204
    assert authed.delete(f"/api/challenges/{a['id']}").status_code == 204  # completed ones can go too
    assert authed.get("/api/challenges").json() == []


def test_update_title_and_goal(authed: TestClient):
    c = make(authed)
    r = authed.patch(f"/api/challenges/{c['id']}", json={"title": "Learn Kubernetes", "goal": " "}).json()
    assert r["title"] == "Learn Kubernetes" and r["goal"] is None
    assert authed.patch(f"/api/challenges/{c['id']}", json={"title": None}).status_code == 422
    assert authed.patch(f"/api/challenges/{c['id']}", json={"duration_days": 10}).status_code == 422


def test_isolation(authed: TestClient, other_client: TestClient):
    c = make(authed)
    assert other_client.get("/api/challenges").json() == []
    assert check(other_client, c["id"], today()).status_code == 404
    assert other_client.delete(f"/api/challenges/{c['id']}").status_code == 404
    assert other_client.post(f"/api/challenges/{c['id']}/complete", json={}).status_code == 404


def test_deleting_user_data_cascades(authed: TestClient):
    c = make(authed)
    check(authed, c["id"], today())
    authed.delete(f"/api/challenges/{c['id']}")
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import ChallengeCheckin

    with SessionLocal() as db:
        assert db.scalar(select(ChallengeCheckin)) is None


def test_describe_end_date():
    challenge = Challenge(title="x", start_date=dt.date(2026, 2, 1), duration_days=30, status="active")
    challenge.checkins = []
    assert describe(challenge, dt.date(2026, 2, 1))["end_date"] == dt.date(2026, 3, 2)
