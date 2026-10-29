"""Inspect the actual AppX before handoff; never install it or submit it."""
import hashlib
import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

root = Path("release-microsoft-store")
packages = list(root.glob("*.appx"))
assert len(packages) == 1, "Expected exactly one AppX"
package = packages[0]
ns = {"m": "http://schemas.microsoft.com/appx/manifest/foundation/windows10",
      "uap": "http://schemas.microsoft.com/appx/manifest/uap/windows10",
      "rescap": "http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"}
with zipfile.ZipFile(package) as archive:
    names = archive.namelist()
    manifest = ET.fromstring(archive.read("AppxManifest.xml"))
    identity = manifest.find("m:Identity", ns)
    assert identity.attrib["Name"] == os.environ["INKLURA_WINDOWS_IDENTITY_NAME"]
    assert identity.attrib["Publisher"] == os.environ["INKLURA_WINDOWS_PUBLISHER"]
    assert identity.attrib["ProcessorArchitecture"] == "x64"
    version = json.loads(Path("package.json").read_text())["version"]
    assert identity.attrib["Version"] == version + ".0", "Unexpected Store version"
    publisher = manifest.find("m:Properties/m:PublisherDisplayName", ns)
    assert publisher.text == os.environ["INKLURA_WINDOWS_PUBLISHER_DISPLAY_NAME"]
    app = manifest.find("m:Applications/m:Application", ns)
    assert app.attrib["Id"] == "InkluraPDF"
    assert app.attrib["Executable"].replace("\\", "/") in names
    assert app.find("m:Extensions/uap:Extension/uap:FileTypeAssociation/uap:SupportedFileTypes/uap:FileType", ns).text == ".pdf"
    assert manifest.find("m:Capabilities/rescap:Capability[@Name='runFullTrust']", ns) is not None
    assert not any(name.endswith(("app-update.yml", "latest.yml")) for name in names)
    for name in ["StoreLogo.png", "Square44x44Logo.png", "Square150x150Logo.png", "Wide310x150Logo.png"]:
        assert archive.read("assets/" + name) == Path("build/appx", name).read_bytes(), "Wrong product icon"
report = {"package": package.name, "sha256": hashlib.sha256(package.read_bytes()).hexdigest(),
          "identity": identity.attrib, "manifest_checks": "passed",
          "installed_acceptance": "not performed", "store_submission": "not performed"}
(root / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
