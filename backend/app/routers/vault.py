"""Encrypted account vault.

Usernames and service names are stored in plain text so the list can be shown while the vault is
locked. Passwords and notes are encrypted with a key derived from the master password, which the
server never stores. Unlocking returns a short-lived token; the browser sends it as X-Vault-Token.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app import vault
from app.deps import CurrentUser, DbSession, VaultKey, get_owned
from app.models import VaultAccount
from app.ratelimit import vault_limiter
from app.schemas.life import (
    AccountCreate,
    AccountRead,
    AccountSecret,
    AccountUpdate,
    MasterPassword,
    SecretUpdate,
    VaultReset,
    VaultStatus,
    VaultUnlockRead,
)
from app.security import verify_password

router = APIRouter(prefix="/vault", tags=["vault"])


def _account_read(account: VaultAccount) -> dict:
    return {
        "id": account.id,
        "service": account.service,
        "username": account.username,
        "url": account.url,
        "category": account.category,
        "has_notes": account.notes_encrypted is not None,
        "updated_at": account.updated_at,
    }


@router.get("/status", response_model=VaultStatus)
def vault_status(user: CurrentUser) -> dict:
    return {"initialized": user.has_vault}


@router.post("/setup", response_model=VaultUnlockRead, status_code=status.HTTP_201_CREATED)
def setup(payload: MasterPassword, user: CurrentUser, db: DbSession) -> dict:
    if user.has_vault:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your vault is already set up")
    salt = vault.new_salt()
    key = vault.derive_key(payload.master_password, salt)
    user.vault_salt = salt
    user.vault_verifier = vault.make_verifier(key)
    db.commit()
    return {"token": vault.issue_token(user.id, key), "expires_in": vault.TOKEN_TTL_SECONDS}


@router.post("/unlock", response_model=VaultUnlockRead)
def unlock(payload: MasterPassword, user: CurrentUser) -> dict:
    if not user.has_vault:
        raise HTTPException(status.HTTP_409_CONFLICT, "Set up your vault first")
    limiter_key = str(user.id)
    vault_limiter.check(limiter_key)
    key = vault.derive_key(payload.master_password, user.vault_salt)
    if not vault.key_matches(key, user.vault_verifier):
        vault_limiter.fail(limiter_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong master password")
    vault_limiter.reset(limiter_key)
    return {"token": vault.issue_token(user.id, key), "expires_in": vault.TOKEN_TTL_SECONDS}


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset(payload: VaultReset, user: CurrentUser, db: DbSession) -> None:
    """Forgot the master password? The saved passwords can't be recovered, so this wipes them.

    Requires the account password so a stolen session alone can't do it.
    """
    limiter_key = f"reset:{user.id}"
    vault_limiter.check(limiter_key)
    if not verify_password(payload.password, user.password_hash):
        vault_limiter.fail(limiter_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong account password")
    for account in db.scalars(select(VaultAccount).where(VaultAccount.user_id == user.id)):
        db.delete(account)
    user.vault_salt = None
    user.vault_verifier = None
    db.commit()


@router.get("/accounts", response_model=list[AccountRead])
def list_accounts(user: CurrentUser, db: DbSession) -> list[dict]:
    rows = db.scalars(
        select(VaultAccount)
        .where(VaultAccount.user_id == user.id)
        .order_by(VaultAccount.category, VaultAccount.service)
    )
    return [_account_read(row) for row in rows]


@router.post("/accounts", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, user: CurrentUser, db: DbSession, key: VaultKey) -> dict:
    account = VaultAccount(
        user_id=user.id,
        service=payload.service,
        username=payload.username,
        url=payload.url,
        category=payload.category,
        password_encrypted=vault.encrypt(key, payload.password),
        notes_encrypted=vault.encrypt(key, payload.notes) if payload.notes else None,
    )
    db.add(account)
    db.commit()
    return _account_read(account)


@router.get("/accounts/{account_id}/secret", response_model=AccountSecret)
def reveal(account_id: int, user: CurrentUser, db: DbSession, key: VaultKey) -> dict:
    account = get_owned(db, VaultAccount, account_id, user, "Account")
    try:
        return {
            "password": vault.decrypt(key, account.password_encrypted),
            "notes": vault.decrypt(key, account.notes_encrypted)
            if account.notes_encrypted
            else None,
        }
    except vault.VaultError:
        raise HTTPException(
            status.HTTP_423_LOCKED, "The vault is locked. Unlock it first."
        ) from None


@router.patch("/accounts/{account_id}", response_model=AccountRead)
def update_account(
    account_id: int, payload: AccountUpdate, user: CurrentUser, db: DbSession
) -> dict:
    account = get_owned(db, VaultAccount, account_id, user, "Account")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    return _account_read(account)


@router.put("/accounts/{account_id}/secret", response_model=AccountRead)
def update_secret(
    account_id: int, payload: SecretUpdate, user: CurrentUser, db: DbSession, key: VaultKey
) -> dict:
    account = get_owned(db, VaultAccount, account_id, user, "Account")
    account.password_encrypted = vault.encrypt(key, payload.password)
    account.notes_encrypted = vault.encrypt(key, payload.notes) if payload.notes else None
    db.commit()
    return _account_read(account)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(get_owned(db, VaultAccount, account_id, user, "Account"))
    db.commit()
