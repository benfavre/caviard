#!/usr/bin/env python3
"""Mirror a published release into PRISM public/, verifying GitHub asset digests."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.request

args = sys.argv[1:]
preview = '--prerelease' in args
if preview:
    args.remove('--prerelease')
version, site_arg = args
pattern = r'\d+\.\d+\.\d+-beta\.\d+' if preview else r'\d+\.\d+\.\d+'
if not re.fullmatch(pattern, version):
    raise SystemExit('Expected an explicit stable or beta semantic version')
site = Path(site_arg).resolve()
with urllib.request.urlopen(f'https://api.github.com/repos/benfavre/caviard/releases/tags/v{version}') as response:
    release = json.load(response)
if release['draft'] or release['prerelease'] != preview:
    raise SystemExit('Release status does not match the requested channel')
names = [f'Inklura-PDF-{version}-{suffix}' for suffix in ('win-x64.exe', 'mac-arm64.dmg', 'mac-x64.dmg', 'linux-x86_64.AppImage')]
names += ['example-pdfs.zip', 'inklura-ai-example-pdfs.zip']
assets = {a['name']: a for a in release['assets']}
root = site / 'public/downloads/inklura-pdf'
root.mkdir(parents=True, exist_ok=True)
final = root / version

def checksum(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

# Never expose partial files: download to a private staging directory first.
with tempfile.TemporaryDirectory(prefix='inklura-pdf-') as tmp:
    staging = Path(tmp)
    manifest = []
    for name in names:
        asset = assets[name]
        digest = asset.get('digest', '')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', digest):
            raise SystemExit(f'Missing SHA256 digest for {name}')
        expected = digest.split(':', 1)[1]
        path = staging / name
        existing = final / name
        if existing.exists():
            if existing.stat().st_size != asset['size'] or checksum(existing) != expected:
                raise SystemExit(f'Existing immutable release differs: {name}')
        else:
            subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '3', '--max-time', '600', '--output', str(path), asset['browser_download_url']], check=True)
            if path.stat().st_size != asset['size'] or checksum(path) != expected:
                raise SystemExit(f'Integrity check failed: {name}')
        manifest.append({'name': name, 'size': asset['size'], 'sha256': expected, 'url': f'/downloads/inklura-pdf/{version}/{name}'})
        print(f'Verified {name} ({asset["size"]} bytes)', flush=True)
    payload = {'version': version, 'releaseUrl': release['html_url'], 'assets': manifest}
    (staging / 'release.json').write_text(json.dumps(payload, indent=2) + '\n')
    (staging / 'SHA256SUMS.txt').write_text(''.join(f'{a["sha256"]}  {a["name"]}\n' for a in manifest))
    if not final.exists():
        # tempfile and public may live on different filesystems; stage adjacent for rename.
        import shutil
        adjacent = root / f'.{version}-{os.getpid()}'
        shutil.copytree(staging, adjacent)
        adjacent.chmod(0o755)
        adjacent.rename(final)
    else:
        for path in staging.iterdir():
            if not (final / path.name).exists():
                import shutil
                shutil.copy2(path, final / path.name)
    # The page imports the release manifest only after every artifact is verified.
    target = site / 'src/lib' / ('inklura-pdf-preview.json' if preview else 'inklura-pdf-release.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix('.json.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    temp.replace(target)
