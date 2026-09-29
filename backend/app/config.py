"""Secret-safe runtime configuration validation.

Only presence and non-secret mode names are reported.  Credentials stay in the
process environment (or the platform secret store) and are never logged.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


class ConfigurationError(RuntimeError):
    """Raised before serving requests when a selected integration is incomplete."""


def _required(*names: str) -> list[str]:
    return [name for name in names if not os.getenv(name)]


def validate_configuration() -> None:
    """Validate only the integrations selected by the current environment.

    Local/mock mode deliberately needs no cloud credentials.  boto3 uses its
    standard credential-provider chain, so S3 mode requires bucket/region but
    does not require long-lived access-key environment variables.
    """
    llm_provider = os.getenv("LLM_PROVIDER", "mock").lower()
    storage_provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    auth_mode = os.getenv("AUTH_MODE", "local").lower()
    app_env = os.getenv("APP_ENV", "development").lower()

    if llm_provider not in {"mock", "claude"}:
        raise ConfigurationError("LLM_PROVIDER must be mock or claude")
    if storage_provider not in {"local", "supabase", "s3"}:
        raise ConfigurationError("STORAGE_PROVIDER must be local, supabase, or s3")
    if auth_mode not in {"local", "supabase"}:
        raise ConfigurationError("AUTH_MODE must be local or supabase")

    if llm_provider == "claude":
        missing = _required("ANTHROPIC_API_KEY")
        if missing:
            raise ConfigurationError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude")
        if os.getenv("REAL_LLM_ENABLED", "false").lower() != "true":
            raise ConfigurationError("REAL_LLM_ENABLED=true is required when LLM_PROVIDER=claude")

    if storage_provider == "s3":
        missing = _required("AWS_REGION", "AWS_S3_BUCKET")
        if missing:
            raise ConfigurationError(
                "AWS_REGION and AWS_S3_BUCKET are required when STORAGE_PROVIDER=s3"
            )

    # Supabase Storage calls use the authenticated user's JWT plus the anon key.
    if storage_provider == "supabase":
        missing = _required("SUPABASE_URL", "SUPABASE_ANON_KEY")
        if missing:
            raise ConfigurationError(
                "SUPABASE_URL and SUPABASE_ANON_KEY are required when STORAGE_PROVIDER=supabase"
            )

    if auth_mode == "supabase" or app_env in {"staging", "production"}:
        missing = _required("SUPABASE_URL", "SUPABASE_ANON_KEY", "DATABASE_URL", "WORKER_DATABASE_URL")
        if missing:
            raise ConfigurationError(
                "SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL, and WORKER_DATABASE_URL "
                "are required for Supabase/hosted mode"
            )


def log_configuration_status() -> None:
    """Emit non-sensitive configuration diagnostics for operators."""
    logger.info(
        "Configuration: LLM_PROVIDER=%s REAL_LLM_ENABLED=%s STORAGE_PROVIDER=%s "
        "Anthropic_API_key=%s Supabase_URL=%s AWS_bucket=%s",
        os.getenv("LLM_PROVIDER", "mock"),
        os.getenv("REAL_LLM_ENABLED", "false").lower() == "true",
        os.getenv("STORAGE_PROVIDER", "local"),
        "configured" if os.getenv("ANTHROPIC_API_KEY") else "not configured",
        "configured" if os.getenv("SUPABASE_URL") else "not configured",
        "configured" if os.getenv("AWS_S3_BUCKET") else "not configured",
    )
