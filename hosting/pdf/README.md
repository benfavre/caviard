# Inklura PDF website

Canonical site: https://pdf.inklura.fr/ (formerly https://outils.inklura.fr/inklura-pdf).

The dedicated PRISM site is `/home/infra-sj278/bext/sites/pdf-inklura-prism`.
Templates, local fonts, images, metadata and deployment helpers are owned here.
Shared Inklura UI imports resolve against the existing Bext `sites/shared/` tree.

## Publish a release or page update

```sh
hosting/pdf/deploy.sh 1.2.1
scp -F "$INKLURA_SSH_CONFIG" 141.95.202.2-infra-sj278:/home/infra-sj278/bext/sites/pdf-inklura-prism/src/lib/inklura-pdf-release.json hosting/pdf/site/src/lib/inklura-pdf-release.json
node hosting/pdf/verify-live.mjs
```

`INKLURA_DEPLOY_HOST` overrides the SSH alias. `INKLURA_SSH_CONFIG` overrides the
operator's project SSH configuration (default `/home/pc1/dev/infra/dashboard/ssh-config`).
No credentials belong in this repository.

Deployment backs up owned source files outside the public root, verifies GitHub
release SHA-256 digests, renders the complete page from a temporary sibling site,
and then copies the verified files into production. Existing versioned installers
cannot be replaced with different bytes. The source watcher reloads pages; no
service restart is needed. The generated release manifest must be copied back and
committed after each release.

Downloads remain versioned, now on the dedicated host:
`https://pdf.inklura.fr/downloads/inklura-pdf/1.2.1/`.
The directory includes four installers, two example ZIPs, `release.json` and
`SHA256SUMS.txt`. Previous stable versions remain accessible for rollback.

## Domain provisioning and migration

The existing Inklura wildcard DNS already points `pdf.inklura.fr` to activ-2.
Its dedicated Let's Encrypt certificate was provisioned into the existing Bext
certificate store, with PEM files under `/etc/letsencrypt/bext-managed/pdf.inklura.fr/`.

`deploy/pdf.inklura.fr.conf` mounts only the PDF site. Copy it alongside
`deploy/install-domain.py` to the server, then run that script as root using the
existing operator access. It backs up affected configurations, validates nginx
syntax and sends a configuration reload, without restarting services.

Only after the new site serves correctly:

- Copy `integrate-site.py` and `deploy/legacy-page.tsx` (preserving their relative
  paths), then run `integrate-site.py /home/infra-sj278/bext/sites/outils-inklura-prism`.
  Back up that site's home and old product route before the first integration.
- Run `install-domain.py --redirect-old`. This adds redirects for old product
  assets and downloads; the legacy PRISM page redirects the product URL itself.
- If stale routes persist, purge only the PDF and Tools hosts through the existing
  authenticated Bext cache-purge sidecar. Read its port from
  `/run/bext/cache-purge.port`; never restart the whole web server for this.

Product-page redirects run in PRISM to preserve query strings. Bext currently
leaves nginx `$is_args$args` placeholders unexpanded in return targets; do not use
those variables for this redirect. Browser fragments are retained naturally.

The account API stays at `https://outils.inklura.fr/api/inklura-pdf` for installed
clients and Stripe webhooks. It must never be redirected. Pairing remains shared
at `https://manage.inklura.fr/manage/device`. App updates still use GitHub Releases;
there is no `latest.yml` feed on the product website. Windows/Linux support
integrated updates; unsigned macOS apps update manually.

## Verification

`verify-live.mjs` verifies exact installer bytes, SHA-256, sizes and byte-range
support, permanent old-URL redirects (including query strings), robots/sitemap,
and continued API authentication. Its browser checks cover desktop/mobile,
light/dark themes, JavaScript disabled, catalog navigation, example download and
an unrelated existing tool. Use `--pages-only` after source-only changes to skip
re-downloading unchanged installers. Reports and screenshots go to
`output/hosting-verification/`.
