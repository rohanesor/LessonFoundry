import os
from pathlib import Path
import sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.providers.video import MockVideoGenerationProvider, VideoGenerationInput


def test_mock_without_demo_is_honest(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_VIDEO_DIR", str(tmp_path))
    p = MockVideoGenerationProvider()
    r = p.create_video(VideoGenerationInput("hello", "ava-1", "p1", "u1"))
    assert r.state == "Ready"
    assert r.url is None
    assert "no playable video" in r.message.lower()
    assert r.is_demo


def test_mock_deterministic_with_two_demos(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_VIDEO_DIR", str(tmp_path))
    (tmp_path / "a.mp4").write_bytes(b"ftypisom")
    (tmp_path / "b.mp4").write_bytes(b"ftypisom")
    p = MockVideoGenerationProvider()
    r1 = p.create_video(VideoGenerationInput("hello", "ava-1", "p1", "u1"))
    r2 = p.create_video(VideoGenerationInput("hello", "ava-1", "p1", "u1"))
    r3 = p.create_video(VideoGenerationInput("different", "ava-1", "p1", "u1"))
    assert r1.url == r2.url
    assert r1.url is not None
    assert r3.url != r1.url


def test_mock_requires_avatar(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_VIDEO_DIR", str(tmp_path))
    p = MockVideoGenerationProvider()
    r = p.create_video(VideoGenerationInput("hello", None, "p1", "u1"))
    assert r.url is None
    assert "no avatar" in r.message.lower()
