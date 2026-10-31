import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('build_static',ROOT/'scripts/build_static.py')
B=importlib.util.module_from_spec(spec);spec.loader.exec_module(B)

class StaticBuildTests(unittest.TestCase):
    def test_bundle_is_allowlisted_and_integrity_matches(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for name in B.ASSETS:
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('asset '+name)
            (root/'private.env').write_text('never publish')
            (root/'dist').mkdir();(root/'dist'/'old-secret.txt').write_text('old')
            result=B.build(root)
            files={str(p.relative_to(root/'dist')) for p in (root/'dist').rglob('*') if p.is_file()}
            self.assertEqual(files,set(B.ASSETS)|{'_headers','deployment.json'})
            self.assertEqual(result['index.html'],hashlib.sha256((root/'index.html').read_bytes()).hexdigest())
            self.assertEqual(json.loads((root/'dist/deployment.json').read_text())['assets'],result)
            self.assertIn('Cache-Control: no-store',(root/'dist/_headers').read_text())
    def test_missing_asset_preserves_previous_bundle(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'dist').mkdir();(root/'dist'/'index.html').write_text('previous')
            with self.assertRaises(ValueError):B.build(root)
            self.assertEqual((root/'dist/index.html').read_text(),'previous')
    def test_every_local_browser_script_is_in_public_bundle(self):
        from html.parser import HTMLParser
        scripts=[]
        class Parser(HTMLParser):
            def handle_starttag(self,tag,attrs):
                a=dict(attrs)
                if tag=='script' and a.get('src'):scripts.append(a['src'].lstrip('/'))
        Parser().feed((ROOT/'index.html').read_text())
        self.assertTrue(set(scripts).issubset(B.ASSETS))

if __name__=='__main__':unittest.main()
