#!/usr/bin/env python3
"""Prepare an allowlisted static Vercel release; no credentials, upload or deployment."""
import importlib.util
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('qingyu_static', Path(__file__).with_name('build_static.py'))
_static = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_static)


def package(root=ROOT, source_commit=None):
    root = Path(root)
    local = root / '.local-vercel'
    if local.is_symlink():
        raise ValueError('Refusing symlink release directory')
    local.mkdir(exist_ok=True)
    output = local / 'site'
    if output.is_symlink():
        raise ValueError('Refusing symlink release output')
    assets = _static.build(root)
    source = root / 'dist'
    headers = []
    for line in (source / '_headers').read_text().splitlines()[1:]:
        if not line.startswith(' '):
            break
        key, value = line.strip().split(': ', 1)
        headers.append({'key': key, 'value': value})
    if not any(h['key'] == 'Content-Security-Policy' and 'sha256-' in h['value'] for h in headers):
        raise ValueError('Missing script hash policy')
    headers += [{'key': 'Cache-Control', 'value': 'private, no-store'},
                {'key': 'X-Robots-Tag', 'value': 'noindex, nofollow, noarchive'}]
    if source_commit is None:
        result = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, capture_output=True, text=True)
        source_commit = result.stdout.strip() if result.returncode == 0 else None
    with tempfile.TemporaryDirectory(prefix='release-', dir=local) as folder:
        stage = Path(folder)
        for name in [*assets, 'deployment.json']:
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / name, target)
        manifest_path = stage / 'deployment.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['source_commit'] = source_commit
        manifest['data_refresh'] = 'manual-release-snapshot'
        ledger = root / 'docs' / 'releases' / 'all-pr-20261107.json'
        if ledger.is_file():
            manifest['integrated_pull_requests'] = json.loads(ledger.read_text())['pull_requests']
        manifest_path.write_text(json.dumps(manifest, sort_keys=True))
        (stage / 'vercel.json').write_text(json.dumps({'headers': [{'source': '/(.*)', 'headers': headers}]}))
        if output.exists():
            shutil.rmtree(output)
        shutil.copytree(stage, output)
    return {'directory': str(output), 'files': len(assets) + 2, 'source_commit': source_commit,
            'uploaded': False, 'deployment_protection_required': 'Vercel Authentication: all'}


if __name__ == '__main__':
    print(json.dumps(package(), ensure_ascii=False))
