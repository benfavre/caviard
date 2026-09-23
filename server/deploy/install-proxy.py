#!/usr/bin/env python3
"""Install only the PDF API location; reload Bext configuration without restart."""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, os
vhost=Path('/etc/nginx/sites-enabled/outils.inklura.fr.bext-auto.conf')
source=vhost.read_text()
block=Path('/opt/inklura-pdf/current/server/deploy/proxy.conf').read_text()
if 'proxy_pass http://inklura_pdf_account;' in source:
 print('PDF proxy already installed');raise SystemExit(0)
marker='    location / { }'
assert source.count(marker)==1, 'Review changed vhost before integration'
backup=Path('/var/backups/inklura-pdf')
backup.mkdir(mode=0o700,parents=True,exist_ok=True)
(backup/('outils-vhost-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.conf')).write_text(source)
target=vhost.with_name(vhost.name+'.tmp-inklura')
updated=source.replace('proxy_pass http://127.0.0.1:4387;', 'proxy_pass http://inklura_pdf_account;') if 'location ^~ /api/inklura-pdf/' in source else source.replace(marker,block+'\n'+marker)
updated='upstream inklura_pdf_account { server 127.0.0.1:4387; }\n\n'+updated
target.write_text(updated);target.chmod(vhost.stat().st_mode & 0o777)
os.replace(target,vhost)
# Native nginx syntax validation also catches surrounding config drift.
check=subprocess.run(['/usr/sbin/nginx','-t'],capture_output=True,text=True)
if check.returncode:
 vhost.write_text(source)
 print('Syntax validation failed; original vhost restored.')
 print(check.stderr[-1800:]);raise SystemExit(1)
pid=subprocess.check_output(['systemctl','show','nginx','-p','MainPID','--value'],text=True).strip()
subprocess.run(['systemctl','kill','--kill-who=main','--signal=HUP','nginx'],check=True)
print('PDF proxy installed; configuration reload requested for master '+pid)
