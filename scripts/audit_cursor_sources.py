#!/usr/bin/env python3
"""Verify an inert local cursor/plugins snapshot. Never execute plugin content."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
MAX_FILE_BYTES = 2_000_000
MAX_TOTAL_BYTES = 20_000_000


def relative_path(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Invalid inventory path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ("", ".", "..") for part in value.split("/")):
        raise ValueError("Unsafe inventory path")
    return path


def git_blob_id(content):
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()


def audit(snapshot, inventory):
    """Return bounded findings; no source text or credential values in output."""
    snapshot = Path(snapshot).absolute()
    errors, findings, verified = [], [], 0
    if snapshot.is_symlink() or any(p.is_symlink() for p in snapshot.parents):
        raise ValueError("Snapshot root must not use symlinks")
    if not snapshot.is_dir():
        raise ValueError("Snapshot directory does not exist")
    if inventory.get("schema_version") != 1:
        raise ValueError("Unsupported inventory schema")
    if inventory.get("source_repository") != "https://github.com/cursor/plugins":
        raise ValueError("Unexpected source repository")
    if not re.fullmatch(r"[0-9a-f]{40}", inventory.get("source_commit", "")):
        raise ValueError("Invalid source commit")
    expected = {}
    plugin_roots = []
    for plugin in inventory["plugins"]:
        plugin_roots.append(relative_path(plugin["path"]))
    if len(plugin_roots) != len(set(plugin_roots)):
        raise ValueError("Duplicate plugin roots")
    for item in inventory["files"]:
        path = relative_path(item["path"])
        if not any(root in path.parents for root in plugin_roots):
            raise ValueError("File outside candidate plugin roots")
        if str(path) in expected or not re.fullmatch(r"[0-9a-f]{40}", item["git_blob_sha"]):
            raise ValueError("Duplicate path or invalid blob ID")
        expected[str(path)] = item["git_blob_sha"]
    for root in plugin_roots:
        for required in ("LICENSE", ".cursor-plugin/plugin.json"):
            if str(root / required) not in expected:
                raise ValueError("Missing required inventory entry")
    # Reject parent symlinks before descending into any candidate directory.
    for root in plugin_roots:
        for part in (root, *root.parents):
            if (snapshot / str(part)).is_symlink():
                raise ValueError("Candidate root must not use symlinks")
    total = 0
    for name, digest in expected.items():
        path = snapshot / name
        if path.is_symlink() or any(p.is_symlink() for p in path.parents):
            errors.append({"path": name, "reason": "symlink"})
            continue
        if not path.is_file():
            errors.append({"path": name, "reason": "missing-or-nonregular"})
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            errors.append({"path": name, "reason": "file-size-limit"})
            continue
        with path.open("rb") as stream:
            content = stream.read(MAX_FILE_BYTES + 1)
        total += len(content)
        if len(content) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
            raise ValueError("Snapshot size limit exceeded")
        if git_blob_id(content) != digest:
            errors.append({"path": name, "reason": "blob-mismatch"})
            continue
        verified += 1
        try:
            lines = content.decode("utf-8").splitlines()
        except UnicodeDecodeError:
            errors.append({"path": name, "reason": "non-utf8-in-text-inventory"})
            continue
        patterns = {
            "floating-package-version": r"@latest\b",
            "credential-interface": r"Authorization|PERSONAL_ACCESS_TOKEN",
            "agent-orchestration": r"subagent_type|run_in_background",
            "write-scope-review": r"take.the.wheel|\bFSD\b|go for it",
        }
        for number, line in enumerate(lines, 1):
            for rule, pattern in patterns.items():
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({"path": name, "line": number, "rule": rule})
    # Images were deliberately excluded from the original review inventory.
    # Accept only known image suffixes below assets; never execute or render them.
    for root in plugin_roots:
        base = snapshot / str(root)
        for path in base.rglob("*"):
            name = path.relative_to(snapshot).as_posix()
            if path.is_symlink():
                errors.append({"path": name, "reason": "symlink"})
            elif path.is_file() and name not in expected:
                relative = path.relative_to(base)
                if relative.parts[0] != "assets" or path.suffix.lower() not in (".png", ".svg"):
                    errors.append({"path": name, "reason": "unreviewed-file"})
    return {"source_commit": inventory["source_commit"],
            "verified_files": verified, "expected_files": len(expected),
            "integrity_passed": not errors, "errors": errors, "findings": findings,
            "activation_allowed": False,
            "limitations": ["Pattern findings are review hints, not a security verdict.",
                            "Assets are excluded from integrity verification.",
                            "No npm, MCP, Cursor runtime or dependency validation performed."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--inventory", type=Path, default=ROOT / "docs/cursor-plugins.lock.json")
    args = parser.parse_args()
    try:
        result = audit(args.snapshot, json.loads(args.inventory.read_text()))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        # Do not echo untrusted exception messages or source content.
        print(json.dumps({"integrity_passed": False, "activation_allowed": False,
                          "error": type(exc).__name__}))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["integrity_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
