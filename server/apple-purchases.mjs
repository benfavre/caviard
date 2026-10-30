import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AppStoreServerAPIClient, SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { BillingError } from './ledger.mjs';
import { APPLE_PRODUCTS, APPLE_BUNDLE_ID, APPLE_APP_ID } from '../electron/apple-catalog.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const transactionId = id => typeof id === 'string' && /^[0-9]{1,40}$/.test(id);
const NEVER_EXPIRES = 8640000000000000;

export function appleProvider(env) {
  if (env.INKLURA_APPLE_PURCHASES_ENABLED !== 'true') return null;
  const key = readFileSync(env.INKLURA_APPLE_IAP_KEY_FILE, 'utf8');
  const roots = [readFileSync(new URL('./certificates/AppleRootCA-G3.cer', import.meta.url))];
  const providers = Object.fromEntries([Environment.PRODUCTION, Environment.SANDBOX].map(environment => [environment, {
    client: new AppStoreServerAPIClient(key, env.INKLURA_APPLE_IAP_KEY_ID, env.INKLURA_APPLE_ISSUER_ID, APPLE_BUNDLE_ID, environment),
    verifier: new SignedDataVerifier(roots, true, environment, APPLE_BUNDLE_ID, APPLE_APP_ID),
  }]));
  return {
    async transaction(id, environment) {
      const { client, verifier } = providers[environment];
      const result = await client.getTransactionInfo(id);
      return verifier.verifyAndDecodeTransaction(result.signedTransactionInfo);
    },
    async notification(signedPayload) {
      for (const { verifier } of Object.values(providers)) {
        try { return await verifier.verifyAndDecodeNotification(signedPayload); } catch {}
      }
      throw new BillingError('invalid_apple_notification', 400);
    },
    async notificationTransaction(signedTransaction, environment) {
      if (!providers[environment]) throw new BillingError('invalid_apple_notification');
      return providers[environment].verifier.verifyAndDecodeTransaction(signedTransaction);
    },
  };
}

