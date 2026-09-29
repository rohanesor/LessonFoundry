#!/usr/bin/env python3
"""Secret-safe repository and frontend-bundle scanner.

Reports only file, line, type, and disposition; it never prints a matching
value. Ignored local .env files are informational, while a credential literal
in source, tracked templates, or browser bundles fails the scan.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache", ".ruff_cache", "test-results", "playwright-report"}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip", ".pdf", ".sqlite3", ".woff", ".woff2"}
VALUE_PATTERNS = (
    ("Anthropic API key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{12,}")),
    ("AWS access key ID", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
)
SENSITIVE_NAMES = re.compile(
    r"^(?:ANTHROPIC.*(?:KEY|TOKEN)|AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)|"
    r"SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|(?:LOCAL_.*|JWT|API|ACCESS|BEARER).*?(?:KEY|TOKEN|SECRET)|PASSWORD)$",
    re.I,
)
CLIENT_FORBIDDEN = re.compile(r"(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY|GOOGLE_CLIENT_SECRET)")


def ignored_by_policy(path: Path) -> bool:
    name = path.name
    return name == ".env" or name == ".env.local" or name.startswith(".env.")


def emit(path: Path, line: int, kind: str, action: str) -> None:
    print(f"{path.relative_to(ROOT)}:{line}: {kind}: {action}")


def looks_like_credential_database_url(value: str) -> bool:
    return bool(re.search(r"(?:postgres(?:ql)?(?:\+[a-z0-9_]+)?|mysql)://[^/@\s:]+:[^/@\s]+@", value, re.I))


def is_service_role_jwt(value: str) -> bool:
    """Only service-role JWTs are secrets; anon/publishable JWTs are public."""
    if value.count(".") != 2 or not value.startswith("eyJ"):
        return False
    try:
        middle = value.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(middle + "=" * (-len(middle) % 4)))
        return claims.get("role") == "service_role"
    except Exception:
        return False


failures = 0
reviewed = 0
for path in ROOT.rglob("*"):
    if any(part in SKIP_PARTS for part in path.parts):
        continue
    try:
        if not path.is_file():
            continue
    except OSError:
        continue
    if path.suffix.lower() in SKIP_SUFFIXES or ".sqlite3-" in path.name:
        continue
    # Detector patterns are code, not credential material.
    if path.resolve() == Path(__file__).resolve():
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    reviewed += 1
    is_env = path.name.startswith(".env")
    is_local_env = is_env and not path.name.endswith(".example")
    is_client_bundle = str(path.relative_to(ROOT)).startswith("frontend/.next/static/")

    for lineno, line in enumerate(text.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        assignment = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        # Environment files are the only supported location for these names.
        if assignment and is_env:
            name, value = assignment.group(1), assignment.group(2).strip().strip('"\'')
            sensitive_value = bool(value) and (
                bool(SENSITIVE_NAMES.fullmatch(name))
                or (name == "DATABASE_URL" and looks_like_credential_database_url(value))
                or is_service_role_jwt(value)
            )
            if sensitive_value:
                if is_local_env and ignored_by_policy(path):
                    emit(path, lineno, "sensitive local environment setting", "LOCAL_ENV_IGNORED")
                else:
                    emit(path, lineno, "nonempty sensitive configuration", "REMOVE_OR_MOVE_TO_IGNORED_ENV")
                    failures += 1
        # Catch literal credentials anywhere outside this scanner, including source.
        for kind, pattern in VALUE_PATTERNS:
            if pattern.search(line):
                if is_local_env and ignored_by_policy(path):
                    emit(path, lineno, kind, "LOCAL_ENV_IGNORED")
                else:
                    emit(path, lineno, kind, "REMOVE")
                    failures += 1
        if is_client_bundle and CLIENT_FORBIDDEN.search(line):
            emit(path, lineno, "server-only credential identifier in client bundle", "REMOVE")
            failures += 1

print(f"Scanned {reviewed} text files. Secret values were not displayed.")
print("Git history verification: NOT AVAILABLE — .git metadata absent" if not (ROOT / ".git").exists() else "Git history verification: run a dedicated history scanner before release")
print(f"Secret scan result: {'FAIL' if failures else 'PASS'} ({failures} blocking finding(s))")
sys.exit(1 if failures else 0)
