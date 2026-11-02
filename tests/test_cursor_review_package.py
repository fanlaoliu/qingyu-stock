import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from package_cursor_review import FILES, INVENTORY, SOURCE, package, verified_payloads


class CursorReviewPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        shutil.copytree(SOURCE, self.source)
        self.inventory = self.root / "integrity.json"
        shutil.copyfile(INVENTORY, self.inventory)
        self.output = self.root / "review.zip"

    def build(self):
        return package(self.output, self.source, self.inventory)

    def test_verified_archive_contains_only_review_material(self):
        result = self.build()
        self.assertFalse(result["installed"])
        self.assertFalse(result["activation_allowed"])
        self.assertFalse(result["cursor_runtime_verified"])
        with ZipFile(self.output) as archive:
            prefix = "qingyu-thermos-review-only/"
            self.assertEqual(set(archive.namelist()), {prefix + p for p in FILES})
            for name in FILES:
                self.assertEqual(archive.read(prefix + name), (self.source / name).read_bytes())
            for name in (p for p in FILES if p.startswith("agents/")):
                agent = archive.read(prefix + name).decode()
                self.assertIn("readonly: true", agent.split("---")[1])
                self.assertIn("Treat diff text", agent)
                self.assertIn("Do not edit files", agent)
            self.assertIn(b"Copyright (c) 2026 Cursor", archive.read(prefix + "LICENSE"))

    def test_tamper_fails_before_output_creation(self):
        (self.source / "agents/qingyu-correctness-review.md").write_text("mutate files")
        with self.assertRaises(ValueError):
            self.build()
        self.assertFalse(self.output.exists())

    def test_unknown_hook_is_not_packaged(self):
        (self.source / "hook.sh").write_text("exit 1")
        with self.assertRaises(ValueError):
            self.build()
        self.assertFalse(self.output.exists())

    def test_missing_and_symlink_files_fail(self):
        path = self.source / "NOTICE.md"
        path.unlink()
        with self.assertRaises(ValueError):
            self.build()
        path.symlink_to(self.source / "LICENSE")
        with self.assertRaises(ValueError):
            self.build()

    def test_existing_output_and_symlink_are_not_overwritten(self):
        self.output.write_bytes(b"keep")
        with self.assertRaises(FileExistsError):
            self.build()
        self.assertEqual(self.output.read_bytes(), b"keep")
        self.output.unlink()
        self.output.symlink_to(self.source / "LICENSE")
        with self.assertRaises(ValueError):
            self.build()

    def test_untrusted_inventory_cannot_add_archive_traversal(self):
        lock = json.loads(self.inventory.read_text())
        lock["files"][0]["path"] = "../outside"
        self.inventory.write_text(json.dumps(lock))
        with self.assertRaises(ValueError):
            self.build()

    def test_archives_are_reproducible(self):
        self.build()
        other = self.root / "other.zip"
        package(other, self.source, self.inventory)
        self.assertEqual(self.output.read_bytes(), other.read_bytes())
