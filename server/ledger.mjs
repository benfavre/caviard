import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { TRIAL_DOCUMENTS } from '../electron/commerce-catalog.mjs';
export class BillingError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const operationPattern = /^[a-zA-Z0-9_-]{16,100}$/;
export function operationId(value) {
  if (typeof value !== 'string' || !operationPattern.test(value)) throw new BillingError('invalid_operation');
  return value;
}
export function addMonths(timestamp, months) {
  const date = new Date(timestamp), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.getTime();
}
export class Ledger {
  constructor(filename = ':memory:', { now = () => Date.now() } = {}) {
    this.now = now;
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL,
        created INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, customer TEXT UNIQUE,
        subscription TEXT UNIQUE, UNIQUE(issuer,subject));
      CREATE TABLE IF NOT EXISTS grants(id TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id),
        kind TEXT NOT NULL, total INTEGER NOT NULL CHECK(total>=0), used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0),
        reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0), starts INTEGER NOT NULL, ends INTEGER NOT NULL,
        CHECK(used+reserved<=total));
      CREATE TABLE IF NOT EXISTS exports(account TEXT NOT NULL REFERENCES accounts(id), operation TEXT NOT NULL,
        grant_id TEXT NOT NULL REFERENCES grants(id), state TEXT NOT NULL CHECK(state IN ('reserved','committed','released','refunded')),
        created INTEGER NOT NULL, PRIMARY KEY(account,operation));
      CREATE TABLE IF NOT EXISTS orders(account TEXT NOT NULL REFERENCES accounts(id), operation TEXT NOT NULL,
        plan TEXT NOT NULL, checkout TEXT UNIQUE, payment_intent TEXT, state TEXT NOT NULL DEFAULT 'pending',
        created INTEGER NOT NULL, PRIMARY KEY(account,operation));
      CREATE TABLE IF NOT EXISTS web_purchases(receipt_hash TEXT PRIMARY KEY,
        account TEXT NOT NULL UNIQUE REFERENCES accounts(id), operation TEXT NOT NULL,
        plan TEXT NOT NULL, owner TEXT REFERENCES accounts(id), created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS web_purchases_owner ON web_purchases(owner);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS apple_accounts(account TEXT PRIMARY KEY REFERENCES accounts(id), token TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS apple_transactions(id TEXT PRIMARY KEY REFERENCES grants(id),
        account TEXT NOT NULL REFERENCES accounts(id), product TEXT NOT NULL, units INTEGER NOT NULL,
        purchased INTEGER NOT NULL, signed_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS purchase_buyers(account TEXT PRIMARY KEY REFERENCES accounts(id), buyer TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sales(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
        account TEXT NOT NULL REFERENCES accounts(id), operation TEXT, plan TEXT NOT NULL, channel TEXT NOT NULL,
        amount_total INTEGER, amount_tax INTEGER, currency TEXT, name TEXT, email TEXT, address TEXT, tax_id TEXT, buyer TEXT,
        stripe_customer TEXT, stripe_invoice TEXT, subscription TEXT, payment_intent TEXT,
        period_start INTEGER, period_end INTEGER, created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS grants_account ON grants(account, ends);`);
    // Promotion codes (activ #1104): additive columns, idempotent.
    const add = (table, column, type) => {
      if (!this.db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name=?`).get(column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    };
    add('web_purchases', 'promo', 'TEXT');
    add('sales', 'amount_subtotal', 'INTEGER');
    add('sales', 'amount_discount', 'INTEGER');
    add('sales', 'promo_code', 'TEXT');
  }
  close() { this.db.close(); }
  /** One row per paid sale (first payment or renewal), read by the invoicing worker. */
  recordSale(sale) {
    const web = this.db.prepare('SELECT 1 FROM web_purchases WHERE account=?').get(sale.account);
    const buyer = this.db.prepare('SELECT buyer FROM purchase_buyers WHERE account=?').get(sale.account)?.buyer ?? null;
    this.db.prepare(`INSERT OR IGNORE INTO sales(id,kind,account,operation,plan,channel,amount_total,amount_tax,currency,name,email,address,tax_id,buyer,
      stripe_customer,stripe_invoice,subscription,payment_intent,period_start,period_end,created,amount_subtotal,amount_discount,promo_code)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      sale.id, sale.kind, sale.account, sale.operation ?? null, sale.plan, web ? 'web' : 'app', sale.amountTotal ?? null, sale.amountTax ?? null,
      sale.currency ?? null, sale.name ?? null, sale.email ?? null, sale.address ? JSON.stringify(sale.address) : null, sale.taxId ?? null, buyer,
      sale.customer ?? null, sale.invoice ?? null, sale.subscription ?? null, sale.paymentIntent ?? null, sale.periodStart ?? null, sale.periodEnd ?? null, this.now(),
      sale.amountSubtotal ?? null, sale.amountDiscount ?? null, sale.promoCode ?? null);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  account(issuer, subject) {
    if (!issuer || typeof subject !== 'string' || !subject || subject.length > 255) throw new BillingError('invalid_identity', 401);
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM accounts WHERE issuer=? AND subject=?').get(issuer, subject);
      if (existing) return existing;
      const id = randomUUID(), now = this.now();
      this.db.prepare('INSERT INTO accounts(id,issuer,subject,created) VALUES(?,?,?,?)').run(id, issuer, subject, now);
      this.grant({ id: 'trial:' + id, account: id, kind: 'trial', units: TRIAL_DOCUMENTS, starts: now, ends: 8640000000000000 });
      return this.getAccount(id);
    });
  }
  getAccount(id) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
    if (!account) throw new BillingError('account_not_found', 404);
    return account;
  }
  grant({ id, account, kind, units, starts, ends }) {
    if (!Number.isSafeInteger(units) || units <= 0 || !Number.isSafeInteger(starts) || !Number.isSafeInteger(ends) || ends <= starts) throw new BillingError('invalid_grant');
    this.db.prepare('INSERT OR IGNORE INTO grants(id,account,kind,total,starts,ends) VALUES(?,?,?,?,?,?)').run(id, account, kind, units, starts, ends);
    const saved = this.db.prepare('SELECT * FROM grants WHERE id=?').get(id);
    if (saved.account !== account || saved.total !== units || saved.kind !== kind || saved.starts !== starts || saved.ends !== ends) throw new BillingError('grant_conflict', 409);
  }
  sources(account) {
    this.getAccount(account);
    return [account, ...this.db.prepare('SELECT account FROM web_purchases WHERE owner=?').all(account).map(row => row.account)];
  }
  isBlocked(account) {
    const owner = this.db.prepare('SELECT owner FROM web_purchases WHERE account=?').get(account)?.owner || account;
    return this.sources(owner).some(id => this.getAccount(id).blocked || !!this.db.prepare(
      'SELECT 1 FROM apple_transactions a JOIN grants g ON g.id=a.id WHERE a.account=? AND a.revoked=1 AND g.used+g.reserved>0 LIMIT 1'
    ).get(id));
  }
  balance(account) {
    const sources = this.sources(account), now = this.now();
    const grants = this.db.prepare(`SELECT kind,total,used,reserved,starts,ends FROM grants WHERE account IN (${sources.map(() => '?').join(',')}) AND starts<=? AND ends>? ORDER BY ends`).all(...sources, now, now);
    return { accountId: account, blocked: this.isBlocked(account), remaining: grants.reduce((n, g) => n + g.total - g.used - g.reserved, 0),
      reserved: grants.reduce((n, g) => n + g.reserved, 0), grants: grants.map(g => ({ ...g, expiresAt: ['trial', 'apple'].includes(g.kind) ? null : new Date(g.ends).toISOString() })) };
  }
  reserve(account, operation) {
    operationId(operation);
    return this.transaction(() => {
      if (this.isBlocked(account)) throw new BillingError('account_under_review', 403);
      const existing = this.db.prepare('SELECT * FROM exports WHERE account=? AND operation=?').get(account, operation);
      if (existing) {
        if (['released', 'refunded'].includes(existing.state)) throw new BillingError('operation_closed', 409);
        return { operation, state: existing.state };
      }
      const now = this.now(), sources = this.sources(account);
      const grant = this.db.prepare(`SELECT * FROM grants WHERE account IN (${sources.map(() => '?').join(',')}) AND starts<=? AND ends>? AND total-used-reserved>0 ORDER BY ends,starts,id LIMIT 1`).get(...sources, now, now);
      if (!grant) throw new BillingError('quota_exhausted', 402);
      this.db.prepare('UPDATE grants SET reserved=reserved+1 WHERE id=?').run(grant.id);
      this.db.prepare("INSERT INTO exports(account,operation,grant_id,state,created) VALUES(?,?,?,'reserved',?)").run(account, operation, grant.id, now);
      return { operation, state: 'reserved' };
    });
  }
  transition(account, operation, action) {
    operationId(operation);
    return this.transaction(() => {
      const item = this.db.prepare('SELECT * FROM exports WHERE account=? AND operation=?').get(account, operation);
      if (!item) throw new BillingError('operation_not_found', 404);
      if (action === 'commit') {
        if (item.state === 'committed') return { operation, state: item.state };
        if (item.state !== 'reserved') throw new BillingError('operation_closed', 409);
        this.db.prepare('UPDATE grants SET reserved=reserved-1,used=used+1 WHERE id=?').run(item.grant_id);
        this.db.prepare("UPDATE exports SET state='committed' WHERE account=? AND operation=?").run(account, operation);
        return { operation, state: 'committed' };
      }
      if (action !== 'release') throw new BillingError('invalid_action');
      // Only a reservation can be released. A completed export can never self-refund.
      if (item.state === 'committed') throw new BillingError('already_committed', 409);
      if (item.state === 'reserved') {
        this.db.prepare('UPDATE grants SET reserved=reserved-1 WHERE id=?').run(item.grant_id);
        this.db.prepare("UPDATE exports SET state='released' WHERE account=? AND operation=?").run(account, operation);
      }
      return { operation, state: 'released' };
    });
  }
  // Holds do not auto-expire: a saved file with an interrupted commit must not
  // silently become free. The desktop journals and reconciles pending operations.
  createOrder(account, operation, plan) {
    operationId(operation);
    this.getAccount(account);
    const existing = this.db.prepare('SELECT * FROM orders WHERE account=? AND operation=?').get(account, operation);
    if (existing) {
      if (existing.plan !== plan.id) throw new BillingError('order_conflict', 409);
      return existing;
    }
    if (plan.kind === 'subscription') {
      const sources = this.sources(account);
      const pending = this.db.prepare(`SELECT * FROM orders WHERE account IN (${sources.map(() => '?').join(',')}) AND (plan LIKE 'business-%' OR plan LIKE 'annual-%') AND state='pending'`).get(...sources);
      if (this.sources(account).some(id => this.getAccount(id).subscription)) throw new BillingError('subscription_already_exists', 409);
      // Resume the same checkout after an app restart or an ambiguous Stripe
      // timeout, preserving its original Stripe idempotency key.
      if (pending?.plan === plan.id && pending.account === account) return pending;
      if (pending) throw new BillingError('subscription_already_exists', 409);
    }
    this.db.prepare('INSERT INTO orders(account,operation,plan,created) VALUES(?,?,?,?)').run(account, operation, plan.id, this.now());
    return this.db.prepare('SELECT * FROM orders WHERE account=? AND operation=?').get(account, operation);
  }
  once(eventId, fn) {
    return this.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM events WHERE id=?').get(eventId)) return false;
      fn();
      this.db.prepare('INSERT INTO events(id,created) VALUES(?,?)').run(eventId, this.now());
      return true;
    });
  }
}
