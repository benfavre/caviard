# Desktop application

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

## Automatic updates

`electron-updater` reads the release feed packaged by electron-builder for `benfavre/caviard`. Installed apps check after 15 seconds and every four hours, or when the user clicks the update button. Updates download automatically. Installation requires **Redémarrer et installer** and is blocked while documents are being processed or redactions have not been exported. Closing the app never silently installs an update.

PDFs are processed locally. Only update metadata and application binaries are fetched from GitHub. The renderer has no Node access and uses a sandboxed preload exposing narrowly scoped operations. Saving uses the OS file dialog and a temporary file followed by rename.

The first builds are unsigned. Windows and Linux updates are enabled. **Unsigned macOS builds cannot self-update**; their UI directs users to GitHub. To enable signed macOS updates, configure repository Actions secrets `CSC_LINK` (base64 Developer ID Application .p12 certificate) and `CSC_KEY_PASSWORD`. For notarization also set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. The builder imports and signs with that certificate and enables Mac updates in the resulting package. Existing unsigned Mac installations must be replaced manually with the first signed build. Signed update installation has not been validated without these credentials.

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
