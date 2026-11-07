import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_vercel', ROOT / 'scripts/build_vercel.py')
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


class VercelBuildTests(unittest.TestCase):
    def prepare(self, root):
        for name in B._static.ASSETS:
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('<script>const test = 1;</script>' if name == 'index.html' else 'test')

    def test_allowlist_headers_and_provenance_exclude_credentials_and_tools(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.prepare(root)
            for name in ['.env', '.env.production', 'tooling/private.json', 'tests/fixture.json', 'reports/private.json']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('excluded fixture')
            result = B.package(root, source_commit='a' * 40)
            output = Path(result['directory'])
            names = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
            self.assertEqual(names, set(B._static.ASSETS) | {'deployment.json', 'vercel.json'})
            headers = json.loads((output / 'vercel.json').read_text())['headers'][0]['headers']
            csp = next(h['value'] for h in headers if h['key'] == 'Content-Security-Policy')
            self.assertIn('sha256-', csp)
            self.assertIn("frame-ancestors 'none'", csp)
            self.assertIn({'key': 'Cache-Control', 'value': 'private, no-store'}, headers)
            self.assertEqual(json.loads((output / 'deployment.json').read_text())['source_commit'], 'a' * 40)

    def test_refuses_symlink_output_and_missing_public_asset(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.prepare(root)
            (root / '.local-vercel').symlink_to(root / 'elsewhere')
            with self.assertRaises(ValueError):
                B.package(root)
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.prepare(root)
            (root / 'index.html').unlink()
            with self.assertRaises(ValueError):
                B.package(root)
