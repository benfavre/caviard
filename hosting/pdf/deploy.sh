#!/usr/bin/env bash
# Deploy the dedicated PDF site without replacing the tools catalog or API.
set -euo pipefail
cd "$(dirname "$0")"
HOST="${INKLURA_DEPLOY_HOST:-141.95.202.2-infra-sj278}"
SSH_CONFIG="${INKLURA_SSH_CONFIG:-/home/pc1/dev/infra/dashboard/ssh-config}"
SSH=(ssh -F "$SSH_CONFIG" -o BatchMode=yes)
SITE=/home/infra-sj278/bext/sites/pdf-inklura-prism
VERSION="${1:-1.2.1}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
STAGE=$("${SSH[@]}" "$HOST" 'mktemp -d /tmp/inklura-pdf-deploy.XXXXXX')
[[ "$STAGE" =~ ^/tmp/inklura-pdf-deploy\.[A-Za-z0-9]+$ ]] || exit 2
scp -q -F "$SSH_CONFIG" -r site mirror-release.py "$HOST:$STAGE/"
"${SSH[@]}" "$HOST" bash -s -- "$SITE" "$STAGE" "$VERSION" <<'REMOTE'
set -euo pipefail
SITE="$1"; STAGE="$2"; VERSION="$3"
BACKUP="$HOME/bext-site-backups/pdf-inklura-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP" "$SITE"
for p in src public/inklura-pdf public/robots.txt public/sitemap.xml bext.config.toml package.json tsconfig.json; do
 if test -e "$SITE/$p"; then mkdir -p "$BACKUP/$(dirname "$p")"; cp -a "$SITE/$p" "$BACKUP/$p"; fi
done
# Render from a temporary sibling so shared PRISM imports resolve before publishing.
CHECK=$(mktemp -d /home/infra-sj278/bext/sites/.pdf-deploy-check.XXXXXX)
trap 'rm -rf "$CHECK"' EXIT
cp -a "$STAGE/site/." "$CHECK/"
ln -s ../outils-inklura-prism/node_modules "$CHECK/node_modules"
if test -d "$SITE/public/downloads"; then
 mkdir -p "$CHECK/public/downloads"
 cp -al "$SITE/public/downloads/." "$CHECK/public/downloads/"
fi
python3 "$STAGE/mirror-release.py" "$VERSION" "$CHECK"
(cd "$CHECK" && bun -e 'const Page=(await import("./src/app/page.tsx")).default; const Layout=(await import("./src/app/layout.tsx")).default; const html=String(Layout({children:Page()})); if(!html.includes("Choisissez votre ordinateur")||!html.includes("https://pdf.inklura.fr/"))throw Error("PDF render failed"); console.log("PRISM render passed",html.length);')
if ! test -e "$SITE/node_modules"; then ln -s ../outils-inklura-prism/node_modules "$SITE/node_modules"; fi
# Only source and immutable verified files are copied; never generated .bext caches.
rsync -a --exclude=node_modules --exclude=.bext "$CHECK/" "$SITE/"
touch "$SITE/src/app/page.tsx" "$SITE/src/app/layout.tsx"
printf 'Backup: %s\n' "$BACKUP"
REMOTE
