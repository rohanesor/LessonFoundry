"""Compatibility entry point. Prefer: PYTHONPATH=backend uvicorn app.main:app.

The earlier single-file prototype is preserved in legacy/prototype_main.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))
from app.main import app  # noqa: E402,F401
