#!/usr/bin/env bash
# Run as root with one unpacked staging directory; does not modify the front proxy.
set -euo pipefail
STAGE="${1:?staging directory required}"
[[ "$STAGE" == /home/infra-sj278/inklura-pdf-stage-* ]] || exit 2
[ -f "$STAGE/server/package-lock.json" ] || exit 2
/usr/local/bin/node --input-type=module -e 'import { backup } from "node:sqlite"; if(typeof backup!=="function")process.exit(1)'
id inklura-pdf >/dev/null 2>&1 || useradd --system --home-dir /var/lib/inklura-pdf --no-create-home --shell /usr/sbin/nologin inklura-pdf
RELEASE="/opt/inklura-pdf/releases/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 755 "$RELEASE" /opt/inklura-pdf/releases
cp -a "$STAGE/server" "$STAGE/electron" "$RELEASE/"
chown -R root:root "$RELEASE"
chmod -R go-w "$RELEASE"
if [ ! -f /etc/inklura-pdf.env ]; then
  install -m 600 /dev/null /etc/inklura-pdf.env
  cat > /etc/inklura-pdf.env <<'CONFIG'
INKLURA_PDF_OIDC_CLIENT_ID=inklura-pdf-desktop
INKLURA_PDF_API_URL=https://outils.inklura.fr/api/inklura-pdf
INKLURA_PDF_PORT=4387
INKLURA_PDF_DATABASE=/var/lib/inklura-pdf/inklura-pdf.sqlite
INKLURA_PDF_PAYMENTS_ENABLED=false
INKLURA_PDF_ALLOW_LIVE_PAYMENTS=false
CONFIG
fi
ln -s "$RELEASE" /opt/inklura-pdf/current.next
mv -Tf /opt/inklura-pdf/current.next /opt/inklura-pdf/current
install -m 644 "$RELEASE/server/deploy/inklura-pdf.service" "$RELEASE/server/deploy/inklura-pdf-backup.service" "$RELEASE/server/deploy/inklura-pdf-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable inklura-pdf.service inklura-pdf-backup.timer
systemctl restart inklura-pdf.service
systemctl start inklura-pdf-backup.timer
for i in {1..15}; do
 if curl --fail --silent http://127.0.0.1:4387/api/inklura-pdf/health; then break; fi
 sleep 1
done
curl --fail --silent http://127.0.0.1:4387/api/inklura-pdf/v1/config
systemctl start inklura-pdf-backup.service
systemctl is-active inklura-pdf.service inklura-pdf-backup.timer
