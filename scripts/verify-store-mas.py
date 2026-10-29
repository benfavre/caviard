"""Verify both signed MAS architectures, independently of notarized DMGs."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess

root = Path("release-mac-app-store")
team = os.environ["INKLURA_APPLE_TEAM_ID"]
assert re.fullmatch(r"[A-Z0-9]{10}", team)
apps = list(root.glob("mas*/Inklura PDF.app"))
assert len(apps) == 2, "Expected Intel and Apple Silicon MAS apps"
architectures = set()
for app in apps:
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
    details = subprocess.run(["codesign", "-dv", str(app)], check=True, capture_output=True, text=True).stderr
    assert f"TeamIdentifier={team}" in details
    assert "Authority=Apple Distribution:" in details or "Authority=3rd Party Mac Developer Application:" in details
    entitlement_bytes = subprocess.run(["codesign", "-d", "--entitlements", ":-", str(app)], check=True, capture_output=True).stdout
    entitlements = plistlib.loads(entitlement_bytes)
    assert entitlements["com.apple.security.app-sandbox"] is True
    assert entitlements["com.apple.security.network.client"] is True
    assert entitlements["com.apple.security.files.user-selected.read-write"] is True
    profile = subprocess.run(["security", "cms", "-D", "-i", str(app / "Contents/embedded.provisionprofile")], check=True, capture_output=True).stdout
    profile_data = plistlib.loads(profile)
    assert team in profile_data["TeamIdentifier"]
    assert "ProvisionedDevices" not in profile_data, "Development profile cannot be submitted"
    architecture = subprocess.check_output(["lipo", "-archs", str(app / "Contents/MacOS/Inklura PDF")], text=True).strip()
    architectures.add(architecture)
assert architectures == {"x86_64", "arm64"}
packages = list(root.glob("mas*/*.pkg"))
assert len(packages) == 2, "Expected two MAS installer packages"
for package in packages:
    result = subprocess.check_output(["pkgutil", "--check-signature", str(package)], text=True)
    assert f"({team})" in result and "3rd Party Mac Developer Installer" in result
report = {"signature_and_sandbox_checks": "passed", "team": team,
          "packages": [{"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in packages],
          "installed_acceptance": "not performed", "store_submission": "not performed"}
(root / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
