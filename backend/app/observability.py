"""Structured, secret-safe logging helpers."""

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("lessonfoundry")


def log_job(
    *,
    job_id: str,
    job_type: str,
    unit_id: str,
    user_id: str,
    status: str,
    started_at: datetime,
    completed_at: datetime | None = None,
    error: str | None = None,
    meta: dict[str, Any] | None = None,
):
    """Emit a single JSON line suitable for log aggregation.

    Never include JWTs, passwords, keys or full source content.
    """
    record = {
        "event": "job",
        "job_id": job_id,
        "job_type": job_type,
        "unit_id": unit_id,
        "user_id": user_id,
        "status": status,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
        "duration_ms": (
            int((completed_at - started_at).total_seconds() * 1000)
            if completed_at
            else None
        ),
        "error": error,
        "meta": meta or {},
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    logger.info(json.dumps(record, default=str))
