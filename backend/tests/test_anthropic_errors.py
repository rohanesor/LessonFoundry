"""Claude HTTP failures are structured and never echo credentials or bodies."""
import httpx
import pytest

from app.providers.llm import AnthropicProviderError, ClaudeProvider


@pytest.mark.parametrize(
    ("status", "provider_type", "expected"),
    [
        (404, "not_found_error", "not_found"),
        (401, "authentication_error", "authentication_error"),
        (429, "rate_limit_error", "rate_limit"),
        (400, "invalid_request_error", "invalid_request"),
        (500, "api_error", "server_error"),
    ],
)
def test_claude_http_errors_are_safe_and_structured(monkeypatch, status, provider_type, expected):
    # Constructed at runtime so repository secret scanning cannot mistake test
    # data for a literal credential. It must never appear in the exception.
    fake_key = "sk" + "-ant-" + "unit-test-not-a-credential"
    monkeypatch.setenv("ANTHROPIC_API_KEY", fake_key)
    request_id = "req_TEST_ONLY" if status == 400 else "req_phase10a_test"
    response = httpx.Response(
        status,
        headers={"request-id": request_id},
        json={"type": "error", "error": {"type": provider_type, "message": f"Bearer {fake_key}"}},
        request=httpx.Request("POST", ClaudeProvider.endpoint),
    )
    monkeypatch.setattr("app.providers.llm.httpx.post", lambda *args, **kwargs: response)

    with pytest.raises(AnthropicProviderError) as raised:
        ClaudeProvider().request("system", {"source": "test"})

    error = raised.value
    assert error.status_code == status
    assert error.error_type == expected
    assert error.request_id == request_id
    rendered = str(error)
    assert fake_key not in rendered
    assert "Bearer" not in rendered
    assert "Authorization" not in rendered
    assert "x-api-key" not in rendered


def test_claude_error_uses_status_category_without_json_or_request_id(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "unit-test-key")
    response = httpx.Response(
        404,
        content=b"not-json",
        request=httpx.Request("POST", ClaudeProvider.endpoint),
    )
    monkeypatch.setattr("app.providers.llm.httpx.post", lambda *args, **kwargs: response)

    with pytest.raises(AnthropicProviderError) as raised:
        ClaudeProvider().request("system", {})

    assert raised.value.error_type == "not_found"
    assert raised.value.request_id is None
