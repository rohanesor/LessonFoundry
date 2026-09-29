import os
import secrets
from functools import lru_cache
from uuid import UUID
import jwt
from fastapi import Header, HTTPException
from starlette.concurrency import run_in_threadpool
from app.database import transaction
from app.models.entities import User
from app.security import Identity, identity


@lru_cache(maxsize=4)
def jwks_client(url: str):
    return jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json", lifespan=300)


def verify_session(token: str, required_role: str | None = None) -> tuple[str, str]:
    """Return (user_id, role) from a verified Supabase JWT."""
    url = os.environ["SUPABASE_URL"].rstrip("/")
    try:
        key = jwks_client(url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{url}/auth/v1",
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        role = claims.get("app_metadata", {}).get("role", "student")
        if required_role and role != required_role:
            raise ValueError(f"{required_role} role required")
        user_id = str(UUID(claims["sub"]))
        return user_id, role
    except Exception:
        raise HTTPException(
            401,
            "Valid session required",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def ensure_user(user_id: str, role: str = "teacher", name: str = "User",
                email: str | None = None, avatar_url: str | None = None):
    with transaction() as s:
        if s.bind.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        else:
            from sqlalchemy.dialects.sqlite import insert
        s.execute(
            insert(User)
            .values(id=user_id, name=name, role=role, email=email, avatar_url=avatar_url)
            .on_conflict_do_nothing(index_elements=[User.id])
        )


def _extract_token(authorization: str) -> str:
    if not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise HTTPException(
            401, "Bearer session required", headers={"WWW-Authenticate": "Bearer"}
        )
    return authorization[7:]


async def _resolve(authorization: str, required_role: str | None = None):
    token = _extract_token(authorization)
    if os.getenv("AUTH_MODE", "local") == "supabase":
        user_id, role = await run_in_threadpool(verify_session, token, required_role)
    else:
        teacher_tok = os.getenv("LOCAL_TEACHER_TOKEN", "local-development-only")
        student_tok = os.getenv("LOCAL_STUDENT_TOKEN", "local-student-only")
        if secrets.compare_digest(teacher_tok, token):
            user_id, role = "local-teacher", "teacher"
        elif secrets.compare_digest(student_tok, token):
            user_id, role = "local-student", "student"
        else:
            raise HTTPException(401, "Invalid token")
        if required_role and role != required_role:
            raise HTTPException(403, f"{required_role} role required")
    handle = identity.set(Identity(user_id, token))
    try:
        await run_in_threadpool(ensure_user, user_id, role)
        yield user_id
    finally:
        identity.reset(handle)


async def teacher(authorization: str = Header(default="")):
    """Dependency: authenticated teacher."""
    async for uid in _resolve(authorization, "teacher"):
        yield uid


async def student(authorization: str = Header(default="")):
    """Dependency: authenticated student."""
    async for uid in _resolve(authorization, "student"):
        yield uid


async def authenticated(authorization: str = Header(default="")):
    """Dependency: any authenticated user (teacher or student)."""
    async for uid in _resolve(authorization):
        yield uid
