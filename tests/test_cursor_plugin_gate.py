"""Fail closed while the audited candidates remain blocked."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class CursorPluginGateTests(unittest.TestCase):
    def test_blocked_candidates_have_no_active_mcp(self):
        lock = json.loads((ROOT / "docs/cursor-plugins.lock.json").read_text())
        self.assertFalse(lock["activation_allowed"])
        self.assertRegex(lock["source_commit"], r"^[0-9a-f]{40}$")
        self.assertEqual({p["name"] for p in lock["plugins"]},
                         {"github", "playwright", "thermos", "agent-compatibility"})
        for plugin in lock["plugins"]:
            self.assertTrue(plugin["status"].startswith("blocked-"))
            self.assertIsNone(plugin["npm_version"])
        for relative in (".cursor/mcp.json", ".mcp.json"):
            path = ROOT / relative
            if path.exists():
                servers = json.loads(path.read_text()).get("mcpServers", {})
                self.assertFalse(set(servers) & {"github", "playwright", "thermos", "agent-compatibility"})

    def test_inventory_is_immutable_and_complete_for_candidates(self):
        lock = json.loads((ROOT / "docs/cursor-plugins.lock.json").read_text())
        paths = [f["path"] for f in lock["files"]]
        self.assertEqual(len(paths), len(set(paths)))
        for item in lock["files"]:
            self.assertRegex(item["git_blob_sha"], r"^[0-9a-f]{40}$")
            self.assertNotIn("..", Path(item["path"]).parts)
        for plugin in lock["plugins"]:
            self.assertIn(plugin["path"] + "/LICENSE", paths)
            self.assertIn(plugin["path"] + "/.cursor-plugin/plugin.json", paths)
