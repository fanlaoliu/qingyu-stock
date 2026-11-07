import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from audit_cursor_sources import audit, git_blob_id


class SourceAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        files = {"sample/LICENSE": "MIT\n",
                 "sample/.cursor-plugin/plugin.json": '{"name":"sample"}\n',
                 "sample/README.md": "npx package@latest\nAuthorization: example\n"}
        self.inventory = {"schema_version": 1,
                          "source_repository": "https://github.com/cursor/plugins",
                          "source_commit": "a" * 40,
                          "plugins": [{"path": "sample"}], "files": []}
        for name, text in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            self.inventory["files"].append({"path": name, "git_blob_sha": git_blob_id(text.encode())})

    def test_verified_source_does_not_authorize_activation(self):
        result = audit(self.root, self.inventory)
        self.assertTrue(result["integrity_passed"])
        self.assertEqual(result["verified_files"], 3)
        self.assertFalse(result["activation_allowed"])
        self.assertIn({"path": "sample/README.md", "line": 1,
                       "rule": "floating-package-version"}, result["findings"])
        self.assertNotIn("Authorization: example", json.dumps(result))

    def test_tampering_and_missing_files_fail(self):
        (self.root / "sample/README.md").write_text("changed")
        (self.root / "sample/LICENSE").unlink()
        result = audit(self.root, self.inventory)
        self.assertFalse(result["integrity_passed"])
        self.assertEqual({e["reason"] for e in result["errors"]},
                         {"blob-mismatch", "missing-or-nonregular"})

    def test_symlink_file_fails(self):
        path = self.root / "sample/README.md"
        path.unlink()
        path.symlink_to(self.root / "sample/LICENSE")
        self.assertFalse(audit(self.root, self.inventory)["integrity_passed"])

    def test_symlink_root_fails_before_traversal(self):
        link = self.root / "linked"
        link.symlink_to(self.root / "sample", target_is_directory=True)
        inventory = copy.deepcopy(self.inventory)
        inventory["plugins"][0]["path"] = "linked"
        for item in inventory["files"]:
            item["path"] = item["path"].replace("sample/", "linked/")
        with self.assertRaises(ValueError):
            audit(self.root, inventory)

    def test_unknown_hooks_and_asset_scripts_fail(self):
        path = self.root / "sample/assets/postinstall.js"
        path.parent.mkdir()
        path.write_text("throw Error('never execute')")
        result = audit(self.root, self.inventory)
        self.assertFalse(result["integrity_passed"])
        self.assertIn({"path": "sample/assets/postinstall.js", "reason": "unreviewed-file"}, result["errors"])

    def test_inventory_traversal_and_duplicates_fail(self):
        for name in ("../outside", "/absolute", "sample/../outside", "sample//README.md", "sample\\README.md"):
            with self.subTest(name=name):
                inventory = copy.deepcopy(self.inventory)
                inventory["files"][0]["path"] = name
                with self.assertRaises(ValueError):
                    audit(self.root, inventory)
        self.inventory["files"].append(self.inventory["files"][0])
        with self.assertRaises(ValueError):
            audit(self.root, self.inventory)

    def test_required_manifest_cannot_be_removed_from_inventory(self):
        self.inventory["files"] = self.inventory["files"][1:]
        with self.assertRaises(ValueError):
            audit(self.root, self.inventory)

    def test_cli_exit_codes(self):
        inventory = self.root / "inventory.json"
        inventory.write_text(json.dumps(self.inventory))
        command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/audit_cursor_sources.py"),
                   str(self.root), "--inventory", str(inventory)]
        self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
        (self.root / "sample/LICENSE").unlink()
        self.assertEqual(subprocess.run(command, capture_output=True).returncode, 1)
        inventory.write_text("not JSON")
        self.assertEqual(subprocess.run(command, capture_output=True).returncode, 2)