export class ApplePurchases {
  constructor({ ledger, provider = null, sandboxAccounts = [] }) {
    Object.assign(this, { ledger, provider });
    this.enabled = !!provider;
    // Only dedicated review/test accounts may receive sandbox credits. The
    // environment comes from server configuration, never a client field.
    this.sandboxAccounts = new Set(sandboxAccounts.filter(id => UUID.test(id)));
  }
  environment(account) { return this.sandboxAccounts.has(account) ? Environment.SANDBOX : Environment.PRODUCTION; }
  catalog() { return this.enabled ? APPLE_PRODUCTS : []; }
  prepare(account, productId) {
    if (!this.enabled) throw new BillingError('apple_purchases_unavailable', 503);
    if (!APPLE_PRODUCTS.some(p => p.id === productId)) throw new BillingError('invalid_apple_product');
    if (this.ledger.isBlocked(account)) throw new BillingError('account_under_review', 403);
    this.ledger.db.prepare('INSERT OR IGNORE INTO apple_accounts(account,token) VALUES(?,?)').run(account, randomUUID());
    return { productId, appAccountToken: this.ledger.db.prepare('SELECT token FROM apple_accounts WHERE account=?').get(account).token };
  }
  async claim(account, id) {
    if (!this.enabled) throw new BillingError('apple_purchases_unavailable', 503);
    if (!transactionId(id)) throw new BillingError('invalid_apple_transaction');
    const environment = this.environment(account);
    const transaction = await this.provider.transaction(id, environment);
    if (transaction.transactionId !== id) throw new BillingError('invalid_apple_transaction');
    return this.apply(transaction, account, environment);
  }
  // Receives only objects returned by Apple's cryptographic verifier. Never
  // expose this method directly as an HTTP handler or accept a client payload.
  apply(t, expectedAccount, expectedEnvironment) {
    const product = APPLE_PRODUCTS.find(p => p.id === t.productId);
    if (!product || !transactionId(t.transactionId) || t.bundleId !== APPLE_BUNDLE_ID ||
        t.type !== 'Consumable' || t.inAppOwnershipType !== 'PURCHASED' ||
        !Number.isSafeInteger(t.quantity) || t.quantity < 1 || t.quantity > 10 ||
        !Number.isSafeInteger(t.purchaseDate) || t.purchaseDate <= 0 || t.purchaseDate > this.ledger.now() + 300000 ||
        !Number.isSafeInteger(t.signedDate) || t.signedDate <= 0 ||
        !UUID.test(t.appAccountToken || '') || t.environment !== expectedEnvironment)
      throw new BillingError('invalid_apple_transaction');
    const owner = this.ledger.db.prepare('SELECT account FROM apple_accounts WHERE token=?').get(t.appAccountToken.toLowerCase())?.account;
    if (!owner || (expectedAccount && owner !== expectedAccount) || this.environment(owner) !== t.environment)
      throw new BillingError('apple_purchase_account_mismatch', 403);
    const id = `apple:${t.environment}:${t.transactionId}`, units = product.documents * t.quantity;
    return this.ledger.transaction(() => {
      const previous = this.ledger.db.prepare('SELECT * FROM apple_transactions WHERE id=?').get(id);
      if (previous && (previous.account !== owner || previous.product !== t.productId || previous.units !== units || previous.purchased !== t.purchaseDate))
        throw new BillingError('apple_transaction_conflict', 409);
      const revoked = t.revocationDate != null;
      if (!previous) {
        this.ledger.grant({ id, account: owner, kind: 'apple', units, starts: t.purchaseDate, ends: NEVER_EXPIRES });
        this.ledger.db.prepare('INSERT INTO apple_transactions(id,account,product,units,purchased,signed_at,revoked) VALUES(?,?,?,?,?,?,?)')
          .run(id, owner, t.productId, units, t.purchaseDate, t.signedDate, Number(revoked));
      }
      // A delayed delivery must not undo a newer refund. Fresh API reads and
      // monotonic signed dates cover duplicate/out-of-order notifications.
      if (!previous || t.signedDate > previous.signed_at || (t.signedDate === previous.signed_at && revoked)) {
        this.ledger.db.prepare('UPDATE apple_transactions SET signed_at=?,revoked=? WHERE id=?').run(t.signedDate, Number(revoked), id);
        this.ledger.db.prepare('UPDATE grants SET total=CASE WHEN ? THEN used+reserved ELSE ? END WHERE id=?').run(Number(revoked), units, id);
      }
      const current = this.ledger.db.prepare('SELECT revoked FROM apple_transactions WHERE id=?').get(id);
      return { transactionId: t.transactionId, state: current.revoked ? 'revoked' : 'credited' };
    });
  }
  async notification(signedPayload) {
    if (!this.enabled) throw new BillingError('apple_purchases_unavailable', 503);
    if (typeof signedPayload !== 'string' || signedPayload.length > 128 * 1024) throw new BillingError('invalid_apple_notification');
    const notification = await this.provider.notification(signedPayload);
    if (notification.notificationType === 'TEST') return { received: true };
    if (!notification.data?.signedTransactionInfo) return { received: true };
    const t = await this.provider.notificationTransaction(notification.data.signedTransactionInfo, notification.data.environment);
    if (!APPLE_PRODUCTS.some(p => p.id === t.productId)) return { received: true };
    const owner = this.ledger.db.prepare('SELECT account FROM apple_accounts WHERE token=?').get(String(t.appAccountToken || '').toLowerCase())?.account;
    if (!owner || this.environment(owner) !== t.environment) throw new BillingError('apple_purchase_account_mismatch', 403);
    // Read current state instead of letting an old notification resurrect a refund.
    await this.claim(owner, t.transactionId);
    return { received: true };
  }
}
