"""Current Claude request compatibility tests; all transport is mocked."""
import json
import httpx

from app.providers.llm import ClaudeProvider


def test_current_claude_request_omits_deprecated_sampling_and_prefill(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "unit-test-key")
    captured = {}

    def post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return httpx.Response(
            200,
            json={
                "content": [{"type": "text", "text": json.dumps({"objectives": []})}],
                "stop_reason": "end_turn",
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr("app.providers.llm.httpx.post", post)
    result = ClaudeProvider().map_objectives([], [])

    assert result == []
    payload = captured["json"]
    assert "temperature" not in payload
    assert "top_p" not in payload
    assert "top_k" not in payload
    assert "thinking" not in payload
    assert "tools" not in payload
    assert "tool_choice" not in payload
    assert "stop_sequences" not in payload
    assert payload["messages"] and len(payload["messages"]) == 1
    assert [message["role"] for message in payload["messages"]] == ["user"]
    assert captured["url"] == ClaudeProvider.endpoint


def test_claude_success_response_parses_generated_message(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "unit-test-key")
    expected = {"items": [{"slot": "explanation"}]}
    response = httpx.Response(
        200,
        json={"content": [{"type": "text", "text": "```json\n" + json.dumps(expected) + "\n```"}], "stop_reason": "end_turn"},
        request=httpx.Request("POST", ClaudeProvider.endpoint),
    )
    monkeypatch.setattr("app.providers.llm.httpx.post", lambda *args, **kwargs: response)

    assert ClaudeProvider().request("system", {"evidence": []}) == expected
