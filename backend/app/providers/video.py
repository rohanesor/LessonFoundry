"""Video-generation provider abstraction.

Only the worker process imports this module.  Frontends receive status/URL
through API responses, never API keys or storage secrets.
"""
from dataclasses import dataclass
from typing import Protocol
from pathlib import Path
import os
import hashlib


@dataclass(frozen=True)
class VideoGenerationInput:
    script_text: str
    avatar_id: str | None
    pack_id: str
    user_id: str


@dataclass
class VideoGenerationResult:
    state: str
    url: str | None
    message: str
    is_demo: bool = False


class VideoGenerationProvider(Protocol):
    def create_video(self, input: VideoGenerationInput) -> VideoGenerationResult: ...


class MockVideoGenerationProvider:
    """Deterministic demo provider.  Returns a configured demo video if one
    exists, otherwise a Ready status with no URL and a clear disclosure.
    Same inputs → same demo selection.
    """

    def __init__(self) -> None:
        self.demo_dir = Path(os.getenv("DEMO_VIDEO_DIR", ".local-files/demo-videos")).resolve()

    def create_video(self, input: VideoGenerationInput) -> VideoGenerationResult:
        if input.avatar_id is None:
            return VideoGenerationResult(
                state="Ready",
                url=None,
                message="No avatar selected; mock generation requires an avatar.",
            )
        demo = self._resolve_demo(input)
        if demo is None:
            return VideoGenerationResult(
                state="Ready",
                url=None,
                message="Mock render complete. No demo video is configured; no playable video was produced.",
                is_demo=True,
            )
        return VideoGenerationResult(
            state="Ready",
            url=demo,
            message="Mock render complete. This is a configured demo video; no AI provider rendered it.",
            is_demo=True,
        )

    def _resolve_demo(self, input: VideoGenerationInput) -> str | None:
        if not self.demo_dir.is_dir():
            return None
        candidates = sorted(p for p in self.demo_dir.iterdir() if p.suffix.lower() in {".mp4", ".webm", ".mov"})
        if not candidates:
            return None
        digest = hashlib.sha256(f"{input.pack_id}:{input.avatar_id}:{input.script_text[:200]}".encode()).hexdigest()
        index = int(digest[:8], 16) % len(candidates)
        return f"/local-files/demo-videos/{candidates[index].name}"
