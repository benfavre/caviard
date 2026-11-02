import { BillingError, operationId } from './ledger.mjs';
import { AI_TRIAL_ANALYSES } from '../electron/ai-commerce.mjs';

export class AICredits {
  constructor(ledger) {
    this.ledger = ledger; this.db = ledger.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS ai_grants (
      id TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, total INTEGER NOT NULL CHECK(total>0), used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0),
      reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0), starts INTEGER NOT NULL, ends INTEGER NOT NULL,
      CHECK(used+reserved<=total));
      CREATE TABLE IF NOT EXISTS ai_operations (
      account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, operation TEXT NOT NULL,
      grant_id TEXT NOT NULL REFERENCES ai_grants(id) ON DELETE CASCADE, digest TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('reserved','committed','released')), expires INTEGER NOT NULL,
      PRIMARY KEY(account,operation));
      CREATE INDEX IF NOT EXISTS ai_grants_account ON ai_grants(account,ends);`);
  }
  grant({ id, account, kind, units, starts, ends }) {
    if (!Number.isSafeInteger(units) || units < 1 || !Number.isSafeInteger(starts) || !Number.isSafeInteger(ends) || ends <= starts) throw new BillingError('invalid_grant');
    this.db.prepare('INSERT OR IGNORE INTO ai_grants(id,account,kind,total,starts,ends) VALUES(?,?,?,?,?,?)').run(id, account, kind, units, starts, ends);
    const row = this.db.prepare('SELECT * FROM ai_grants WHERE id=?').get(id);
    if (row.account !== account || row.kind !== kind || row.total !== units || row.starts !== starts || row.ends !== ends) throw new BillingError('grant_conflict', 409);
  }
  trial(account) {
    const owner = this.ledger.getAccount(account);
    this.grant({ id: 'ai-trial:' + account, account, kind: 'trial', units: AI_TRIAL_ANALYSES, starts: owner.created, ends: 8640000000000000 });
  }
  expire() {
    const rows = this.db.prepare("SELECT * FROM ai_operations WHERE state='reserved' AND expires<=?").all(this.ledger.now());
    for (const row of rows) {
      this.db.prepare('UPDATE ai_grants SET reserved=reserved-1 WHERE id=?').run(row.grant_id);
      this.db.prepare("UPDATE ai_operations SET state='released' WHERE account=? AND operation=?").run(row.account, row.operation);
    }
  }
  balance(account) {
    return this.ledger.transaction(() => {
      this.trial(account); this.expire();
      const sources = this.ledger.sources(account), now = this.ledger.now();
      const grants = this.db.prepare(`SELECT kind,total,used,reserved,starts,ends FROM ai_grants WHERE account IN (${sources.map(() => '?')}) AND starts<=? AND ends>? ORDER BY ends`).all(...sources, now, now);
      return { remaining: grants.reduce((n,g) => n+g.total-g.used-g.reserved,0), reserved: grants.reduce((n,g) => n+g.reserved,0), grants };
    });
  }
  reserve(account, operation, digest) {
    operationId(operation);
    return this.ledger.transaction(() => {
      if (this.ledger.isBlocked(account)) throw new BillingError('account_under_review', 403);
      this.trial(account); this.expire();
      const existing = this.db.prepare('SELECT * FROM ai_operations WHERE account=? AND operation=?').get(account,operation);
      if (existing) {
        if (existing.digest !== digest) throw new BillingError('ai_operation_conflict', 409);
        if (existing.state === 'released') throw new BillingError('ai_operation_closed', 409);
        return existing;
      }
      const now = this.ledger.now(), sources = this.ledger.sources(account);
      const grant = this.db.prepare(`SELECT * FROM ai_grants WHERE account IN (${sources.map(() => '?')}) AND starts<=? AND ends>? AND total-used-reserved>0 ORDER BY ends,starts,id LIMIT 1`).get(...sources,now,now);
      if (!grant) throw new BillingError('ai_quota_exhausted', 402);
      this.db.prepare('UPDATE ai_grants SET reserved=reserved+1 WHERE id=?').run(grant.id);
      this.db.prepare("INSERT INTO ai_operations(account,operation,grant_id,digest,state,expires) VALUES(?,?,?,?,'reserved',?)").run(account,operation,grant.id,digest,now+300000);
      return { state: 'reserved', created: true };
    });
  }
  settle(account, operation, commit) {
    return this.ledger.transaction(() => {
      const row = this.db.prepare('SELECT * FROM ai_operations WHERE account=? AND operation=?').get(account,operation);
      if (!row) throw new BillingError('operation_not_found',404);
      if (row.state === 'committed') { if (!commit) throw new BillingError('already_committed',409); return; }
      if (row.state !== 'reserved') { if (commit) throw new BillingError('ai_operation_closed',409); return; }
      const paid = commit && row.expires > this.ledger.now();
      this.db.prepare('UPDATE ai_grants SET reserved=reserved-1,used=used+? WHERE id=?').run(paid?1:0,row.grant_id);
      this.db.prepare('UPDATE ai_operations SET state=? WHERE account=? AND operation=?').run(paid?'committed':'released',account,operation);
      if (commit && !paid) throw new BillingError('ai_operation_closed',409);
    });
  }
}
