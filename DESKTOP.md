# Inklura PDF desktop application

Repository and release feed: https://github.com/benfavre/caviard

## Run and package

Use Node 22 or newer, then `npm ci`.

```sh
npm run desktop        # build frontend and run Electron
npm run desktop:pack   # unpacked application in release/
npm run desktop:dist   # native installer for the current OS
```

The GitHub Actions Desktop releases workflow builds Windows x64 NSIS installers, macOS Intel and Apple Silicon DMG/ZIP files, and Linux x64 AppImages on native runners. You can run it manually to obtain build artifacts without publishing.

On Linux, make the AppImage executable and keep it in a writable folder for updates. A system with FUSE support is needed for normal AppImage execution. The unpacked app is useful for testing but does not self-update.

## Open files and folders from your desktop

- **Windows:** the NSIS installer adds **Caviarder avec Inklura PDF** to PDF right-click menus and **Importer les PDF avec Inklura** to folder menus (including the background of an open folder). On Windows 11 these classic actions may appear under **Show more options**. Inklura is also added to PDF **Open with** choices; the current default PDF reader is preserved. Uninstall removes only Inklura's registrations.
- **macOS:** the application declares PDF support for Finder's **Open With → Inklura PDF**. Move the app to Applications first. Folder import is available from the application's File menu or by dragging a folder into its window.
- **Linux:** the AppImage advertises PDF and directory support. In the packaged app, choose **Fichier → Ajouter au menu Ouvrir avec…** to register its current location in your user desktop menu. PDF and folder **Open With** availability depends on your file manager. Move the AppImage to a permanent location before registering; repeat the action if you move it. **Retirer du menu Ouvrir avec** removes this registration. No default file associations are changed.

The desktop app accepts PDF and folder paths on its command line. A second launch forwards its selection to the existing window, preserving current documents and edits. Imports received during loading, analysis or export wait until the workspace is available.

**Importer un dossier** recursively reads PDFs, retains relative subfolder names and skips non-PDF files, hidden entries and filesystem links. Documents are loaded sequentially; the workspace is bounded to 250 PDFs and 512 MiB of source files. Repeated native imports skip already-open paths. Empty, inaccessible, invalid or oversized selections produce an explanatory message. The website also supports a folder picker and folder drops in browsers that provide directory entries.

When several PDFs are exported in the desktop app, choose the destination once. Inklura creates a fresh `Inklura-caviardages-*` folder, preserves the imported directory structure and disambiguates colliding output names. Originals and previous exports are not overwritten. Each saved PDF follows the normal account credit reservation/commit flow. Canceling the destination picker saves nothing and consumes no credits; if a later file fails, earlier saved PDFs remain available and their saved status is retained.

The Linux integration and Electron launch/import/export flows can be exercised on Linux. Windows Explorer registrations and macOS Finder registration must also be checked with native installers on their respective operating systems before release.

## Automatic updates

`electron-updater` reads the release feed packaged by electron-builder for `benfavre/caviard`. Installed apps check after 15 seconds and every four hours, or when the user clicks the update button. Updates download automatically. Installation requires **Redémarrer et installer** and is blocked while documents are being processed or redactions have not been exported. Closing the app never silently installs an update.

PDFs are processed locally. Only update metadata and application binaries are fetched from GitHub. The renderer has no Node access and uses a sandboxed preload exposing narrowly scoped operations. Saving uses the OS file dialog and a temporary file followed by rename.

The first builds have no verified publisher signature (Mac apps receive an ad-hoc signature for Apple Silicon compatibility). Windows and Linux updates are enabled. **Unsigned macOS builds cannot self-update**; their UI links directly to the appropriate Apple Silicon or Intel download on pdf.inklura.fr. To enable signed macOS updates, configure repository Actions secrets `CSC_LINK` (base64 Developer ID Application .p12 certificate) and `CSC_KEY_PASSWORD`. For notarization also set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. The builder imports and signs with that certificate and enables Mac updates in the resulting package. Existing unsigned Mac installations must be replaced manually with the first signed build. Signed update installation has not been validated without these credentials.

To release a new version, update `package.json` and the lockfile (`npm version patch --no-git-tag-version`), update `RELEASE_NOTES.md`, run the tests, commit and push, then push a matching tag such as `v1.0.1`. The workflow waits for every platform, uploads installers and `latest*.yml` manifests into a draft release, then publishes it. Never publish a manifest without all its referenced files. Do not commit signing credentials or put GitHub tokens in the app.

## Verification

```sh
npm run test:desktop:unit
npm run test:desktop
# On a headless Linux machine:
xvfb-run -a npm run test:desktop
# Test the packaged Linux app after desktop:dist:
CAVIARD_EXECUTABLE="$PWD/release/linux-unpacked/caviard" xvfb-run -a npm run test:desktop
```

The desktop end-to-end tests launch real Electron, verify renderer isolation, redact a generated PDF, exercise native Save and cancel, inspect exported pixels and text, and check the unsaved-close guard. The updater tests cover update states, retry, download errors, and restart protection. `npm run test:update-feed` additionally tests the actual electron-updater download and SHA-512 validation against a local HTTP feed using the built Linux AppImage; it never installs over the running app.

The existing web application remains available with `npm run dev`. See `TESTING.md` for the complete PDF corpus and browser suite.

The public product name is **Inklura PDF**. The existing `com.benfavre.caviard` app ID, `caviard-pdf` package name, Linux executable, custom protocol, preload bridge, and `benfavre/caviard` release feed are deliberately retained for upgrade compatibility.

## Local assistant

Inklura PDF includes optional on-device suggestions, automatic policy previews, and natural-language redaction plans. The same WebAssembly runtime runs on each packaged platform; no Python or separately installed model server is needed. Models download separately (about 1.18 GB), remain in the app's user-data folder across updates, and are checksum-verified. See [AI.md](AI.md) for supported categories, OCR, privacy, memory expectations and real-model testing.

## Signing and notarization

The configuration uses electron-builder 26. See its [versioned signing documentation](https://www.electron.build/v26/docs/features/code-signing/).

Configure these repository Actions secrets through GitHub settings or `gh secret set`:

| Platform | Secrets |
| --- | --- |
| macOS | `CSC_LINK` (Developer ID Application certificate), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Windows | `WIN_CSC_LINK` (a certificate supported by your signing provider), `WIN_CSC_KEY_PASSWORD` |

For certificates that cannot be exported, use a supported hardware or cloud signing provider and adapt the builder's Windows signing configuration; do not try to export a hardware-protected private key. The current workflow accepts the certificate-link configuration above.

Set the Actions **variable** `INKLURA_REQUIRE_SIGNING=true` after configuring both platforms. Builds then fail when signing is missing. Configured signing always sets `forceCodeSigning`; a Mac certificate without notarization credentials is rejected. The workflow verifies Windows Authenticode signatures and both Mac applications with `codesign`, `spctl` and `stapler` before uploading artifacts. Mac automatic updates are enabled only when both signing and notarization are configured. The first signed Mac build still requires manual installation over an older unsigned build.

No signing credentials were configured during development of these changes. Configuration and unsigned packaged workflows can be tested without them; actual signatures, notarization and a signed Mac-to-Mac update require the publisher's credentials and native release checks.
