#!/usr/bin/env python3
"""Package the reviewed Thermos derivative as an inert ZIP; never install it."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tooling/cursor/thermos-review-only"
INVENTORY = ROOT / "tooling/cursor/thermos-review-only.integrity.json"
FILES = frozenset(("LICENSE", "NOTICE.md", ".cursor-plugin/plugin.json",
                   "agents/qingyu-correctness-review.md",
                   "agents/qingyu-structure-review.md"))


def verified_payloads(source=SOURCE, inventory=INVENTORY):
    source = Path(source).absolute()
    if source.is_symlink() or any(p.is_symlink() for p in source.parents):
        raise ValueError("Source symlink")
    lock = json.loads(Path(inventory).read_text())
    if lock["schema_version"] != 1:
        raise ValueError("Inventory schema")
    entries = lock["files"]
    if len(entries) != len(FILES) or {e["path"] for e in entries} != FILES:
        raise ValueError("Unexpected inventory entries")
    actual = set()
    for path in source.rglob("*"):
        if path.is_symlink():
            raise ValueError("Source symlink")
        if not path.is_dir():
            actual.add(path.relative_to(source).as_posix())
    if actual != FILES:
        raise ValueError("Missing or unreviewed file")
    payloads = {}
    for entry in entries:
        path = source / entry["path"]
        if not path.is_file() or path.stat().st_size > 100_000:
            raise ValueError("Nonregular or oversized file")
        with path.open("rb") as stream:
            content = stream.read(100_001)
        if len(content) > 100_000 or hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise ValueError("Content integrity mismatch")
        payloads[entry["path"]] = content
    plugin = json.loads(payloads[".cursor-plugin/plugin.json"])
    if (plugin["name"] != "qingyu-thermos-review-only" or plugin["agents"] != "./agents/"
            or set(plugin) & {"mcpServers", "hooks", "scripts", "skills", "commands"}):
        raise ValueError("Unexpected plugin capabilities")
    return payloads


def package(output, source=SOURCE, inventory=INVENTORY):
    payloads = verified_payloads(source, inventory)
    output = Path(output).absolute()
    if output.suffix != ".zip" or output.is_symlink() or any(p.is_symlink() for p in output.parents):
        raise ValueError("Unsafe output path")
    # Exclusive creation: never replace an existing artifact or follow a symlink.
    with output.open("xb") as stream:
        try:
            with ZipFile(stream, "w", compression=ZIP_DEFLATED) as archive:
                for name, content in sorted(payloads.items()):
                    info = ZipInfo("qingyu-thermos-review-only/" + name, date_time=(2026, 1, 1, 0, 0, 0))
                    info.compress_type = ZIP_DEFLATED
                    info.external_attr = 0o100644 << 16
                    archive.writestr(info, content)
        except Exception:
            output.unlink(missing_ok=True)
            raise
    return {"packaged_files": len(payloads), "installed": False,
            "activation_allowed": False, "cursor_runtime_verified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        result = package(args.output)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(json.dumps({"packaged": False, "installed": False, "error": type(exc).__name__}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
