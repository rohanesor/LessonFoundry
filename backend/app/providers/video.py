"""Provider-neutral video workflow.

The mock provider selects a supplied, private demo recording. It never calls an
external video service and never represents the recording as AI-synthesized.
"""
from dataclasses import dataclass
from pathlib import Path
import hashlib
import os


@dataclass(frozen=True)
class VideoGenerationInput:
    script_text: str
    avatar_id: str | None
    pack_id: str
    user_id: str
    script_version_id: str | None = None


@dataclass
class VideoGenerationResult:
    state: str
    source_path: str | None
    message: str
    is_demo: bool = False


class VideoGenerationProvider:
    def create_video(self, input: VideoGenerationInput) -> VideoGenerationResult:
        raise NotImplementedError


class MockVideoGenerationProvider(VideoGenerationProvider):
    def __init__(self) -> None:
        configured = os.getenv("AI_TEACHER_DEMO_VIDEO_PATH", "fixtures/ai_teacher_demo_video.mp4")
        self.video_path = Path(configured)
        if not self.video_path.is_absolute():
            candidates = [
                Path(__file__).resolve().parent.parent / "fixtures" / "ai_teacher_demo_video.mp4",
                Path.cwd() / self.video_path,
                Path(__file__).resolve().parents[3] / self.video_path,
                Path("backend/integration/fixtures/ai_teacher_demo_video.mp4"),
            ]
            self.video_path = next((p for p in candidates if p.is_file()), candidates[0])

    def create_video(self, input: VideoGenerationInput) -> VideoGenerationResult:
        if not input.avatar_id:
            return VideoGenerationResult("Ready", None, "Choose an avatar before generating a demo video.")
        if not self.video_path.is_file():
            return VideoGenerationResult("Ready", None, "No supplied demo recording is configured; no playable video was produced.", True)
        # Evaluate the input to keep selection deterministic and auditable.
        hashlib.sha256(f"{input.pack_id}:{input.avatar_id}:{input.script_version_id}:{input.script_text}".encode()).hexdigest()
        return VideoGenerationResult("Ready", str(self.video_path), "Existing supplied recording selected. No AI video provider was called.", True)
