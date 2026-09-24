"""Verify PDF registration in both native macOS application bundles."""
import glob
import plistlib
import subprocess

bundles = glob.glob('release/mac*/Inklura PDF.app')
assert len(bundles) == 2, f'Expected Intel and Apple Silicon bundles, found {bundles}'
for bundle in bundles:
    with open(f'{bundle}/Contents/Info.plist', 'rb') as stream:
        info = plistlib.load(stream)
    pdf_types = [entry for entry in info.get('CFBundleDocumentTypes', [])
                 if 'pdf' in entry.get('CFBundleTypeExtensions', [])]
    assert pdf_types, f'PDF document type missing: {bundle}'
    assert all(entry.get('CFBundleTypeRole') == 'Editor' and
               entry.get('LSHandlerRank') == 'Alternate' for entry in pdf_types)
    subprocess.run([
        '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
        '-f', bundle,
    ], check=True)
    print(f'PDF type and alternate handler registration verified: {bundle}')
