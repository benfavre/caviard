#!/usr/bin/env python3
"""Root-only, backed-up vhost setup; no service restart, no API redirects.
Run without flags to mount the verified PDF site. After HTTPS verification,
run with --redirect-old to cut over the old product/download paths.
"""
from pathlib import Path
from datetime import datetime, timezone
import os, subprocess, sys
source=Path(__file__).with_name('pdf.inklura.fr.conf').read_text()
new=Path('/etc/nginx/sites-enabled/pdf.inklura.fr')
old=Path('/etc/nginx/sites-enabled/outils.inklura.fr.bext-auto.conf')
changes={}
if new.exists():
    assert new.read_text()==source, 'Existing PDF vhost differs; review before changing it'
else:
    changes[new]=source
if '--redirect-old' in sys.argv:
    current=old.read_text();marker='    location / { }'
    block='''    # Dedicated PDF site: preserve old public links, never redirect the API.
    location = /inklura-pdf/page.css { return 301 https://pdf.inklura.fr$request_uri; }
    location = /inklura-pdf/assistant-v1.2.0.png { return 301 https://pdf.inklura.fr$request_uri; }
    location = /inklura-pdf/assistant-v1.1.0.png { return 301 https://pdf.inklura.fr$request_uri; }
    location ^~ /downloads/inklura-pdf/ { return 301 https://pdf.inklura.fr$request_uri; }

'''
    assert 'proxy_pass http://inklura_pdf_account;' in current, 'Existing credit API must remain'
    if '# Dedicated PDF site:' not in current:
        assert current.count(marker)==1, 'Tools vhost changed; review before integration'
        changes[old]=current.replace(marker,block+marker)
if not changes:
    print('Domain configuration already matches');sys.exit(0)
backup=Path('/var/backups/inklura-pdf')/('domain-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True,mode=0o700)
previous={p:p.read_text() if p.exists() else None for p in changes}
for path,content in changes.items():
    if previous[path] is not None: (backup/path.name).write_text(previous[path])
    temp=backup/(path.name+'.new');temp.write_text(content);temp.chmod(0o644);os.replace(temp,path)
check=subprocess.run(['/usr/sbin/nginx','-t'],capture_output=True,text=True)
if check.returncode:
    for path,value in previous.items():
        if value is None:path.unlink()
        else:path.write_text(value)
    raise SystemExit('Vhost validation failed; changes rolled back: '+check.stderr[-1800:])
subprocess.run(['systemctl','kill','--kill-who=main','--signal=HUP','nginx'],check=True)
print('Validated configuration reloaded without restart. Backup:',backup)
