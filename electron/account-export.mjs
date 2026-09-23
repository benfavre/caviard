import { readFile, writeFile, rename, unlink, mkdir, access } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
// PDF paths/hashes remain local. The server only receives a random operation ID.
export class AccountExports {
  constructor({ directory, account, io = { readFile, writeFile, rename, unlink, mkdir } }) {
    Object.assign(this, { directory, account, io }); this.queue = Promise.resolve();
  }
  exclusive(fn) { const next = this.queue.then(fn); this.queue = next.catch(() => {}); return next; }
  async entries() {
    try { return JSON.parse(await this.io.readFile(path.join(this.directory, 'pending.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  async journal(entries) {
    await this.io.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const tmp = path.join(this.directory, 'pending-' + randomUUID() + '.tmp');
    await this.io.writeFile(tmp, JSON.stringify(entries), { mode: 0o600, flag: 'wx' });
    await this.io.rename(tmp, path.join(this.directory, 'pending.json'));
  }
  async reconcileUnlocked() {
    const owner = this.account.account?.accountId;
    if (!owner) return;
    const pending = await this.entries(), retained = [];
    for (const item of pending) {
      if (item.owner !== owner) { retained.push(item); continue; }
      try {
        let saved = item.saved;
        if (!saved && item.saving) {
          let temporaryExists = true;
          try { await (this.io.access || access)(item.temporary); }
          catch (error) { if (error.code === 'ENOENT') temporaryExists = false; else throw error; }
          // A successful atomic rename removes the temporary file. If it is
          // still present, an identical older target is not proof of a save.
          if (!temporaryExists) {
            try { saved = createHash('sha256').update(await this.io.readFile(item.filePath)).digest('hex') === item.digest; }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
          }
        }
        // A crash may happen before the reserve request reached the server.
        try { await this.account.request('/v1/exports/' + (saved ? 'commit' : 'release'), { operation: item.operation }); }
        catch (error) { if (error.code === 'operation_not_found') {} else throw error; }
        await this.io.unlink(item.temporary).catch(() => {});
      } catch { retained.push(item); }
    }
    await this.journal(retained);
  }
  reconcile() { return this.exclusive(() => this.reconcileUnlocked()); }
  save(filePath, bytes) {
    return this.exclusive(async () => {
      await this.account.refresh();
      const owner = this.account.account?.accountId;
      if (!owner) throw new Error('Connectez-vous à Inklura pour exporter.');
      await this.reconcileUnlocked();
      const pending = await this.entries();
      const item = { owner, operation: randomUUID(), filePath, temporary: path.join(path.dirname(filePath), '.inklura-' + randomUUID() + '.tmp'), digest: createHash('sha256').update(bytes).digest('hex'), saved: false, saving: false };
      // Persist intent BEFORE the network: even a lost reservation response can be recovered.
      pending.push(item); await this.journal(pending);
      try {
        await this.account.request('/v1/exports/reserve', { operation: item.operation });
        await this.io.writeFile(item.temporary, bytes, { mode: 0o600, flag: 'wx' });
        item.saving = true;
        await this.journal(pending);
        await this.io.rename(item.temporary, filePath);
        item.saved = true;
      } catch (error) {
        item.saving = false;
        await this.journal(pending).catch(() => {});
        await this.reconcileUnlocked();
        throw error;
      }
      // A successful save is never presented as a failed export merely because
      // the commit acknowledgement was lost. The durable hold prevents overspend.
      try { await this.journal(pending); } catch { /* recovery checks the local file digest */ }
      await this.reconcileUnlocked().catch(() => {});
      await this.account.refresh().catch(() => {});
      const unsettled = await this.entries().then(entries => entries.some(entry => entry.operation === item.operation)).catch(() => true);
      return { saved: true, accountingPending: unsettled };
    });
  }
}
