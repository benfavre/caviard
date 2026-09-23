import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, writeFile, utimes, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Ledger } from '../ledger.mjs';

test('online backup includes committed WAL credits and holds, restores independently, and prunes only old owned backups', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'inklura-backup-'));
  const filename = path.join(directory, 'account.sqlite');
  const ledger = new Ledger(filename);
  try {
    const account = ledger.account('https://auth.1clic.pro', 'backup-fixture');
    ledger.reserve(account.id, 'held-export-12345678');
    const backups = path.join(directory, 'backups');
    await mkdir(backups);
    const oldOwned = 'inklura-pdf-2020-01-01T00-00-00.000Z.sqlite';
    for (const name of [oldOwned, 'unrelated.sqlite']) {
      const file = path.join(backups, name); await writeFile(file, 'fixture');
      await utimes(file, new Date('2020-01-01'), new Date('2020-01-01'));
    }
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../backup.mjs', import.meta.url))], {
      env: { ...process.env, INKLURA_PDF_DATABASE: filename },
    });
    const files = await readdir(backups);
    assert.equal(files.includes(oldOwned), false);
    assert.equal(files.includes('unrelated.sqlite'), true);
    const saved = files.filter(name => name.startsWith('inklura-pdf-'));
    assert.equal(saved.length, 1);
    const restored = new Ledger(path.join(backups, saved[0]));
    try {
      assert.deepEqual(restored.balance(account.id), ledger.balance(account.id));
      restored.transition(account.id, 'held-export-12345678', 'release');
      assert.equal(restored.balance(account.id).remaining, 20);
      assert.equal(ledger.balance(account.id).remaining, 19, 'restoration never mutates source');
    } finally { restored.close(); }
  } finally { ledger.close(); await rm(directory, { recursive: true, force: true }); }
});
