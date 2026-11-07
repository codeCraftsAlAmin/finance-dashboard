"""Vault cryptography.

* The master password is stretched with scrypt (per-user random salt) into a 256-bit key.
* Secrets are encrypted with AES-256-GCM (random 96-bit nonce stored in front of the ciphertext).
* The master password and the key are never stored. After a successful unlock the server hands
  the browser a short-lived token that carries the key, itself encrypted with a key derived from
  the server's SECRET_KEY. The browser keeps it in memory only and sends it as a header.
"""

import base64
import hashlib
import json
import os

from cryptography.exceptions import InvalidTag
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

SALT_BYTES = 16
NONCE_BYTES = 12
TOKEN_TTL_SECONDS = 10 * 60

# scrypt cost: ~32 MiB and tens of milliseconds, which makes guessing a master password slow.
_SCRYPT = {"n": 2**15, "r": 8, "p": 1, "maxmem": 64 * 1024 * 1024, "dklen": 32}
_VERIFIER_PLAINTEXT = "vault-v1"


class VaultError(Exception):
    """The master password is wrong, or data can't be decrypted with the key."""


def new_salt() -> bytes:
    return os.urandom(SALT_BYTES)


def derive_key(master_password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(master_password.encode("utf-8"), salt=salt, **_SCRYPT)


def encrypt(key: bytes, plaintext: str) -> bytes:
    nonce = os.urandom(NONCE_BYTES)
    return nonce + AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)


def decrypt(key: bytes, blob: bytes) -> str:
    try:
        return AESGCM(key).decrypt(blob[:NONCE_BYTES], blob[NONCE_BYTES:], None).decode("utf-8")
    except (InvalidTag, ValueError) as error:
        raise VaultError("Could not decrypt") from error


def make_verifier(key: bytes) -> bytes:
    return encrypt(key, _VERIFIER_PLAINTEXT)


def key_matches(key: bytes, verifier: bytes) -> bool:
    try:
        return decrypt(key, verifier) == _VERIFIER_PLAINTEXT
    except VaultError:
        return False


# -------------------------------------------------------------------------- unlock tokens


def _token_cipher() -> Fernet:
    digest = hashlib.sha256(f"vault-token:{settings.secret_key}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def issue_token(user_id: int, key: bytes) -> str:
    payload = json.dumps({"u": user_id, "k": base64.b64encode(key).decode("ascii")})
    return _token_cipher().encrypt(payload.encode("utf-8")).decode("ascii")


def read_token(token: str, user_id: int) -> bytes | None:
    """The key inside a valid, unexpired token that belongs to `user_id`, else None."""
    try:
        raw = _token_cipher().decrypt(token.encode("ascii"), ttl=TOKEN_TTL_SECONDS)
        payload = json.loads(raw)
        if payload["u"] != user_id:
            return None
        return base64.b64decode(payload["k"])
    except (InvalidToken, ValueError, KeyError, TypeError):
        return None
