"""Fail closed: a staging label must never silently use SQLite/local storage/auth."""

import os
from sqlalchemy import text


def check_staging(engine):
    if (
        os.getenv("APP_ENV") not in ("staging", "production")
        and os.getenv("AUTH_MODE") != "supabase"
    ):
        return
    required = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "DATABASE_URL",
        "WORKER_DATABASE_URL",
    ]
    if os.getenv("AUTH_MODE") != "supabase" or any(not os.getenv(k) for k in required):
        raise RuntimeError(
            "Staging requires Supabase Auth, public Storage API key and separate PostgreSQL API/worker connections"
        )
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Staging cannot use SQLite")
    with engine.connect() as c:
        # API login may SET ROLE, but must not itself own/bypass tables or have worker membership.
        role = c.execute(
            text(
                "SELECT rolsuper, rolbypassrls, rolinherit FROM pg_roles WHERE rolname=current_user"
            )
        ).one()
        if any(role):
            raise RuntimeError(
                "API database login must be NOSUPERUSER NOBYPASSRLS NOINHERIT"
            )
        if c.scalar(
            text("SELECT pg_has_role(current_user, 'lessonfoundry_worker', 'MEMBER')")
        ):
            raise RuntimeError("API login must not be a member of the worker role")
        for target in ("lessonfoundry_api", "lessonfoundry_student"):
            if not c.scalar(
                text("SELECT pg_has_role(current_user, :role, 'MEMBER')"),
                {"role": target},
            ):
                raise RuntimeError(
                    "API login is missing a required restricted role membership"
                )
        if c.scalar(
            text(
                "SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname=current_user AND n.nspname='public')"
            )
        ):
            raise RuntimeError("API login must not own application tables")
        count = c.scalar(
            text(
                "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%_api_owner'"
            )
        )
        if count < 19:
            raise RuntimeError(
                "Apply staging security migration 002 before starting the API"
            )
