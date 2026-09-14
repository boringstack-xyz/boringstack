#!/usr/bin/env bash
# Preview by default. Use only when this fork does not publish the upstream site.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ $# -gt 1 || (${1:-} != "" && ${1:-} != "--apply") ]]; then
  echo 'Usage: scripts/strip-docs.sh [--apply]' >&2
  exit 2
fi
python3 - "$ROOT" "${1:-}" <<'PY'
import pathlib
import re
import shutil
import sys

root = pathlib.Path(sys.argv[1])
apply = sys.argv[2] == "--apply"
for relative in ("apps", ".github", ".github/workflows", ".github/dependabot.yml"):
    if (root / relative).is_symlink():
        raise SystemExit(f"Refusing symlink: {relative}")
paths = [root / "apps/docs", *sorted((root / ".github/workflows").glob("apps-docs-*.yml"))]
for path in paths:
    if path.is_symlink():
        raise SystemExit(f"Refusing symlink: {path.relative_to(root)}")
    if path.exists():
        print(f"Remove {path.relative_to(root)}")

config = root / ".github/dependabot.yml"
updated = None
if config.exists():
    source = config.read_text()
    entries = re.split(r"(?=^  - package-ecosystem:)", source, flags=re.MULTILINE)
    updated = "".join(entry for entry in entries if not re.search(r"^    directory: /apps/docs\s*$", entry, re.MULTILINE))
    if updated != source:
        print("Remove /apps/docs dependency update entry")

documentation = {}
for name in ("AGENTS.md", "CONTRIBUTING.md"):
    path = root / name
    if path.is_symlink():
        raise SystemExit(f"Refusing symlink: {name}")
    if path.exists():
        content = path.read_text()
        content = "\n".join(line for line in content.split("\n") if not line.startswith("- [apps/docs/DEPLOY.md]") and not re.match(r"^\| `apps/docs`\s*\|", line))
        documentation[path] = content.replace("`apps/ui`, `apps/docs`,", "`apps/ui`,")
        if documentation[path] != path.read_text():
            print(f"Remove docs-only links from {name}")

if not apply:
    print("Preview only. Review, then rerun with --apply. Historical secret-scan exceptions are retained.")
    raise SystemExit(0)

for path in paths:
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()
if updated is not None:
    config.write_text(updated)
for path, content in documentation.items():
    path.write_text(content)
print("Docs removed. Review repository required checks and product documentation before pushing.")
PY
