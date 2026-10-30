# Inklura PDF store release preparation

This prepares **Mac App Store** and **Microsoft Store** packages alongside the
existing direct downloads. Microsoft submission `1152921505702276768` was sent
for certification on 30 October 2026; Partner Center shows preprocessing in
progress and automatic publication after certification. It is not live yet.
The public version remains 1.4.0. Do not submit the current MAS build: Apple
native StoreKit acceptance, encryption compliance and review completion below are still outstanding. The corrected package was uploaded successfully on 30 October at 15:46 UTC; Apple processing is complete/VALID. TestFlight is blocked by missing encryption compliance documentation.

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
account and EU Digital Services Act compliance. Reservation failed with the
invited Microsoft account, but subsequently succeeded using Bruno's native
tenant account in a separate browser profile. **Inklura PDF** is now reserved
as Store product `9PLQZNJTGPCW`, and submission `1152921505702276768` is in certification.
No guest or tenant permissions were broadened. The temporary tenant-administrator
role used for association has been removed. Apple access is verified under **BEO PLUS / 8V54BYQURB**. The macOS record is
**6828817692**, bundle ID `com.benfavre.caviard`, SKU `inklura-pdf-macos`.
The draft is version 1.4.0; a signed package has been uploaded, but App Review has not been submitted. Apple
Distribution, Mac Installer Distribution and Apple Development certificates
were created with Ben's approval and configured in GitHub's `release` secrets.
A matching distribution profile is configured; no development device/profile
has been registered yet.

The verified Microsoft identity is configured in the GitHub `release` environment:

| Variable | Partner Center value |
| --- | --- |
| `INKLURA_WINDOWS_IDENTITY_NAME` | `BEOPLUS.InkluraPDF` |
| `INKLURA_WINDOWS_PUBLISHER` | `CN=235F0568-FD70-4528-8D32-8E37822DF41D` |
| `INKLURA_WINDOWS_PUBLISHER_DISPLAY_NAME` | `BEO PLUS` |

