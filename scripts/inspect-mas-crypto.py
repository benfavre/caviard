"""Inspect the exact uploaded MAS runtime without changing or re-signing it."""
import json, os, pathlib, plistlib, shutil, subprocess, tempfile
root = pathlib.Path('source-mas-package').resolve()
pkg = root / 'mas-universal/Inklura-PDF-1.4.0-mac-app-store-universal.pkg'
subprocess.run(['node', 'scripts/upload-store-mas.mjs', 'inspect', str(root)], check=True)
probe = pathlib.Path('scripts/mas-crypto-probe.cjs').read_text()
report = {'package_sha256':'2955e874fe75fcb27ba37f56ec886eccfe16e979db85ff9d9eea28d9d470e023', 'installed_acceptance':False}
with tempfile.TemporaryDirectory(prefix='inklura-crypto-') as tmp:
    expanded = pathlib.Path(tmp) / 'expanded'
    subprocess.run(['pkgutil', '--expand-full', str(pkg), str(expanded)], check=True)
    apps = list(expanded.rglob('Inklura PDF.app'))
    assert len(apps) == 1, 'Expected exact app bundle'
    app = apps[0]
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    info = plistlib.loads((app/'Contents/Info.plist').read_bytes())
    assert info['CFBundleIdentifier'] == 'com.benfavre.caviard'
    report['build'] = info['CFBundleVersion']
    env = dict(os.environ, ELECTRON_RUN_AS_NODE='1')
    run = subprocess.run([str(app/'Contents/MacOS/Inklura PDF'), '-e', probe], env=env, capture_output=True, text=True, timeout=180)
    report['exit_code'] = run.returncode
    rows = [line for line in run.stdout.splitlines() if line.startswith('INKLURA_CRYPTO_REPORT=')]
    if len(rows) == 1:
        report['runtime'] = json.loads(rows[0].split('=',1)[1])
    else:
        report['runtime_unavailable'] = True
        report['diagnostic'] = run.stderr[-3000:]
        # Probe an isolated diagnostic copy when the distribution identity cannot
        # execute on CI. This is runtime evidence, never installed MAS acceptance.
        diagnostic = pathlib.Path(tmp) / 'diagnostic/Inklura PDF.app'
        shutil.copytree(app, diagnostic, symlinks=True)
        subprocess.run(['codesign', '--force', '--deep', '--sign', '-', '--entitlements',
                        'build/entitlements.mac.plist', str(diagnostic)], check=True)
        diagnostic_run = subprocess.run([str(diagnostic/'Contents/MacOS/Inklura PDF'), '-e', probe],
                                       env=env, capture_output=True, text=True, timeout=240)
        report['diagnostic_copy_exit_code'] = diagnostic_run.returncode
        diagnostic_rows = [line for line in diagnostic_run.stdout.splitlines() if line.startswith('INKLURA_CRYPTO_REPORT=')]
        if len(diagnostic_rows) == 1:
            report['diagnostic_copy_runtime'] = json.loads(diagnostic_rows[0].split('=',1)[1])
            report['evidence_scope'] = 'Exact package runtime, ad-hoc signed diagnostic copy; not MAS sandbox acceptance'
        else:
            report['diagnostic_copy_error'] = diagnostic_run.stderr[-3000:]
    # The signed bundle must remain unchanged even if the OS refuses execution.
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
pathlib.Path('mas-crypto-inventory.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
