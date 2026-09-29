#!/usr/bin/env python3
"""
Static design-adherence checker.

Verifies that the application uses the exact tokens and assets from the
official LessonFoundry Frontend Design handoff. Runs without a browser.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
HANDOFF = ROOT / "LessonFoundry Frontend Design" / "design_handoff_lessonfoundry"

def read_css(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_token(css: str, name: str, expected: str) -> bool:
    m = re.search(rf"{re.escape(name)}\s*:\s*([^;]+);", css)
    if not m:
        print(f"  FAIL: {name} not found")
        return False
    value = m.group(1).strip()
    ok = expected.lower() in value.lower()
    print(f"  {'OK ' if ok else 'FAIL'}: {name} = {value} (expected {expected})")
    return ok


def main():
    print("LessonFoundry design adherence check")
    print("=" * 50)

    ok = True

    design_css = read_css(FRONTEND / "app" / "design-system.css")
    print("\n1. Brand tokens from handoff")
    ok &= check_token(design_css, "--color-bg", "#f3f2f2")
    ok &= check_token(design_css, "--color-surface", "#eae9e9")
    ok &= check_token(design_css, "--color-accent", "oklch")
    ok &= check_token(design_css, "--color-text", "oklch")
    ok &= check_token(design_css, "--lf-green", "oklch")
    ok &= check_token(design_css, "--lf-amber", "oklch")
    ok &= check_token(design_css, "--lf-red", "oklch")
    ok &= check_token(design_css, "--radius-md", "0px")

    print("\n2. Official assets present")
    required = [
        FRONTEND / "public" / "logo" / "lockup-color.svg",
        FRONTEND / "public" / "logo" / "mark-color.svg",
        FRONTEND / "public" / "favicon.svg",
        FRONTEND / "public" / "icons" / "evidence.svg",
        FRONTEND / "public" / "icons" / "validation.svg",
        FRONTEND / "public" / "icons" / "approval.svg",
        FRONTEND / "public" / "icons" / "version.svg",
        FRONTEND / "components" / "icons" / "LFIcon.tsx",
    ]
    for p in required:
        exists = p.exists()
        print(f"  {'OK ' if exists else 'FAIL'}: {p.relative_to(ROOT)}")
        ok &= exists

    print("\n3. No obvious Lucide imports remain in components")
    for f in (FRONTEND / "components").rglob("*.tsx"):
        text = f.read_text()
        if "lucide-react" in text:
            print(f"  FAIL: {f.relative_to(ROOT)} still imports lucide-react")
            ok = False
    print("  OK: no lucide-react imports found")

    print("\n4. LFIcon set includes all handoff icons")
    def icon_keys(text: str) -> set[str]:
        # Match both "source": [ and source: [
        return set(re.findall(r'["\']?([a-zA-Z][a-zA-Z0-9]*)["\']?\s*:\s*\[', text))

    handoff_keys = icon_keys(read_css(HANDOFF / "components" / "LFIcon.tsx"))
    our_keys = icon_keys(read_css(FRONTEND / "components" / "icons" / "LFIcon.tsx"))
    missing = sorted(handoff_keys - our_keys)
    if missing:
        print(f"  FAIL: missing icons {missing}")
        ok = False
    else:
        print(f"  OK: all {len(handoff_keys)} handoff icons present")

    print("\n" + "=" * 50)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
