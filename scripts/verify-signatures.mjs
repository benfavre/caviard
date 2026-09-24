import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
if (process.platform === "darwin" && process.env.CSC_LINK) {
  for (const directory of ["mac", "mac-arm64"]) {
    const app = path.resolve("release", directory, "Inklura PDF.app");
    execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
      stdio: "inherit",
    });
    execFileSync("spctl", ["--assess", "--type", "execute", "--verbose", app], {
      stdio: "inherit",
    });
    execFileSync("xcrun", ["stapler", "validate", app], { stdio: "inherit" });
  }
  console.log(
    "Both Mac apps have valid signatures and stapled notarization tickets.",
  );
} else if (process.platform === "win32" && process.env.WIN_CSC_LINK) {
  const files = [
    path.resolve("release/win-unpacked/Inklura PDF.exe"),
    ...readdirSync("release")
      .filter((n) => n.endsWith(".exe"))
      .map((n) => path.resolve("release", n)),
  ];
  for (const file of files) {
    // Pass paths as data, never interpolate them into PowerShell code.
    execFileSync(
      "pwsh",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        '$s = Get-AuthenticodeSignature -LiteralPath $env:INKLURA_VERIFY_FILE; if ($s.Status -ne "Valid") { throw "Invalid Authenticode signature" }',
      ],
      { stdio: "inherit", env: { ...process.env, INKLURA_VERIFY_FILE: file } },
    );
  }
  console.log(
    "Windows application and installers have valid Authenticode signatures.",
  );
} else
  console.log(
    "Signing credentials not configured for this platform; artifacts remain unsigned.",
  );
