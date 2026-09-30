import os
from pathlib import Path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.providers.video import MockVideoGenerationProvider, VideoGenerationInput

def test_mock_without_demo_is_honest(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_TEACHER_DEMO_VIDEO_PATH", str(tmp_path / "missing.mp4"))
    r = MockVideoGenerationProvider().create_video(VideoGenerationInput("hello", "ava-1", "p1", "u1"))
    assert r.state == "Ready" and r.source_path is None and r.is_demo
    assert "no playable video" in r.message.lower()

def test_mock_deterministic_with_supplied_demo(tmp_path, monkeypatch):
    demo = tmp_path / "demo.mp4"; demo.write_bytes(b"ftypisom")
    monkeypatch.setenv("AI_TEACHER_DEMO_VIDEO_PATH", str(demo))
    p = MockVideoGenerationProvider()
    a = VideoGenerationInput("hello", "ava-1", "p1", "u1", "script-1")
    b = VideoGenerationInput("different", "ava-2", "p2", "u1", "script-2")
    assert p.create_video(a).source_path == p.create_video(a).source_path == str(demo)
    assert p.create_video(b).source_path == str(demo)

def test_mock_requires_avatar(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_TEACHER_DEMO_VIDEO_PATH", str(tmp_path / "missing.mp4"))
    r = MockVideoGenerationProvider().create_video(VideoGenerationInput("hello", None, "p1", "u1"))
    assert r.source_path is None and "avatar" in r.message.lower()
