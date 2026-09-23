import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readdir, stat, unlink, chmod } from 'node:fs/promises';
import path from 'node:path';
const source = process.env.INKLURA_PDF_DATABASE;
if (!source) throw new Error('INKLURA_PDF_DATABASE is required');
const directory = path.join(path.dirname(source), 'backups');
await mkdir(directory, {recursive:true,mode:0o700});
const filename = path.join(directory, 'inklura-pdf-' + new Date().toISOString().replaceAll(':','-') + '.sqlite');
const db = new DatabaseSync(source, {readOnly:true});
await backup(db, filename); db.close();
// Make the backup self-contained, with no WAL/SHM sidecars needed to restore.
const check = new DatabaseSync(filename);
check.exec('PRAGMA journal_mode=DELETE');
if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Backup integrity check failed');
check.close();
await chmod(filename, 0o600);
for (const name of await readdir(directory)) {
 if (!/^inklura-pdf-\d{4}-.*\.sqlite$/.test(name)) continue;
 const p=path.join(directory,name);
 if ((await stat(p)).mtimeMs < Date.now()-30*86400000) await unlink(p);
}
console.log('Account database backup verified');