Package family: `BEOPLUS.InkluraPDF_cqz2xj63mf1vt`.
These are package identifiers, not signing credentials.
[Product management](https://partner.microsoft.com/fr-fr/dashboard/products/9PLQZNJTGPCW/overview)
is private to authorized publisher users. The assigned public Store URL does not
mean the application has been published.

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
   local PDF/OCR processing and uses user-selected files. The first submission
   was sent at Ben’s request with a verified package identity and Windows
   executable UI checks. Installed acceptance, WACK and a Store-delivered update
   remain unverified; the reviewer notes explicitly disclose those limits.

Use [the French listing and review draft](MICROSOFT_STORE_LISTING.fr.md) for the
submission fields, submitted status and remaining acceptance checks.

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
   runner. Run **Store package preparation → mac-app-store** for one universal
   package supporting Intel and Apple Silicon. This does not upload or submit it. Verification checks
   certificate team/type, sandbox entitlements, embedded distribution profile,
   architectures and installer signatures. It does not claim native acceptance.
4. **Apple commerce is deployed and enabled; native StoreKit acceptance remains.**
   The MAS UI uses StoreKit prices, purchases one pack with a server-issued UUID
   account token and journals successful transactions until server confirmation.
   Apple-signed transaction information is fetched and verified by Apple's
   official server library, with online certificate checks. Credit grants are
   account-bound/idempotent; refunds revoke remaining credits and hold accounts
   for review when refunded credits were used. Sandbox crediting is restricted
   to configured synthetic accounts. Stripe checkout/portal remains blocked in
   MAS. The dedicated In-App Purchase key is configured on the account server;
   production/sandbox notification URLs and an isolated Apple review account are
   configured. No Apple key exists in the app or repository. Delivery and real
   purchase acceptance are tracked below.
   The service source was reconciled against the deployed
   `20260928T114238Z-1105-receipt` release before these additive changes, preserving
   web checkout, receipt claims, annual quotas, promotions and invoicing.
5. Ben approved three consumable packs **without expiration**, available in
   France only. App Store Connect references and French localizations are saved:

   | PDF exports | Product ID suffix | Apple ID | French TTC price |
   | --- | --- | --- | --- |
   | 100 | `credits100` | `6828820002` | €34.90 |
   | 500 | `credits500` | `6828822382` | €118.99 |
   | 1,000 | `credits1000` | `6828823455` | €178.99 |

   IDs begin with `com.benfavre.caviard.`. These are the closest available Apple
   tiers to €34.80 / €118.80 / €178.80. StoreKit supplies the displayed price;
   none is hard-coded as a charge amount. Existing web offers are unchanged.
   IAP review screenshots and real sandbox acceptance remain outstanding. Review
   cross-platform subscription entitlements under guideline 3.1.3(b) as well.
6. Native MAS acceptance remains required on Bruno's Mac. Selected file/folder
   bookmarks now cover deferred imports, atomic exports and pending-credit
   reconciliation after relaunch, with balanced access cleanup. Single MAS
   export selects a directory to authorize both the target and sibling temporary
   file; overwrite requires confirmation. Missing/revoked recovery access retains
   the hold instead of assuming that no file was saved. Test real open/save,
   Finder imports, recursive folders, cancellation, recovery, OCR/WASM and model
   downloads on Intel and Apple Silicon. Linux tests do not exercise App Sandbox.
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
npx electron-builder --config electron-builder.config.cjs --mac mas --universal --publish never
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

The [first real BEO PLUS Windows package build](https://github.com/benfavre/caviard/actions/runs/41039014119)
passed on `a94ff0fa9703c4324df97c3d0a755fd3bed1d1cc`. Its AppX is version
`1.4.0.0`, x64, with the publisher identity above. The downloaded artifact's
SHA-256 was independently checked against the workflow report:
`d60a72e53bb3064ac3eb2605df9d3632b7800892e32af7a90ae40b58e70d8512`.
This is the submitted build, not evidence of installed Windows acceptance,
Microsoft certification approval or a published Store release.
It has been uploaded and saved in submission `1152921505702276768`: Partner
Center reports **Validated** and the Packages section is complete. Windows
Desktop is selected; other current/future device families are not enabled.
The portal warns that `runFullTrust` requires approval during certification.
Its technical justification is saved in the submission options. Publication
is set to start automatically after certification; capability approval is pending.
The French description, short description and first feature are saved. Properties
and pricing/availability now report **Complete** in Partner Center: Productivity,
8 GB recommended RAM, external purchases and generative-AI functionality declared,
OneDrive automatic app-data backup disabled, existing BEO PLUS support contacts,
and the product-specific text in `STORE_PRIVACY.fr.txt`. This text supplements the
existing BEO PLUS privacy policy linked by the product website; it is stored
directly in the draft, not published as a new website page. The draft offers a
free download in France only, with future markets disabled. Paid export credits
remain managed by the existing service; no live billing changes were made.
The publisher completed IARC acceptance; Age rating is complete (PEGI 3 /
in-app purchases). The app offers no media catalog or user-to-user sharing.
Three real 1600×1000 Windows screenshots, French captions and keywords are saved.
[Capture run 41046267285](https://github.com/benfavre/caviard/actions/runs/41046267285)
launches the unchanged executable extracted from the pinned submitted AppX,
imports a synthetic PDF, searches contact values and verifies three redactions.
It does not install the package or simulate Store delivery.

A dedicated synthetic certification account has 20 export credits, no customer
data and no administration rights. Password login, device confirmation/token
exchange, account balance and credit reserve/release passed against the deployed
service. No actual PDF export or payment was performed by this service test.
Ben explicitly authorized transmitting its credentials to Microsoft; they are
saved only in the private certification credentials section, not this repository.
Detailed reviewer instructions and the test limitations are saved there too.

On 30 October 2026 all six submission sections were complete. After submission,
Partner Center showed **En cours de certification**, with Envoi complete,
Prétraitement in progress and publication scheduled automatically after approval.
No certification approval or live Store availability has yet been verified.
[Full regression](https://github.com/benfavre/caviard/actions/runs/41046166785)
and [Windows QA](https://github.com/benfavre/caviard/actions/runs/41046166793)
pass on `f0552c8`; later documentation changes do not replace the submitted bytes.

### Windows test handoff

Ben identified Bruno's Windows PC for native acceptance. Workflow dispatch
`microsoft-store-test` downloads the exact verified artifact from run
`41039014119`, requires its pinned SHA-256, and signs a copy using a non-exportable
14-day test certificate on an ephemeral Windows runner. No private key is
exported; the job deletes it after verifying the signature and unchanged payload.
The public certificate, AppX, certificate thumbprint, verification report and
French instructions are packaged as `Inklura-PDF-Windows-TEST-ONLY`.

[Test-kit run 41042030216](https://github.com/benfavre/caviard/actions/runs/41042030216)
passed signing and payload verification. Only signature metadata and the Windows
code-integrity catalog are added. The original upload is untouched. This is
not an installation test or a public release. The PC owner explicitly installs
the public leaf certificate into Trusted People (never Trusted Root), installs
the AppX, and reports launch success/error in Microsoft ticket #1411. The
instructions include certificate removal and warn about local data when
uninstalling the temporary test package. See `WINDOWS_TEST.fr.txt`.

Real Windows executable screenshots are now supplied. Run WACK and complete
installed acceptance on Bruno’s PC. A separate
Store-delivered first version and subsequent version are required to validate
actual Store updates; sideloading this kit cannot prove that behavior. Test
artifacts expire after 14 days and must not be offered as customer downloads.

## Primary references (checked 29 October 2026)

- [Electron MAS submission and sandbox](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [Apple App Review guidelines, 3.1.1 and 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- [Microsoft Store packaging, signing and updates](https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-distribute-your-win32-app-through-microsoft-store)
- [Accepted Microsoft Store package formats](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- Installed electron-builder 26 option types and manifest generator are verified
  against the repository lockfile; no dependency upgrade is part of this change.

## Apple signing and purchase evidence (30 October 2026)

[Signed MAS pipeline](https://github.com/benfavre/caviard/actions/runs/41049587354)
passed on `5de9e5c`: strict code signatures, distribution identity/team, sandbox,
embedded profile, both architectures and installer signatures. These artifacts
predate the StoreKit and bookmark changes and **must not be submitted**.
The [signed implementation build](https://github.com/benfavre/caviard/actions/runs/41051397229)
passed on `5757c6d`, including the app-scoped bookmark entitlement. This proves
packaging/signatures, not native installed acceptance or payment functionality.
The dedicated ephemeral signing keychain avoids electron-builder 26.15.3's wrong
password during certificate import; keys are removed with the runner keychain.

Current local checks: 76 account-service tests, 70 desktop unit tests and six
account/commerce browser tests pass. Full regression on `33ba8a3` passed in
[41074273817](https://github.com/benfavre/caviard/actions/runs/41074273817).
Provider/native adapters are simulated in payment fault tests; no real Apple
payment or credit grant is claimed. Server purchases are enabled with sandbox
credits restricted to the isolated Apple test account.

Bruno confirmed the updated Developer agreement was signed for BEO PLUS in
[Apple ticket #1410](https://github.com/webdesign29/activ/issues/1410#issuecomment-6521850408).
EU trader-status setup and the Paid Applications agreement remain to verify.
Benjamin is an App Manager; Bruno created the In-App Purchase key and supplied
it and the Issuer ID privately in Slack. Sandbox authentication is verified;
production configuration is deployed; purchase acceptance remains pending (details below).
The existing minute-based ticket watcher is active with no expiry; it watches
GitHub tickets, not Slack. Native installation, StoreKit sandbox purchases/refunds,
build processing, encryption compliance and submission remain. Privacy labels are published and reviewer
credentials are saved with Ben’s explicit authorization. PDF-only deletion is implemented and verified below.

### Apple listing progress — 30 October, afternoon

The macOS download is configured at **€0**, base country France. Availability is
**France only**, effective after approval/publication, with future countries not
automatically enabled. Consumable packs remain separate. This does not mean the
app is submitted or live.

App Privacy is **published with Ben’s explicit authorization** for name, email, user ID,
purchase history, product interaction and other diagnostics (technical server
logs). All six are declared linked to the user, for app functionality, without
advertising tracking. Raw IP addresses are not claimed anonymous. No document
content is declared: PDF contents/paths never enter the account API. The
[product-specific notice](https://outils.inklura.fr/api/inklura-pdf/privacy) is
published from `server/privacy.fr.txt` and saved as the policy URL in App Store
Connect. It covers PDF-only deletion, shared identity, 30-day rolling backups,
21 daily rotated access-log archives, financial retention and service providers.
Ben explicitly authorized Apple's accuracy/legal attestation and the separate
review-account credential disclosure on 30 October. Publication is confirmed
by App Store Connect; the private reviewer credentials persist after reload.

Do not use `https://www.inklura.fr/privacy` as the definitive publisher notice
without correction: the live page names “Inklura SAS”, a Paris address and an
ISO 27001 certification not substantiated by this release dossier. No edit to that
shared website or company-wide legal policy has been made here.

Three 1440×900 French screenshots were captured from the real packaged macOS
Electron UI on Apple Silicon in run
[41054372488](https://github.com/benfavre/caviard/actions/runs/41054372488), commit
`2738a29a3383ba9e9f619a9d9e544649eb6d57b2`. Synthetic PDF, real import/search/redaction/
review interactions, no account mocks or bitmap scaling. A viewport override is
needed because GitHub's Mac desktop constrains native windows to 1024px. The
ad-hoc UI package uses App Store channel metadata but standard Electron, not the
MAS runtime; **this is not evidence of App Sandbox, StoreKit, export or installed
acceptance**. Only screenshots and provenance are retained, never this UI-only
app. The three screenshots are uploaded to the French version draft, in order:
redaction/review, search, original document. App Store Connect shows 3 of 10.

Reviewer workflow notes and explanations for `network.client` and
`files.user-selected.read-write` are saved. Notes confirm the private reviewer credentials and retain the pending
sandbox purchase tests; those notes must be refreshed before submission now that upload succeeded. The account
creation identity is shared with other Inklura products; account deletion must
not silently remove those products or global workspace membership. Ben approved
deleting the PDF account while preserving the user's other Inklura products and
shared identity. The implementation is deployed: erasure is queued durably,
freezes new use immediately, drains in-flight checkouts, expires PDF checkouts,
cancels only verified PDF subscriptions, removes export/profile data and retains
financial records. A digest prevents stale JWTs or the web bridge recreating
the account. Failed provider operations retry every minute and on restart.
A disposable synthetic account passed live password login/device pairing,
reserve/release, deletion, stale-JWT refusal and preserved shared-identity login
on 30 October at 14:37 UTC. No customer account was deleted.

Bruno confirmed **“clé prête”** in
[Apple comment 6522739655](https://github.com/webdesign29/activ/issues/1410#issuecomment-6522739655).
Bruno subsequently supplied the `.p8` and Issuer ID in the authorized private
Slack DM. The matching downloaded key was moved out of Downloads into local
protected storage outside the repository (directory 0700, files 0600). OpenSSL
validated its format. On 30 October at 12:30 UTC, the official Apple server
library authenticated to Sandbox and read notification history successfully
(zero notifications). The same read against Production returned HTTP 401:
production authentication and real purchases are not yet validated. No purchase
or test notification was created by this check.

[Receipt was acknowledged in Slack](https://activ-comm.slack.com/archives/D8G01PS3B/p1793363473572799).
No further key handoff is required from Bruno. No key content is posted to GitHub,
bundled in the app. The key is deployed root-owned and service-group-readable
(0640) under `/etc/inklura-pdf/apple-iap/`, inside directories 0750. The plaintext
staging copy was removed. This key does not provide build-upload authentication.


### Deployed service and universal package — 30 October

The live release is `/opt/inklura-pdf/releases/20261030-ca01a7f-privacy` on activ-2.
The previous production source hashes matched the reconciled billing baseline.
Dependency installation reported no vulnerabilities; all 76 server tests passed
on the target host. Verified SQLite backups ran before and after activation.
Only `inklura-pdf.service` was restarted; existing web/Stripe payments remain
active. Environment rollback copies are root-only under
`/var/backups/inklura-pdf-deploy/20261030-058c15d`. **Do not restore the pre-deletion
code after an erasure request:** it cannot enforce the new identity tombstones.
The privacy-only change can roll back to `20261030-058c15d-apple` safely.

The isolated Apple review account has 20 trial exports and no admin grants or
customer data. Live login, device confirmation/token exchange, reserve/release
and Apple account-token binding passed at 14:35 UTC. Ben authorized disclosure to Apple; credentials are saved only in App Store
Connect’s private review fields and protected storage, never in this repository.

[Corrected universal signed build 41082263707](https://github.com/benfavre/caviard/actions/runs/41082263707)
passed on `cb5cdb3`: one MAS installer containing arm64 and x86_64, strict code
signatures, sandbox/profile and installer-signature checks. Package SHA-256:
`2955e874fe75fcb27ba37f56ec886eccfe16e979db85ff9d9eea28d9d470e023`.
The downloaded artifact independently matches that digest. This package includes
StoreKit, privacy and PDF-only deletion. Apple online validation succeeded in
[41082769616](https://github.com/benfavre/caviard/actions/runs/41082769616).
The earlier package from 41074259179 was rejected by Apple with 90255 (root-only
file permissions) and 90236 (missing 512pt @2x icon); do not use it. The public
embedded provisioning profile is now readable, and the existing vector icon is
rendered at 1024px for MAS. Verification rejects inaccessible bundle files and
ICNS files without the `ic10` representation. No private key was made public.
Full regression on delivery commit `785bc9f` passed in
[41082779669](https://github.com/benfavre/caviard/actions/runs/41082779669).

Both Apple notification URLs are saved as
`https://outils.inklura.fr/api/inklura-pdf/v1/apple/notifications`. After sandbox metadata propagation, Apple’s
request-test-notification succeeded. At 14:57 UTC, the official API reported
`sendAttemptResult: SUCCESS` for the test callback, confirming real Apple delivery
and server acceptance. This does not validate a purchase, refund or credit grant.

Bruno enabled individual API-key access, confirmed in
[comment 6526245338](https://github.com/webdesign29/activ/issues/1410#issuecomment-6526245338).
Ben explicitly authorized creation and protected local/GitHub release storage.
The individual key is in protected local storage (0700 directory, 0600 files)
and the GitHub release environment secret. Its source was moved out of Downloads.
OpenSSL validation passed. A scoped read of app 6828817692 returned HTTP 200 with
bundle `com.benfavre.caviard` at 15:27 UTC, confirming the correct Apple app.
No private-key contents are committed or posted to the ticket.

The explicit dispatch channels `mac-app-store-inspect-upload`,
`mac-app-store-validate` and `mac-app-store-upload` download the exact artifact
from run 41082263707. `scripts/upload-store-mas.mjs` checks its pinned SHA-256,
verification report and installer signature. Inspection does not read secrets;
verify/upload use `MAS_ASC_KEY_ID` and `MAS_ASC_PRIVATE_KEY` in the release
environment. Current Xcode `altool` uses an individual-key authentication file
inside a temporary 0700 directory; the 0600 file is removed in a finally block.
The private key is excluded from the child environment; private-key/token output
is redacted and raw logs are not uploaded as artifacts. Upload does not submit
App Review or prove processing.
[Upload 41083245301](https://github.com/benfavre/caviard/actions/runs/41083245301)
completed successfully at 15:46 UTC with delivery UUID
`52cfce15-0e75-4ede-b243-2ee78eda80bd`. Apple accepted the 270,780,306-byte transfer
without errors. Processing and TestFlight availability are separate; the builds
API still returned no builds at 15:50 UTC. The upload-status API now confirms
`COMPLETE` and the builds API reports `VALID` for version 1.4.0 / build 1.4.56,
with no errors or warnings. macOS 13.0 is the minimum. TestFlight shows missing
compliance information; standard embedded encryption plus France leads to an
explicit requirement to upload documents and obtain Apple approval. Do not
send a duplicate upload.

The internal group “Validation interne — Bruno” is created with automatic
build distribution disabled; no testers or builds have been added yet. French
beta description, feedback address and privacy URL are saved. Native
acceptance instructions are in [MAC_TEST.fr.txt](MAC_TEST.fr.txt). No invitation,
installed acceptance, StoreKit payment or App Store update is claimed.

The encryption-document questionnaire was inspected without saving a declaration.
For standard encryption outside Apple's OS and distribution in France, it asks
for the French cryptology declaration. PDF.js embeds AES/RC4 implementations and
Electron includes its own network runtime; do not declare OS-only encryption.
The technical preparation and primary sources are in
[APPLE_ENCRYPTION.fr.txt](APPLE_ENCRYPTION.fr.txt). No exemption, ANSSI filing or
approved compliance code is established. No legal declaration was submitted.

EU trader status is also still flagged by App Store Connect; Paid Applications
agreement status must be verified by the account holder. The uploaded package
has not been submitted to App Review, and no public availability is claimed.

A separate local `inklura-apple-processing.timer` checks this exact delivery every
2 minutes and queues the existing conversation once the status leaves PROCESSING,
then stops itself. Its first live check succeeded at 15:52 UTC. It stores no token
or key in logs; the fixed read uses a 120-second individual-key JWT. The existing
minute-based Bruno ticket watcher remains independent and active indefinitely.
Bruno was asked whether BEO PLUS already has a declaration covering this product
in [comment 6527045892](https://github.com/webdesign29/activ/issues/1410#issuecomment-6527045892).

Bruno confirmed no existing Inklura PDF declaration in comment 6527070713.
Draft commercial/technical brochures and field-by-field preparation are in
`docs/apple-encryption/`. The official March 2026 ANSSI guide requires the
declarant’s signed attestation; no declaration or signed attestation has been
submitted. Comment 6527142897 asks Bruno to open and share an ANSSI draft so the
technical fields can be completed by Ben. Company data, signatory/manufacturer
identity and native MAS TLS inventory remain to verify before signing.

The TestFlight build questionnaire was inspected on 30 October at 16:01 UTC.
It explicitly requires approved encryption documents for the actual standard
embedded algorithms and France distribution; it does not offer a testing bypass.
The questionnaire was not submitted. No tester invitation has been sent.

### ANSSI shared draft and macOS crypto inventory (30 October)

Draft 35079529 is accessible to Ben as an invited editor. Technical descriptions,
11 algorithm rows and the commercial/technical brochures are saved. The portal's
completeness check reports 11 remaining fields: business phone, administrative
contact details, technical-contact designation, market date, manufacturer status
and the signed attestation. Company presentation and a recent Kbis are additionally
required if this is BEO PLUS's first ANSSI declaration. Only owner Bruno can submit.

Run 41089292464 inspects the exact package from 41082263707 without uploading it.
The distribution binary cannot run directly off-Store; an ad-hoc-signed temporary
copy of its macOS arm64 runtime produced eight verified TLS handshakes. The original
signature and package hash remain intact. Results include TLS 1.2/1.3, AES-128-GCM,
X25519 and hybrid X25519MLKEM768, EC P-256 and RSA-2048 server keys. This is runtime
inventory, not installed MAS sandbox/StoreKit acceptance. Evidence and updated,
visually reviewed brochures are in `docs/apple-encryption/`.

Bruno's comment 6533114444 confirms manufacturer BEO PLUS and a proposed market
date of 1 November 2026; both are persisted in the draft. Updated revision-2
brochures explicitly qualify that date as provisional, subject to ANSSI and
Apple validations. They supersede the earlier attachments without deleting them.
The portal now reports only the signed attestation as a missing mandatory field;
conditional first-declaration company documents remain absent. No filing yet.

After comment 6533489853, the Kbis supplied by Bruno is attached to draft 35079529
and is dated 2 October 2026 (within three months). A one-page company presentation
using only its public company details has been prepared, visually reviewed and
attached. The original Kbis remains outside the repository. The signed official
attestation is still missing; Bruno must review, sign and attach it before filing.
