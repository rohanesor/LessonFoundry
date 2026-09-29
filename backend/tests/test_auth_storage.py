"""Local unit tests: real JWT crypto, stub JWKS/HTTP. Not live Supabase tests."""

import time
from types import SimpleNamespace
from uuid import uuid4
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from app.api import auth
from app.security import Identity, identity
from app.services.storage import ObjectStore


@pytest.fixture
def signed(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv("SUPABASE_URL", "https://staging-test.supabase.co")
    monkeypatch.setattr(
        auth,
        "jwks_client",
        lambda url: SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(
                key=private.public_key()
            )
        ),
    )
    claims = {
        "sub": str(uuid4()),
        "iss": "https://staging-test.supabase.co/auth/v1",
        "aud": "authenticated",
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
        "app_metadata": {"role": "teacher"},
    }
    return private, claims


def test_verified_supabase_jwt(signed):
    key, claims = signed
    user_id, role = auth.verify_session(jwt.encode(claims, key, algorithm="RS256"))
    assert user_id == claims["sub"]
    assert role == "teacher"


@pytest.mark.parametrize(
    "field,value",
    [
        ("exp", 1),
        ("iss", "https://wrong.invalid"),
        ("aud", "wrong"),
        ("app_metadata", None),  # missing app_metadata entirely
        ("sub", "not-a-uuid"),
    ],
)
def test_invalid_claims_rejected(signed, field, value):
    key, claims = signed
    claims[field] = value
    with pytest.raises(HTTPException) as error:
        auth.verify_session(jwt.encode(claims, key, algorithm="RS256"))
    assert error.value.status_code == 401


def test_missing_expiry_and_wrong_signature_rejected(signed):
    key, claims = signed
    claims.pop("exp")
    with pytest.raises(HTTPException):
        auth.verify_session(jwt.encode(claims, key, algorithm="RS256"))
    claims["exp"] = int(time.time()) + 300
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(HTTPException):
        auth.verify_session(jwt.encode(claims, other, algorithm="RS256"))


def test_storage_uses_verified_user_token_not_service_role(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://staging-test.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "must-never-be-forwarded")
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return SimpleNamespace(
            is_success=True,
            json=lambda: {
                "signedURL": "/object/sign/sources/user/unit/file.pdf?token=temporary"
            },
        )

    monkeypatch.setattr("app.services.storage.httpx.post", post)
    h = identity.set(Identity(str(uuid4()), "verified-user-token"))
    try:
        store = ObjectStore()
        store.put("user/unit/file.pdf", b"pdf")
        result = store.sign("user/unit/file.pdf")
        assert result["expires_in"] == 60
    finally:
        identity.reset(h)
    assert all(
        k["headers"]["Authorization"] == "Bearer verified-user-token" for _, k in calls
    )
    assert all("must-never-be-forwarded" not in str(k) for _, k in calls)
    assert calls[1][1]["json"] == {"expiresIn": 60}


def test_storage_does_not_fall_back_in_supabase_mode(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "supabase")
    with pytest.raises(ValueError, match="Verified teacher"):
        ObjectStore().put("some/path", b"data")


def test_private_local_path_cannot_escape(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTH_MODE", "local")
    monkeypatch.setenv("LOCAL_STORAGE_PATH", str(tmp_path))
    with pytest.raises(ValueError):
        ObjectStore().put("../outside", b"data")
