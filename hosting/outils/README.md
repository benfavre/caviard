# Inklura PDF download site

Live page: https://outils.inklura.fr/inklura-pdf

The existing `outils-inklura-prism` site serves the page and actual installer files
from its `public/` directory. The existing tools catalog includes Inklura PDF.
No new server process, account, DNS record or reverse proxy is required.

## Publish a released version

From the application repository, with the existing operator SSH access:

```sh
hosting/outils/deploy.sh 1.2.1
node hosting/outils/verify-live.mjs
```

The default SSH alias is `141.95.202.2-infra-sj278`; override it with
`INKLURA_DEPLOY_HOST` when necessary. No credential is stored in this repository.

The deployment:

1. Saves the affected site files outside the public root under
   `~/bext-site-backups/outils-inklura-pdf-<timestamp>`.
2. Fetches the **published stable GitHub release**, verifies each installer's and
   example ZIP's size and SHA-256 against the release API, then atomically exposes
   the versioned directory. Existing versioned binaries cannot be overwritten
   with different bytes.
3. Renders the page with the site's PRISM runtime in a staging directory.
4. Publishes its CSS, screenshot and page; integrates one catalog entry and
   page-specific metadata using guarded, idempotent edits.
5. Lets the site's existing source watcher invalidate the site. No global cache
   purge or service restart is performed. The administrative purge endpoint
   requires a sidecar capability and is unnecessary for these watched sources.

Installers and checksums live at:

```text
/downloads/inklura-pdf/1.2.1/Inklura-PDF-1.2.1-win-x64.exe
/downloads/inklura-pdf/1.2.1/Inklura-PDF-1.2.1-mac-arm64.dmg
/downloads/inklura-pdf/1.2.1/Inklura-PDF-1.2.1-mac-x64.dmg
/downloads/inklura-pdf/1.2.1/Inklura-PDF-1.2.1-linux-x86_64.AppImage
/downloads/inklura-pdf/1.2.1/example-pdfs.zip
/downloads/inklura-pdf/1.2.1/inklura-ai-example-pdfs.zip
/downloads/inklura-pdf/1.2.1/SHA256SUMS.txt
/downloads/inklura-pdf/1.2.1/release.json
```

The page uses a generated release manifest for links and file sizes. For a later
release, review the page's feature, signing and example-count copy, deploy with
its version, then copy the generated manifest from the remote
`src/lib/inklura-pdf-release.json` into `site/src/lib/inklura-pdf-release.json`
before running verification and committing. Publishing a GitHub release does
not by itself deploy the website; run the deployment command for each release.

Application automatic updates continue to use the existing GitHub release feed.
Windows and Linux retain their integrated updater. macOS updates remain manual
until Developer ID signing is configured. The optional AI models are downloaded
by the application separately; they are not bundled with these installers.

## Stable release and retired downloads

The stable 1.2.1 release is the public download and update channel. Retired evaluation installers are archived privately outside the web root; their GitHub releases are drafts. Earlier stable releases remain available for rollback. Previously installed copies cannot be revoked remotely.

## Verification

`verify-live.mjs` fetches each file fully and verifies its exact size/hash,
checks HTTP byte ranges for download resumption, then exercises the page in
Chromium at desktop/mobile sizes, light/dark themes and with JavaScript disabled.
It checks the catalog search and a pre-existing PDF tool. Reports and screenshots
are written under `output/hosting-verification/` (not committed).

For page-only edits, use `node hosting/outils/verify-live.mjs --pages-only` to
check the browser behavior without downloading the unchanged installers again.
It still checks a real example ZIP download through the browser.

No installers are executed by this verification. The release's existing desktop
CI covers installation/application behavior.
