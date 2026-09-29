"""Configuration validation must be deterministic and secret-safe."""
import pytest
from app.config import ConfigurationError, validate_configuration


def clean(monkeypatch):
    for key in (
        "LLM_PROVIDER", "REAL_LLM_ENABLED", "ANTHROPIC_API_KEY",
        "STORAGE_PROVIDER", "AWS_REGION", "AWS_S3_BUCKET", "AUTH_MODE",
        "APP_ENV", "SUPABASE_URL", "SUPABASE_ANON_KEY", "DATABASE_URL",
        "WORKER_DATABASE_URL",
    ):
        monkeypatch.delenv(key, raising=False)


def test_mock_local_mode_needs_no_cloud_credentials(monkeypatch):
    clean(monkeypatch)
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("STORAGE_PROVIDER", "local")
    monkeypatch.setenv("AUTH_MODE", "local")
    validate_configuration()


def test_claude_without_key_has_safe_error(monkeypatch):
    clean(monkeypatch)
    monkeypatch.setenv("LLM_PROVIDER", "claude")
    with pytest.raises(ConfigurationError, match="ANTHROPIC_API_KEY is required") as exc:
        validate_configuration()
    assert "sk-ant-" not in str(exc.value)


def test_s3_requires_region_and_bucket_but_not_static_credentials(monkeypatch):
    clean(monkeypatch)
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    with pytest.raises(ConfigurationError, match="AWS_REGION and AWS_S3_BUCKET"):
        validate_configuration()
    monkeypatch.setenv("AWS_REGION", "test-region")
    monkeypatch.setenv("AWS_S3_BUCKET", "test-bucket")
    validate_configuration()


def test_supabase_mode_requires_nonsecret_configuration_names(monkeypatch):
    clean(monkeypatch)
    monkeypatch.setenv("AUTH_MODE", "supabase")
    with pytest.raises(ConfigurationError, match="SUPABASE_URL"):
        validate_configuration()
