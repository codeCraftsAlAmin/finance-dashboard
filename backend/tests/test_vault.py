import pytest

from app import vault


def setup_vault(client, password="master-password-1"):
    r = client.post("/api/vault/setup", json={"master_password": password})
    assert r.status_code == 201, r.text
    return r.json()["token"]


def test_crypto_round_trip_and_tamper():
    salt = vault.new_salt()
    key = vault.derive_key("pw-pw-pw-pw", salt)
    blob = vault.encrypt(key, "s3cret")
    assert b"s3cret" not in blob
    assert vault.decrypt(key, blob) == "s3cret"
    assert vault.encrypt(key, "s3cret") != blob  # fresh nonce each time
    with pytest.raises(vault.VaultError):
        vault.decrypt(vault.derive_key("other-other", salt), blob)
    with pytest.raises(vault.VaultError):
        vault.decrypt(key, blob[:-1] + bytes([blob[-1] ^ 1]))


def test_locked_without_token(authed):
    setup_vault(authed)
    body = {"service": "Gmail", "username": "me", "password": "p@ss"}
    assert authed.post("/api/vault/accounts", json=body).status_code == 423
    assert authed.post("/api/vault/accounts", json=body, headers={"X-Vault-Token": "junk"}).status_code == 423


def test_store_and_reveal(authed):
    token = setup_vault(authed)
    h = {"X-Vault-Token": token}
    acc = authed.post(
        "/api/vault/accounts",
        json={"service": "Gmail", "username": "me@gmail.com", "password": "p@ss", "notes": "backup 123"},
        headers=h,
    ).json()
    assert "password" not in acc and acc["has_notes"] is True
    listed = authed.get("/api/vault/accounts").json()  # list works while locked
    assert listed[0]["service"] == "Gmail"
    secret = authed.get(f"/api/vault/accounts/{acc['id']}/secret", headers=h).json()
    assert secret == {"password": "p@ss", "notes": "backup 123"}
    assert authed.get(f"/api/vault/accounts/{acc['id']}/secret").status_code == 423

    authed.put(f"/api/vault/accounts/{acc['id']}/secret", json={"password": "new"}, headers=h)
    assert authed.get(f"/api/vault/accounts/{acc['id']}/secret", headers=h).json()["password"] == "new"


def test_database_holds_only_ciphertext(authed):
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import VaultAccount

    token = setup_vault(authed)
    authed.post(
        "/api/vault/accounts",
        json={"service": "FB", "username": "me", "password": "plain-text-pw"},
        headers={"X-Vault-Token": token},
    )
    with SessionLocal() as db:
        row = db.scalar(select(VaultAccount))
        assert b"plain-text-pw" not in row.password_encrypted


def test_unlock_wrong_password_and_rate_limit(authed):
    setup_vault(authed)
    for _ in range(5):
        assert authed.post("/api/vault/unlock", json={"master_password": "wrong-wrong-1"}).status_code == 401
    r = authed.post("/api/vault/unlock", json={"master_password": "master-password-1"})
    assert r.status_code == 429 and "retry-after" in r.headers


def test_unlock_ok_and_token_not_transferable(authed, other_client):
    setup_vault(authed)
    token = authed.post("/api/vault/unlock", json={"master_password": "master-password-1"}).json()["token"]
    other_token = setup_vault(other_client, "bobs-master-pw-1")
    assert token != other_token
    # Alice's token must not unlock Bob's vault.
    r = other_client.post(
        "/api/vault/accounts",
        json={"service": "x", "username": "y", "password": "z"},
        headers={"X-Vault-Token": token},
    )
    assert r.status_code == 423


def test_other_user_cannot_read_account(authed, other_client):
    token = setup_vault(authed)
    acc = authed.post(
        "/api/vault/accounts",
        json={"service": "x", "username": "y", "password": "z"},
        headers={"X-Vault-Token": token},
    ).json()
    bob = setup_vault(other_client, "bobs-master-pw-1")
    r = other_client.get(f"/api/vault/accounts/{acc['id']}/secret", headers={"X-Vault-Token": bob})
    assert r.status_code == 404


def test_reset_wipes_accounts(authed):
    token = setup_vault(authed)
    authed.post(
        "/api/vault/accounts",
        json={"service": "x", "username": "y", "password": "z"},
        headers={"X-Vault-Token": token},
    )
    assert authed.post("/api/vault/reset", json={"password": "nope"}).status_code == 401
    assert authed.post("/api/vault/reset", json={"password": "correct-horse"}).status_code == 204
    assert authed.get("/api/vault/status").json() == {"initialized": False}
    assert authed.get("/api/vault/accounts").json() == []


def test_login_rate_limit(client):
    from tests.conftest import register

    register(client)
    fresh = type(client)(client.app)
    for _ in range(8):
        assert fresh.post("/api/auth/login", json={"email": "ada@example.com", "password": "bad"}).status_code == 401
    assert fresh.post("/api/auth/login", json={"email": "ada@example.com", "password": "correct-horse"}).status_code == 429
