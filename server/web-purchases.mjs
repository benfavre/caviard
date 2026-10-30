import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { BillingError } from './ledger.mjs';
import { INKLURA_ISSUER } from './auth.mjs';
import { planById } from '../electron/commerce-catalog.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const receiptPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class WebPurchases {
  constructor({ ledger, payments, secret = '', now = () => Date.now() }) {
    Object.assign(this, { ledger, payments, secret, now });
  }
  get enabled() { return this.secret.length >= 32 && this.payments.enabled; }
  async checkout(planId, previousReceipt, issued = () => {}, buyer = null, promo = null) {
    if (!this.enabled) throw new BillingError('purchases_not_enabled', 503);
    if (!planById(planId)) throw new BillingError('offer_not_available');
    let receipt = receiptPattern.test(previousReceipt || '') ? previousReceipt : null;
    let purchase = receipt && this.ledger.db.prepare('SELECT * FROM web_purchases WHERE receipt_hash=? AND plan=?').get(hash(receipt), planId);
    if (purchase) {
      const order = this.ledger.db.prepare('SELECT * FROM orders WHERE account=? AND operation=?').get(purchase.account, purchase.operation);
      // A new or removed code needs a new Checkout session.
      if ((order && order.state !== 'pending') || (purchase.promo || null) !== (promo || null)) purchase = null;
    }
    if (!purchase) {
      receipt = randomBytes(32).toString('hex');
      purchase = this.ledger.transaction(() => {
        // Persist the public creation ceiling across process restarts.
        const recent = this.ledger.db.prepare('SELECT count(*) AS n FROM web_purchases WHERE created>?').get(this.now() - 3600000).n;
        if (recent >= 100) throw new BillingError('too_many_purchases', 429);
        const account = randomUUID(), operation = randomUUID();
        // Escrow accounts have no trial and cannot authenticate or export.
        this.ledger.db.prepare('INSERT INTO accounts(id,issuer,subject,created) VALUES(?,?,?,?)').run(account, 'urn:inklura:pdf:purchase', account, this.now());
        this.ledger.db.prepare('INSERT INTO web_purchases(receipt_hash,account,operation,plan,created,promo) VALUES(?,?,?,?,?,?)').run(hash(receipt), account, operation, planId, this.now(), promo || null);
        return { account, operation, plan: planId };
      });
    }
    issued(receipt);
    if (buyer) this.ledger.db.prepare('INSERT OR REPLACE INTO purchase_buyers(account,buyer) VALUES(?,?)').run(purchase.account, JSON.stringify({ intent: buyer.intent, contact: buyer.contact, company: buyer.company, email: buyer.email, taxId: buyer.taxId }));
    const result = await this.payments.checkout(purchase.account, purchase.plan, purchase.operation, undefined, {
      website: true, buyer, promo, successUrl: 'https://manage.inklura.fr/pdf/billing?claim=' + receipt,
    });
    return { ...result, receipt };
  }
  promotion(planId, code) { return this.payments.promotion(planId, code); }
  verify(path, raw, authorization) {
    if (this.secret.length < 32) throw new BillingError('website_not_configured', 503);
    const match = /^PDF-Web (\d{13}):([A-Za-z0-9_-]{43})$/.exec(authorization || '');
    if (!match || Math.abs(this.now() - Number(match[1])) > 60000) throw new BillingError('invalid_web_signature', 401);
    const signature = createHmac('sha256', this.secret).update(match[1] + '\n' + path + '\n' + raw).digest('base64url');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(match[2]))) throw new BillingError('invalid_web_signature', 401);
    try { return JSON.parse(raw); } catch { throw new BillingError('invalid_json'); }
  }
  authenticate(path, raw, authorization) {
    const data = this.verify(path, raw, authorization);
    if (!uuidPattern.test(data?.subject || '')) throw new BillingError('invalid_identity', 401);
    return { data, account: this.ledger.account(INKLURA_ISSUER, data.subject) };
  }
  /** Paid sales after `after` (a sales.seq), for the invoicing worker. */
  sales(after, limit = 50) {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new BillingError('invalid_request');
    return { sales: this.ledger.db.prepare('SELECT * FROM sales WHERE seq>? ORDER BY seq LIMIT ?').all(after, limit).map(row => ({ ...row, address: JSON.parse(row.address || 'null'), buyer: JSON.parse(row.buyer || 'null') })) };
  }
  claim(account, receipt) {
    if (!receiptPattern.test(receipt || '')) throw new BillingError('invalid_receipt', 404);
    return this.ledger.transaction(() => {
      const purchase = this.ledger.db.prepare('SELECT w.*,o.state FROM web_purchases w LEFT JOIN orders o ON o.account=w.account AND o.operation=w.operation WHERE w.receipt_hash=?').get(hash(receipt));
      if (!purchase || (purchase.owner && purchase.owner !== account)) throw new BillingError('invalid_receipt', 404);
      if (purchase.state === 'country_rejected' || this.ledger.getAccount(purchase.account).blocked) throw new BillingError('account_under_review', 403);
      if (purchase.state === 'expired') return { state: 'expired' };
      if (!['paid', 'pending'].includes(purchase.state)) throw new BillingError('purchase_not_ready', 409);
      this.ledger.db.prepare('UPDATE web_purchases SET owner=? WHERE receipt_hash=? AND (owner IS NULL OR owner=?)').run(account, hash(receipt), account);
      return { state: 'linked', planId: purchase.plan, paymentPending: purchase.state !== 'paid' };
    });
  }
  /** Buyer e-mail and name of an unclaimed purchase, to prefill account creation. */
  receipt(receipt) {
    if (!receiptPattern.test(receipt || '')) throw new BillingError('invalid_receipt', 404);
    const purchase = this.ledger.db.prepare('SELECT w.account,w.plan,w.owner,b.buyer FROM web_purchases w LEFT JOIN purchase_buyers b ON b.account=w.account WHERE w.receipt_hash=?').get(hash(receipt));
    if (!purchase) throw new BillingError('invalid_receipt', 404);
    const buyer = purchase.owner ? null : JSON.parse(purchase.buyer || 'null');
    return { plan: planById(purchase.plan)?.label || null, linked: !!purchase.owner, email: buyer?.email || null, name: buyer?.contact || null };
  }
  account(account) {
    return { ...this.ledger.balance(account), pendingPurchases: this.ledger.db.prepare("SELECT count(*) AS n FROM web_purchases w JOIN orders o ON o.account=w.account AND o.operation=w.operation WHERE w.owner=? AND o.state='pending'").get(account).n, billing: this.ledger.sources(account).map(id => this.ledger.getAccount(id)).filter(a => a.customer).map(a => ({ id: a.id, subscription: !!a.subscription, label: planById(this.ledger.db.prepare('SELECT plan FROM web_purchases WHERE account=?').get(a.id)?.plan)?.label || 'Achats dans l’application' })) };
  }
  async portal(account, source) {
    if (!this.ledger.sources(account).includes(source)) throw new BillingError('account_not_found', 404);
    return this.payments.portal(source, true);
  }
}
