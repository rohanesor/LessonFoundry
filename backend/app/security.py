"""Request identity is established only by verified authentication, never request JSON."""

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True)
class Identity:
    user_id: str
    access_token: str


identity: ContextVar[Identity | None] = ContextVar("verified_identity", default=None)
