"""Encryption for secrets kept in the database (finding F-2: SMTP passwords).

Values are encrypted with Fernet (AES-128-CBC with HMAC-SHA256) and stored as "enc:v1:<token>".

FIELD_ENCRYPTION_KEY holds one or more Fernet keys, comma-separated. The first key encrypts; every
key can decrypt, so a key is rotated by putting a new key first and keeping the old one until
stored values have been saved again. Generate a key with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from config import get_settings

PREFIX = "enc:v1:"
KEY_HELP = 'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'


class UnreadableValue(ValueError):
    """A stored value that none of the configured keys can decrypt."""


@lru_cache
def _cipher(keys: str, debug: bool, jwt_secret: str) -> MultiFernet:
    raw_keys = [key.strip() for key in keys.split(",") if key.strip()]
    if not raw_keys:
        if not debug:
            raise RuntimeError(f"FIELD_ENCRYPTION_KEY must be set outside debug mode. {KEY_HELP}")
        # Local development only: a stable key derived from the JWT secret.
        digest = hashlib.sha256(f"launchops-development-field-key:{jwt_secret}".encode()).digest()
        raw_keys = [base64.urlsafe_b64encode(digest).decode()]
    try:
        return MultiFernet([Fernet(key) for key in raw_keys])
    except ValueError as e:
        raise RuntimeError(f"FIELD_ENCRYPTION_KEY must be one or more comma-separated Fernet keys. {KEY_HELP}") from e


def _current_cipher() -> MultiFernet:
    settings = get_settings()
    return _cipher(settings.field_encryption_key, settings.debug, settings.jwt_secret)


def check_key() -> None:
    """Raise RuntimeError at startup when no usable key is configured."""
    _current_cipher()


def is_encrypted(value: object) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def encrypt(value: str) -> str:
    return PREFIX + _current_cipher().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt(value: str) -> str:
    """The plain value. Values stored before encryption existed are returned unchanged."""
    if not is_encrypted(value):
        return value
    try:
        return _current_cipher().decrypt(value[len(PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeError) as e:
        raise UnreadableValue("No configured FIELD_ENCRYPTION_KEY can decrypt this value") from e
