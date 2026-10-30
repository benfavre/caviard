# Inklura PDF store release preparation

This prepares **Mac App Store** and **Microsoft Store** packages alongside the
existing direct downloads. No store submission or signed release has been made.
The public version remains 1.4.0. Do not submit the current MAS build: Apple
commerce and native sandbox acceptance below are still outstanding.

## Distribution and updates

| Edition | Package | Updates | Signing |
| --- | --- | --- | --- |
| Direct Windows | NSIS `.exe` | Existing electron-updater/GitHub feed; explicit restart protects work | Azure Artifact Signing or publisher certificate |
| Direct Mac | DMG + ZIP | Same feed, enabled only after signing and notarization | Developer ID Application + notarization |
| Microsoft Store | AppX (accepted by Partner Center) | Microsoft Store, according to the customer's update settings | Microsoft signs the submitted package |
| Mac App Store | Electron MAS `.pkg` | App Store, according to the customer's update settings | Apple Distribution + Mac Installer Distribution + matching profile |

Store editions never load `electron-updater`, download GitHub updates or expose
its restart action. Native `process.mas` / `process.windowsStore` flags take
precedence over package metadata. Store build metadata also prevents an unpacked
store executable from accidentally using the direct feed. Output directories,
artifact names and publishing settings are separate; no Store artifact enters
the direct download release workflow.

## Publisher access and decisions

