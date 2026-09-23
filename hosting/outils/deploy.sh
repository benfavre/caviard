#!/usr/bin/env bash
# Existing SSH access required; no service restart or global cache invalidation.
set -euo pipefail
cd "$(dirname "$0")"
HOST="${INKLURA_DEPLOY_HOST:-141.95.202.2-infra-sj278}"
SITE=/home/infra-sj278/bext/sites/outils-inklura-prism
VERSION="${1:-1.2.0}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected stable semantic version'; exit 1; }
STAGE=$(ssh -o BatchMode=yes "$HOST" 'mktemp -d /tmp/inklura-pdf-deploy.XXXXXX')
[[ "$STAGE" =~ ^/tmp/inklura-pdf-deploy\.[A-Za-z0-9]+$ ]] || exit 1
scp -q -r site mirror-release.py integrate-site.py "$HOST:$STAGE/"
ssh -o BatchMode=yes "$HOST" bash -s -- "$SITE" "$STAGE" "$VERSION" <<'REMOTE'
set -euo pipefail
SITE="$1"; STAGE="$2"; VERSION="$3"
BACKUP="$HOME/bext-site-backups/outils-inklura-pdf-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP"
cp -a "$SITE/src/app/layout.tsx" "$BACKUP/layout.tsx"
cp -a "$SITE/src/app/page.tsx" "$BACKUP/home-page.tsx"
cp -a "$SITE/src/lib/tools.ts" "$BACKUP/tools.ts"
if test -f "$SITE/.gitignore"; then cp -a "$SITE/.gitignore" "$BACKUP/.gitignore"; fi
# Back up only our owned paths, without overwriting unrelated work.
for p in src/app/inklura-pdf src/lib/inklura-pdf-release.json src/lib/inklura-pdf-preview.json public/inklura-pdf; do
  if test -e "$SITE/$p"; then mkdir -p "$BACKUP/$(dirname "$p")"; cp -a "$SITE/$p" "$BACKUP/$p"; fi
done
python3 "$STAGE/mirror-release.py" "$VERSION" "$SITE"
# Validate integration against a copy before publishing the page.
mkdir -p "$STAGE/check/src/app" "$STAGE/check/src/lib"
cp "$SITE/src/app/layout.tsx" "$STAGE/check/src/app/"
cp "$SITE/src/app/page.tsx" "$STAGE/check/src/app/"
cp "$SITE/src/lib/tools.ts" "$STAGE/check/src/lib/"
python3 "$STAGE/integrate-site.py" "$STAGE/check"
# Run the page in the PRISM runtime, from a staging site with matching JSX configuration.
cp "$SITE/tsconfig.json" "$STAGE/site/tsconfig.json"
ln -s "$SITE/node_modules" "$STAGE/site/node_modules"
cp "$SITE/src/lib/inklura-pdf-release.json" "$STAGE/site/src/lib/"
(cd "$STAGE/site" && bun -e 'const {default: Page} = await import("./src/app/inklura-pdf/page.tsx"); const html = String(Page()); if (!html.includes("Choisissez votre ordinateur") || !html.includes(".AppImage")) throw new Error("Page render failed"); console.log("PRISM render passed:", html.length, "characters");')
mkdir -p "$SITE/public/inklura-pdf" "$SITE/src/app/inklura-pdf"
cp "$STAGE/site/public/inklura-pdf/"* "$SITE/public/inklura-pdf/"
cp "$STAGE/site/src/app/inklura-pdf/page.tsx" "$SITE/src/app/inklura-pdf/page.tsx.tmp"
mv "$SITE/src/app/inklura-pdf/page.tsx.tmp" "$SITE/src/app/inklura-pdf/page.tsx"
python3 "$STAGE/integrate-site.py" "$SITE"
# live_reload watches src/app and src/lib and invalidates this site automatically.
printf '\nBackup: %s\n' "$BACKUP"
REMOTE
curl --retry 5 --retry-delay 2 --fail --silent --show-error https://outils.inklura.fr/inklura-pdf -o /tmp/inklura-pdf-live.html
python3 - <<'PY'
from pathlib import Path
html=Path('/tmp/inklura-pdf-live.html').read_text()
assert 'Choisissez votre ordinateur' in html
assert '<title>Inklura PDF' in html
assert '/downloads/inklura-pdf/' in html
print('Live download page verified: https://outils.inklura.fr/inklura-pdf')
PY
