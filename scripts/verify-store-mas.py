"""Verify a signed universal MAS package, independently of notarized DMGs."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import stat
import struct

root = Path("release-mac-app-store")
team = os.environ["INKLURA_APPLE_TEAM_ID"]
assert re.fullmatch(r"[A-Z0-9]{10}", team)
apps = list(root.glob("mas*/Inklura PDF.app"))
assert len(apps) == 1, "Expected one universal MAS app"
architectures = set()
for app in apps:
    # Installer files are owned by root. Every user must be able to read signed
    # resources and traverse directories, including the embedded public profile.
    for item in [app, *app.rglob("*")]:
        if item.is_symlink():
            continue
        mode = item.stat().st_mode
        assert mode & stat.S_IROTH, f"Not readable by installed user: {item}"
        if item.is_dir():
            assert mode & stat.S_IXOTH, f"Directory not traversable: {item}"
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    icon_name = info["CFBundleIconFile"]
    if not icon_name.endswith(".icns"):
        icon_name += ".icns"
    icon = (app / "Contents/Resources" / icon_name).read_bytes()
    assert icon[:4] == b"icns"
    offset = 8
    icon_types = set()
    while offset < len(icon):
        kind, size = struct.unpack_from(">4sI", icon, offset)
        assert size >= 8 and offset + size <= len(icon), "Invalid ICNS chunk"
        icon_types.add(kind)
        offset += size
    assert b"ic10" in icon_types, "Missing 512pt @2x (1024px) Mac icon"
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
    # Authority lines require a verbose display; keep the independent strict
    # signature verification above and fail closed on a wrong signing identity.
    details = subprocess.run(["codesign", "--display", "--verbose=4", str(app)], check=True, capture_output=True, text=True).stderr
    print(details)
    assert f"TeamIdentifier={team}" in details
    assert "Authority=Apple Distribution:" in details or "Authority=3rd Party Mac Developer Application:" in details
    entitlement_bytes = subprocess.run(["codesign", "-d", "--entitlements", ":-", str(app)], check=True, capture_output=True).stdout
    entitlements = plistlib.loads(entitlement_bytes)
    assert entitlements["com.apple.security.app-sandbox"] is True
    assert entitlements["com.apple.security.network.client"] is True
    assert entitlements["com.apple.security.files.user-selected.read-write"] is True
    assert entitlements["com.apple.security.files.bookmarks.app-scope"] is True
    profile = subprocess.run(["security", "cms", "-D", "-i", str(app / "Contents/embedded.provisionprofile")], check=True, capture_output=True).stdout
    profile_data = plistlib.loads(profile)
    assert team in profile_data["TeamIdentifier"]
    assert "ProvisionedDevices" not in profile_data, "Development profile cannot be submitted"
    architecture = subprocess.check_output(["lipo", "-archs", str(app / "Contents/MacOS/Inklura PDF")], text=True).split()
    architectures.update(architecture)
assert architectures == {"x86_64", "arm64"}
packages = list(root.glob("mas*/*.pkg"))
assert len(packages) == 1, "Expected one universal MAS installer package"
for package in packages:
    result = subprocess.check_output(["pkgutil", "--check-signature", str(package)], text=True)
    assert f"({team})" in result and "3rd Party Mac Developer Installer" in result
report = {"signature_and_sandbox_checks": "passed", "team": team,
          "architectures": sorted(architectures),
          "packages": [{"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in packages],
          "installed_acceptance": "not performed", "store_submission": "not performed"}
(root / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
