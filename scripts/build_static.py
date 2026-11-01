#!/usr/bin/env python3
"""Build an allowlisted static Worker bundle without shipping repository internals."""
import base64
import re
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    'investment-model.js', 'investment-ui.js', 'investment.css',
    'index.html', 'research-model.js', 'research-ui.js', 'research.css',
    'chips-model.js', 'chips-ui.js', 'priority-model.js', 'scoring-model.js', 'app-data.js',
    'ios-app.js', 'ios-app.css', 'manifest.webmanifest', 'sw.js',
    'data/stocks.json', 'data/chips.json', 'data/financial-summary.json',
    'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png',
    'icons/icon-512.png', 'icons/icon-maskable-512.png',
)


def build(root=ROOT):
    out = root / 'dist'
    if out.is_symlink():
        raise ValueError('Refusing symlink output directory')
    with tempfile.TemporaryDirectory(prefix='.qingyu-build-', dir=root) as folder:
        stage = Path(folder)
        manifest = {}
        for name in ASSETS:
            source = root / name
            if source.is_symlink() or not source.is_file():
                raise ValueError('Missing or symlinked public asset: ' + name)
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            manifest[name] = hashlib.sha256(target.read_bytes()).hexdigest()
        (stage / 'deployment.json').write_text(json.dumps({'app': 'qingyu-stock', 'assets': manifest}, sort_keys=True))
        html = (stage / 'index.html').read_text(encoding='utf-8')
        hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(code.encode('utf-8')).digest()).decode('ascii') + "'"
                  for code in re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', html) if code.strip()]
        csp = ("default-src 'self'; script-src 'self' " + ' '.join(hashes)
               + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; "
                 "worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; "
                 "frame-ancestors 'none'; form-action 'none'")
        security = ('/*\n  Content-Security-Policy: ' + csp
                    + '\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY'
                    + '\n  Referrer-Policy: no-referrer'
                    + '\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n')
        (stage / '_headers').write_text(security + '/\n  Cache-Control: no-cache\n/*.js\n  Cache-Control: no-cache\n/*.css\n  Cache-Control: no-cache\n/data/*\n  Cache-Control: no-store\n/deployment.json\n  Cache-Control: no-store\n/sw.js\n  Cache-Control: no-cache\n  Service-Worker-Allowed: /\n')
        if out.exists():
            shutil.rmtree(out)
        shutil.copytree(stage, out)
    return manifest


if __name__ == '__main__':
    print('Built', len(build()), 'public assets in dist/')
