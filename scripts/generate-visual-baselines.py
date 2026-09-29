#!/usr/bin/env python3
"""
Generate reference screenshots from the official LessonFoundry design prototype.

Usage:
    cd frontend
    npx playwright test --config playwright.visual.config.ts --update-snapshots

Or run this script after starting the prototype server manually:
    python3 ../scripts/generate-visual-baselines.py
"""

import os
import sys
import time
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROTOTYPE_DIR = os.path.join(
    ROOT,
    "LessonFoundry Frontend Design",
    "design_handoff_lessonfoundry",
    "prototype",
)
PORT = 3456


def main():
    if not os.path.isdir(PROTOTYPE_DIR):
        print(f"Prototype directory not found: {PROTOTYPE_DIR}")
        sys.exit(1)

    # Start a static server for the prototype.
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=PROTOTYPE_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(1)
    try:
        os.chdir(os.path.join(ROOT, "frontend"))
        result = subprocess.run(
            [
                "npx",
                "playwright",
                "test",
                "--config",
                "playwright.visual.config.ts",
                "--update-snapshots",
            ]
        )
        sys.exit(result.returncode)
    finally:
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main()
