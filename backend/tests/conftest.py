"""Suite-wide isolated test configuration set before application imports.

Test modules import app/database at collection time.  Pinning this environment
here prevents the developer's local .env (including a hosted DATABASE_URL) from
leaking into a combined test invocation.
"""
import os
import tempfile

_TEST_DB = tempfile.NamedTemporaryFile(prefix="lessonfoundry-tests-", suffix=".sqlite3", delete=False)
_TEST_DB.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.name}"
os.environ["AUTH_MODE"] = "local"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["REAL_LLM_ENABLED"] = "false"
os.environ["STORAGE_PROVIDER"] = "local"
os.environ["LOCAL_TEACHER_TOKEN"] = "test-teacher"
os.environ["LOCAL_STUDENT_TOKEN"] = "test-student"


import pytest


@pytest.fixture(autouse=True)
def isolate_runtime_tokens(request, monkeypatch):
    """Test modules intentionally use different local identities."""
    monkeypatch.setenv("AUTH_MODE", "local")
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("REAL_LLM_ENABLED", "false")
    monkeypatch.setenv("STORAGE_PROVIDER", "local")
    if request.module.__name__.endswith("test_workflow"):
        monkeypatch.setenv("LOCAL_TEACHER_TOKEN", "test-secret")
    else:
        monkeypatch.setenv("LOCAL_TEACHER_TOKEN", "test-teacher")
        monkeypatch.setenv("LOCAL_STUDENT_TOKEN", "test-student")
