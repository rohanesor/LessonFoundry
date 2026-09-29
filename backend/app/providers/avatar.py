from typing import Protocol


class AvatarProvider(Protocol):
    def create_video(self, script: str) -> dict: ...


class MockAvatarProvider:
    def create_video(self, script):
        # No fabricated MP4 or unrelated stock video is represented as a render.
        return {
            "state": "Ready",
            "url": None,
            "message": "Mock render complete. Workflow simulation only; no playable video was produced.",
        }
