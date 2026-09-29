import os
import json
from contextlib import contextmanager
from dotenv import load_dotenv
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()
URL = os.getenv("DATABASE_URL", "sqlite:///./lessonfoundry-dev.sqlite3")
engine = create_engine(
    URL,
    connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {"prepare_threshold": None},
    pool_pre_ping=True,
    hide_parameters=True,
)
if URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def sqlite_settings(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=10000")


Session = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


@contextmanager
def transaction():
    from app.security import identity

    with Session.begin() as session:
        if os.getenv("AUTH_MODE") == "supabase":
            if engine.dialect.name != "postgresql":
                raise RuntimeError(
                    "Supabase mode requires PostgreSQL; no SQLite fallback"
                )
            actor = identity.get()
            # These are fixed role names, never browser input. SET LOCAL is reset on
            # commit/rollback so pooled connections cannot retain another user's identity.
            role = "lessonfoundry_api" if actor else "lessonfoundry_student"
            session.execute(text(f"SET LOCAL ROLE {role}"))
            claims = {"sub": actor.user_id, "role": "authenticated"} if actor else {}
            session.execute(
                text("SELECT set_config('request.jwt.claims', :claims, true)"),
                {"claims": json.dumps(claims)},
            )
        yield session


@contextmanager
def worker_transaction():
    if os.getenv("AUTH_MODE") != "supabase":
        with transaction() as session:
            yield session
        return
    from functools import lru_cache

    with worker_session().begin() as session:
        session.execute(text("SET LOCAL ROLE lessonfoundry_worker"))
        yield session


from functools import lru_cache


@lru_cache(maxsize=1)
def worker_session():
    url = os.environ["WORKER_DATABASE_URL"]
    if not url.startswith("postgresql"):
        raise RuntimeError("Worker requires a separate PostgreSQL connection")
    return sessionmaker(
        create_engine(
            url,
            pool_pre_ping=True,
            hide_parameters=True,
            connect_args={"prepare_threshold": None},
        ),
        expire_on_commit=False,
    )
