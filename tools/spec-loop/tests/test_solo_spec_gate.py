"""Tests for the Solo Spec Loop PreToolUse gate.

Two ways to run:

    python3 tests/test_solo_spec_gate.py    # stdlib-only script runner
    python3 -m pytest tests/                # if pytest is installed

The script runner supplies its own tmp_path; pytest supplies the fixture.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GATE = REPO_ROOT / "hooks" / "solo_spec_gate.py"


APPROVED_SPEC = """---
status: approved
slice: "create widgets endpoint"
approved_at: "2026-05-13"
---

# Next slice
Tiny.
"""

DRAFT_SPEC = """---
status: draft
slice: ""
approved_at: ""
---

# Next slice
Drafty.
"""


def run_gate(payload: dict, cwd: Path) -> dict:
    """Invoke the gate with `payload` on stdin and `cwd` set."""
    proc = subprocess.run(
        [sys.executable, str(GATE)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(cwd),
    )
    assert proc.returncode == 0, f"gate exited {proc.returncode}: {proc.stderr}"
    out = proc.stdout.strip()
    return json.loads(out) if out else {}


def write_spec(root: Path, content: str) -> None:
    spec_dir = root / ".specs"
    spec_dir.mkdir(parents=True, exist_ok=True)
    (spec_dir / "next.md").write_text(content, encoding="utf-8")


def make_git_root(root: Path) -> None:
    (root / ".git").mkdir(exist_ok=True)


def src_payload(file_path: str) -> dict:
    return {
        "tool_name": "Write",
        "tool_input": {"file_path": file_path, "content": "x"},
    }


def test_no_spec_opt_out(tmp_path: Path) -> None:
    """No .specs/next.md anywhere -> allow silently (project hasn't opted in)."""
    make_git_root(tmp_path)
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "approve"


def test_draft_blocks_source(tmp_path: Path) -> None:
    """Spec exists but is draft -> source writes blocked."""
    make_git_root(tmp_path)
    write_spec(tmp_path, DRAFT_SPEC)
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "block"
    assert "approve" in result["reason"].lower()


def test_approved_allows_source(tmp_path: Path) -> None:
    """Approved spec -> source writes allowed."""
    make_git_root(tmp_path)
    write_spec(tmp_path, APPROVED_SPEC)
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "approve"


def test_allowlist_specs(tmp_path: Path) -> None:
    """Edits to .specs/, .claude/, .cursor/, docs/, tests are always allowed."""
    make_git_root(tmp_path)
    write_spec(tmp_path, DRAFT_SPEC)
    for path in [
        ".specs/next.md",
        ".claude/commands/foo.md",
        ".cursor/rules/x.mdc",
        "docs/x.md",
        "README.md",
        "CLAUDE.md",
        "tests/foo.test.ts",
    ]:
        result = run_gate(src_payload(str(tmp_path / path)), tmp_path)
        assert result["decision"] == "approve", f"{path} should be allowed (got {result})"


def test_walk_up_finds_parent_spec(tmp_path: Path) -> None:
    """Hook walks up from cwd until it finds .specs/next.md."""
    make_git_root(tmp_path)
    write_spec(tmp_path, APPROVED_SPEC)
    deep = tmp_path / "packages" / "api" / "src"
    deep.mkdir(parents=True)
    result = run_gate(src_payload(str(deep / "app.ts")), deep)
    assert result["decision"] == "approve"


def test_git_root_ceiling(tmp_path: Path) -> None:
    """Walk stops at .git/ — a child repo with no spec doesn't pick up
    a parent repo's spec."""
    parent = tmp_path / "parent"
    parent.mkdir()
    make_git_root(parent)
    write_spec(parent, DRAFT_SPEC)

    child = parent / "child"
    child.mkdir()
    make_git_root(child)
    # Child has its own .git/ but no .specs/next.md.
    result = run_gate(src_payload(str(child / "src" / "app.ts")), child)
    assert result["decision"] == "approve"  # opt-out, parent's spec invisible


def test_oversized_spec_blocks(tmp_path: Path) -> None:
    """Spec longer than ~140 lines -> block source writes."""
    make_git_root(tmp_path)
    big = "---\nstatus: approved\n---\n" + ("line\n" * 200)
    write_spec(tmp_path, big)
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "block"
    assert "shrink" in result["reason"].lower() or "lines" in result["reason"].lower()


def test_no_path_in_payload(tmp_path: Path) -> None:
    """Payloads without a file_path are allowed (nothing to gate)."""
    make_git_root(tmp_path)
    write_spec(tmp_path, DRAFT_SPEC)
    result = run_gate({"tool_name": "Write", "tool_input": {}}, tmp_path)
    assert result["decision"] == "approve"


def test_approval_must_be_in_frontmatter(tmp_path: Path) -> None:
    """`status: approved` mentioned in body prose must NOT flip the gate open."""
    make_git_root(tmp_path)
    sneaky = """---
status: draft
slice: ""
approved_at: ""
---

# Next slice

## Build notes
- Tried to set `status: approved` last session but reverted.
- Don't write `status: approved` until the slice is actually green.
"""
    write_spec(tmp_path, sneaky)
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "block", (
        "Body-prose mention of 'status: approved' must not approve the slice."
    )


def test_approval_anchored_to_line(tmp_path: Path) -> None:
    """Inline mentions like `status: approved-soon` must not count as approval."""
    make_git_root(tmp_path)
    fakey = """---
status: approved-soon
slice: ""
---

# Next slice
"""
    write_spec(tmp_path, fakey)
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "block"


def test_unreadable_spec_fails_open(tmp_path: Path) -> None:
    """A spec we can't decode shouldn't lock the project out — fail open."""
    make_git_root(tmp_path)
    spec_dir = tmp_path / ".specs"
    spec_dir.mkdir()
    # Invalid UTF-8 byte sequence.
    (spec_dir / "next.md").write_bytes(b"---\nstatus: draft\n---\n\n\xff\xfe garbage")
    result = run_gate(src_payload(str(tmp_path / "src" / "app.ts")), tmp_path)
    assert result["decision"] == "approve"
    assert "unreadable" in result.get("reason", "").lower()


def main() -> int:
    """Run all tests as a script (no pytest dependency)."""
    import tempfile
    import traceback

    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    failures = 0
    for fn in tests:
        with tempfile.TemporaryDirectory() as tmp:
            try:
                fn(Path(tmp))
                print(f"  ok  {fn.__name__}")
            except Exception:
                failures += 1
                print(f"FAIL  {fn.__name__}")
                traceback.print_exc()
    if failures:
        print(f"\n{failures} failure(s)")
        return 1
    print(f"\n{len(tests)} passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
