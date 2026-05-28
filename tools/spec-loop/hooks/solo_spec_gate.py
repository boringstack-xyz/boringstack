#!/usr/bin/env python3
"""PreToolUse gate for the Solo Spec Loop plugin.

Behavior:

- Walks up from `cwd` looking for `.specs/next.md`. The walk stops at the
  first `.git/` directory it encounters (treated as the project ceiling)
  or at filesystem root.
- If no spec is found, the project has not opted in: allow silently.
- If a spec is found:
    - allow non-source writes (specs, tests, docs, .claude, .cursor, etc.).
    - block source writes when the spec exceeds the line cap (slice too big).
    - block source writes unless frontmatter contains `status: approved`.

The gate is intentionally tiny: one spec file, one approval state, no extra
artifact sprawl. If the loop's philosophy doesn't fit a project, just don't
create `.specs/next.md` and the gate stays out of the way.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ALWAYS_ALLOW_PREFIXES = (
    ".specs/",
    ".claude/",
    ".cursor/",
    "docs/",
    "README",
    "CHANGELOG",
    "CLAUDE.md",
    "AGENTS.md",
    "GEMINI.md",
)

TEST_PATTERNS = (
    r"(^|/)tests?/",
    r"(^|/)__tests__/",
    r"(^|/)e2e/",
    r"\.test\.",
    r"\.spec\.",
)

SOURCE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".cs",
    ".rb", ".php", ".swift", ".kt", ".c", ".cpp", ".h", ".hpp", ".vue",
    ".svelte", ".sql",
}

MAX_SPEC_LINES = 140  # hard cap. Target is 90; soft warning around 120.

# Match `status: approved` only as a line on its own, so prose mentions
# inside the body (build notes, quoted examples, bullet points) cannot
# accidentally flip the gate open.
APPROVAL_RE = re.compile(r"^[ \t]*status:[ \t]*approved[ \t]*$", re.MULTILINE)

# Frontmatter fence: optional leading whitespace tolerated; first `---`
# at file start, second `---` closes the block.
FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)


def find_spec(start: Path) -> Path | None:
    """Walk up from `start` looking for `.specs/next.md`.

    Stops at the first `.git/` directory encountered (project ceiling) or
    at filesystem root. Returns the spec path or None.
    """
    current = start.resolve()
    while True:
        spec = current / ".specs" / "next.md"
        if spec.is_file():
            return spec
        if (current / ".git").exists():
            return None
        parent = current.parent
        if parent == current:
            return None
        current = parent


def project_root_for(spec: Path) -> Path:
    """The project root is the directory containing `.specs/`."""
    return spec.parent.parent


def normalize(path: str, root: Path) -> str:
    p = Path(path).expanduser()
    if not p.is_absolute():
        p = root / p
    try:
        return p.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return p.as_posix()


def extract_paths(payload: dict, root: Path) -> list[str]:
    tool_input = payload.get("tool_input", {}) or {}
    paths: list[str] = []
    for key in ("file_path", "path"):
        if tool_input.get(key):
            paths.append(normalize(str(tool_input[key]), root))
    return sorted(set(paths))


def is_test(path: str) -> bool:
    return any(re.search(pattern, path, re.I) for pattern in TEST_PATTERNS)


def is_allowed_before_approval(path: str) -> bool:
    return path.startswith(ALWAYS_ALLOW_PREFIXES) or is_test(path)


def is_source(path: str) -> bool:
    return Path(path).suffix in SOURCE_EXTENSIONS and not is_allowed_before_approval(path)


def is_approved(text: str) -> bool:
    """True iff a `status: approved` line exists in the YAML frontmatter.

    If frontmatter is missing or unparseable, fall back to anchoring against
    the whole file — still safer than a substring match because the regex
    requires the directive to be a line on its own.
    """
    match = FRONTMATTER_RE.match(text)
    haystack = match.group(1) if match else text
    return bool(APPROVAL_RE.search(haystack))


def block(reason: str) -> None:
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


def allow(reason: str = "") -> None:
    out: dict[str, str] = {"decision": "approve"}
    if reason:
        out["reason"] = reason
    print(json.dumps(out))
    sys.exit(0)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        allow("No hook payload parsed; fail open.")

    cwd = Path.cwd()
    spec = find_spec(cwd)
    if spec is None:
        allow("No .specs/next.md found in this project; spec loop not active.")

    root = project_root_for(spec)
    paths = extract_paths(payload, root)
    if not paths:
        allow("No file path detected.")

    if not any(is_source(path) for path in paths):
        allow("Specs, tests, docs, config, and workflow files are allowed before approval.")

    try:
        text = spec.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        # Fail open: spec exists but we can't read it cleanly. Better to let
        # the human notice the issue than to lock the project out.
        allow(f"Spec found but unreadable ({exc.__class__.__name__}); failing open.")

    if len(text.splitlines()) > MAX_SPEC_LINES:
        block(
            f"Source write blocked: {spec.relative_to(root)} is over "
            f"{MAX_SPEC_LINES} lines. Shrink the slice; don't add ceremony."
        )

    if not is_approved(text):
        block(
            f"Source write blocked. Review {spec.relative_to(root)}, then "
            "run your spec slash command with `approve` (Claude Code plugin: `/solo-spec-loop:spec approve`) once you have explicitly approved the slice."
        )

    allow("Approved micro-spec found; source writes allowed for this slice.")


if __name__ == "__main__":
    main()