Use **BEO PLUS**, not the separate Webdesign29 Apple team. Bruno was contacted on
29 October 2026 for the active membership/team, App Store Connect access,
Microsoft Partner Center status, the neighbour's OS and the Apple offer decision.
Track the private publisher-access tickets (Microsoft #1411, Apple #1410); do not copy credentials or
identity documents here. Azure identity validation alone is not a Store account.

As of 30 October, authenticated Developer access to BEO PLUS is verified through
its associated Entra tenant. The publisher profile reports an active company
account and EU Digital Services Act compliance. The name `Inklura PDF` is
available, but reservation fails for the invited Microsoft account with an Entra
application-registration permission error. No product identity has been reserved
or copied. Bruno has been asked in the private Microsoft ticket to reserve the
MSIX/PWA application using his native tenant account. Do not broaden guest or
tenant permissions to work around this error. The temporary tenant-administrator
role used for association has been removed. Apple membership is confirmed and
the team variable is configured; App Store Connect access and signing assets
remain to be verified.

### Microsoft Store

1. Use the BEO PLUS Partner Center account; reserve the product name and copy the
   exact values from **Product identity** into repository/environment variables:
   `INKLURA_WINDOWS_IDENTITY_NAME`, `INKLURA_WINDOWS_PUBLISHER` (the complete
   `CN=…` string) and `INKLURA_WINDOWS_PUBLISHER_DISPLAY_NAME`.
2. Run **Store package preparation → microsoft-store**. This builds a package for
   internal review; it does not submit it. `scripts/verify-store-appx.py` checks
   actual manifest identity, version, executable, PDF association, capabilities,
   product tiles and absence of a direct-update manifest.
3. Install a test-signed package on an isolated Windows machine or distribute a
   Partner Center private flight. Exercise launch, PDF Open With, file/folder
   import, local models, login, existing credits, purchase, export and recovery.
   Validate with the Windows App Certification Kit. Check a subsequent Store
   update retains projects, models and account credits; test coexistence with
   direct installs. Ordinary NSIS registry context menus are not part of AppX.
4. Complete the listing, screenshots, privacy/support links, age rating,
   territories, reviewer access and the `runFullTrust` explanation. The app runs
   local PDF/OCR processing and uses user-selected files. Submit only after
   installed acceptance and a verified package identity.

Use [the French listing and review draft](MICROSOFT_STORE_LISTING.fr.md) for the
submission fields. Its unresolved items must be completed before submission.

Pull requests build an unsigned **QA identity** on a Windows runner to validate
packaging. It is not reserved in Partner Center and must never be submitted.
Only its verification report is retained, not a customer installer.

### Mac App Store

1. Verify BEO PLUS membership, team ID, agreements and App Store Connect access.
   Confirm or register the existing bundle ID `com.benfavre.caviard` under that
   team and create the macOS app record. Do not use the Caisse/Inklura Pro IDs,
   profiles or another company's certificates.
2. Obtain the matching Apple Distribution and Mac Installer Distribution
   certificates and a **Mac App Store distribution** provisioning profile.
   Create a separate Apple Development/profile pair for native installed tests.
   Do not revoke existing certificates. Put exports in the existing secure
   signing storage and GitHub Actions secrets, not source files, Slack or issues.
3. Configure variable `INKLURA_APPLE_TEAM_ID` and secrets `MAS_CSC_LINK`,
   `MAS_CSC_KEY_PASSWORD`, `MAS_INSTALLER_LINK`, `MAS_INSTALLER_KEY_PASSWORD`,
   `MAS_PROFILE_BASE64`. The workflow decodes the profile only on its ephemeral
   runner. Run **Store package preparation → mac-app-store** for Intel and Apple
   Silicon packages. This does not upload or submit them. Verification checks
   certificate team/type, sandbox entitlements, embedded distribution profile,
   architectures and installer signatures. It does not claim native acceptance.
4. Complete **Apple commerce before submission**. The current MAS preparation
   preserves login/credits but removes Stripe purchase/portal controls and
   rejects their IPC calls. This is an interim safeguard, **not a complete
   commercial App Store implementation or an exemption from in-app purchase**.
   Implement StoreKit products, Apple-side transaction validation, account-bound
   idempotent credit grants, interrupted purchase recovery, refunds/revocations
   and sandbox purchase tests. Never credit an account solely from a client
   success event. Reconcile the currently deployed credit service with source
   before changing it; the working checkout has additional unmerged web billing
   changes. Existing Stripe customers and grants must retain their balances.
5. Confirm Apple offers and prices with the publisher. Proposed consumable packs
   are 100 / 500 / 1,000 PDFs **without expiration**; this has not been approved.
   Apple guideline 3.1.1 prohibits expiration of purchased credits. Review
   existing subscription entitlements under 3.1.3(b); packs alone are not proof
   that all cross-platform subscriptions qualify. Do not change live web prices
   or apply the web ledger's 12-month expiration to Apple purchases.
6. Test the real MAS development build on both architectures, including native
   open/save dialogs, Finder imports, recursive folder access, atomic export,
   cancel, crash recovery, OCR/WASM and model downloads. In particular, pending
   export reconciliation reads paths after relaunch: add/verify security-scoped
   bookmarks (and lifetime cleanup) where App Sandbox requires them. The Linux
   metadata tests do not exercise Apple's filesystem sandbox.
7. Verify in-app account deletion, privacy disclosures, sign-in/account web pages
   without inappropriate purchase links, store-compliant local model handling,
   screenshots, reviewer account, content rights and export compliance. Upload
   verified packages to the exact BEO PLUS app record, exercise TestFlight and a
   Store-delivered update, then submit the completed version for review.

## Local commands

```sh
npm ci
npm run test:desktop:unit
npm run build
xvfb-run -a npx playwright test --config playwright.desktop.config.mjs tests/desktop/store.spec.mjs
```

Windows, after setting the three real identity variables:

```sh
node scripts/store-assets.mjs
# Set INKLURA_DISTRIBUTION_CHANNEL=microsoft-store in the shell.
npx electron-builder --config electron-builder.config.cjs --win appx --x64 --publish never
python scripts/verify-store-appx.py
```

Mac, after setting the team, certificate variables and an absolute
`INKLURA_MAS_PROVISIONING_PROFILE` path:

```sh
# Set INKLURA_DISTRIBUTION_CHANNEL=mac-app-store in the shell.
npx electron-builder --config electron-builder.config.cjs --mac mas --x64 --arm64 --publish never
python3 scripts/verify-store-mas.py
```

For native development, set `INKLURA_MAS_DEVELOPMENT=true`, supply the matching
development profile/certificate, and use `--mac mas-dev`. Do not submit this build.
The ordinary release workflow still uses the default `direct` channel. Bump
versions for the eventual releases; never replace published 1.4.0 bytes.

## Evidence and remaining limits

Local validation: 59 desktop unit tests, electron-builder schema validation for
all four configurations, a production web build, and two real Electron UI/IPC
tests for Store update isolation. These tests validate metadata-driven behavior,
not an installed native Store package, approved listing, payment or Store update.
On commit `aa22cd9966f22f8aa74e582095d570a770a50c1a`, the
[native Windows QA build](https://github.com/benfavre/caviard/actions/runs/40914259673)
passed AppX manifest/content verification with the non-submittable QA identity.
The [full regression run](https://github.com/benfavre/caviard/actions/runs/40914259542)
passed 216 PDF tests, 75 browser tests, 59 desktop unit/schema tests, 15 Electron
desktop tests, 39 account-service tests and the real AppImage update-feed test.
The independent audit passed for 151 PDFs / 399 pages. Production frontend and
direct Linux AppImage builds also passed. The export-test helper now waits for
the visible dialog and fresh acknowledgement reset. Check the PR's current CI
result before merging; native installed Store acceptance is still outstanding.

## Primary references (checked 29 October 2026)

- [Electron MAS submission and sandbox](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [Apple App Review guidelines, 3.1.1 and 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- [Microsoft Store packaging, signing and updates](https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-distribute-your-win32-app-through-microsoft-store)
- [Accepted Microsoft Store package formats](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- Installed electron-builder 26 option types and manifest generator are verified
  against the repository lockfile; no dependency upgrade is part of this change.
