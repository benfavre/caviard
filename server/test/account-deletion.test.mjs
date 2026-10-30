import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Ledger } from '../ledger.mjs';
import { AccountDeletion } from '../account-deletion.mjs';
import { Payments } from '../payments.mjs';
import { ApplePurchases } from '../apple-purchases.mjs';
import { APPLE_PRODUCTS, APPLE_BUNDLE_ID } from '../../electron/apple-catalog.mjs';
const issuer = 'https://auth.1clic.pro', confirmation = 'SUPPRIMER MON COMPTE PDF';
const values = items => ({ async *[Symbol.asyncIterator]() { yield* items; } });
function fixture(filename) {
  const ledger = new Ledger(filename), payments = new Payments({ ledger });
  return { ledger, payments, deletion: new AccountDeletion({ ledger, payments }) };
}
test('PDF erasure removes profile/export data, preserves other users and rejects stale identity reprovisioning', async () => {
  const { ledger, deletion } = fixture();
  try {
    const owner = ledger.account(issuer, 'private-shared-subject'), other = ledger.account(issuer, 'other');
    ledger.reserve(owner.id, 'private-operation-123456');
    ledger.db.prepare('INSERT INTO purchase_buyers(account,buyer) VALUES(?,?)').run(owner.id, '{"email":"fixture@example.test"}');
    assert.throws(() => deletion.request(issuer, 'private-shared-subject', 'yes'), { code: 'deletion_confirmation_required' });
    assert.deepEqual(deletion.request(issuer, 'private-shared-subject', confirmation), { state: 'pending' });
    assert.throws(() => ledger.account(issuer, 'private-shared-subject'), { code: 'account_deletion_pending' });
    assert.throws(() => ledger.reserve(owner.id, 'another-operation-123'), { code: 'account_under_review' });
    await deletion.run();
    assert.deepEqual(deletion.request(issuer, 'private-shared-subject', confirmation), { state: 'deleted' });
    assert.throws(() => ledger.account(issuer, 'private-shared-subject'), { code: 'account_deleted' });
    assert.equal(ledger.getAccount(owner.id).subject, owner.id);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM exports WHERE account=?').get(owner.id).n, 0);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM purchase_buyers WHERE account=?').get(owner.id).n, 0);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM grants WHERE account=?').get(owner.id).n, 0);
    assert.equal(ledger.balance(other.id).remaining, 20);
    ledger.grant({ id: 'late-payment', account: owner.id, kind: 'volume', units: 100, starts: 1, ends: 8640000000000000 });
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM grants WHERE account=?').get(owner.id).n, 0);
  } finally { ledger.close(); }
});
test('deletion retries after restart and cancels only the PDF subscriptions, including linked web purchases', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pdf-erasure-')), filename = path.join(dir, 'db.sqlite');
  let { ledger, payments, deletion } = fixture(filename);
  const owner = ledger.account(issuer, 'closing'), escrow = ledger.account('urn:inklura:pdf:purchase', 'escrow');
  ledger.db.prepare('INSERT INTO web_purchases(receipt_hash,account,operation,plan,owner,created) VALUES(?,?,?,?,?,?)').run('receipt', escrow.id, 'order-operation-123', 'business-20', owner.id, 1);
  ledger.db.prepare('UPDATE accounts SET customer=? WHERE id=?').run('cus_pdf', escrow.id);
  ledger.db.prepare('INSERT INTO orders(account,operation,plan,checkout,created) VALUES(?,?,?,?,?)').run(escrow.id, 'order-operation-123', 'business-20', 'cs_pdf', 1);
  ledger.recordSale({id:'sale-fixture',kind:'first',account:escrow.id,plan:'business-20',email:'invoice@example.test'});
  deletion.request(issuer, 'closing', confirmation);
  await deletion.run(); // Provider unavailable, request must survive.
  assert.equal(ledger.deletionForIdentity(issuer, 'closing').completed, null);
  ledger.close();
  ({ ledger, payments, deletion } = fixture(filename));
  const expired = [], canceled = [];
  payments.stripe = {
    checkout: { sessions: { list: () => values([
      { id: 'cs_other', metadata: { inkluraPdfAccount: 'other-product' } },
      { id: 'cs_pdf', metadata: { inkluraPdfAccount: escrow.id }, client_reference_id: escrow.id }
    ]), expire: async id => expired.push(id) } },
    subscriptions: { list: () => values([
      { id: 'sub_other', status: 'active', metadata: { product: 'other' } },
      { id: 'sub_pdf', status: 'active', metadata: { inkluraPdfAccount: escrow.id, inkluraPdfPlan: 'business-20', inkluraPdfOrder: 'order-operation-123' } }
    ]), cancel: async (id, options) => { assert.deepEqual(options, { invoice_now: false, prorate: false }); canceled.push(id); } }
  };
  try {
    await deletion.run();
    assert.deepEqual(expired, ['cs_pdf']); assert.deepEqual(canceled, ['sub_pdf']);
    assert.notEqual(ledger.deletionForIdentity(issuer, 'closing').completed, null);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM web_purchases').get().n, 0);
    assert.equal(ledger.db.prepare('SELECT email FROM sales WHERE id=?').get('sale-fixture').email, 'invoice@example.test');
    assert.ok(ledger.isClosing(escrow.id));
  } finally { ledger.close(); rmSync(dir, { recursive: true }); }
});
test('a checkout already in flight settles before Stripe enumeration and erasure', async () => {
  const { ledger, payments, deletion } = fixture();
  const owner = ledger.account(issuer, 'racing');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  payments.checkouts.set(owner.id, new Set([pending]));
  try {
    deletion.request(issuer, 'racing', confirmation);
    const run = deletion.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ledger.deletionForIdentity(issuer, 'racing').completed, null);
    release(); await run;
    assert.notEqual(ledger.deletionForIdentity(issuer, 'racing').completed, null);
  } finally { ledger.close(); }
});
test('a delayed Apple transaction cannot recreate deleted credits', async () => {
  const { ledger, deletion } = fixture();
  try {
    const account = ledger.account(issuer, 'apple-owner').id;
    const apple = new ApplePurchases({ ledger, provider: {}, sandboxAccounts: [account] });
    const prepared = apple.prepare(account, APPLE_PRODUCTS[0].id);
    const tx = { transactionId:'123456789', productId:APPLE_PRODUCTS[0].id, bundleId:APPLE_BUNDLE_ID,
      type:'Consumable', inAppOwnershipType:'PURCHASED', quantity:1, purchaseDate:Date.now()-1000,
      signedDate:Date.now(), appAccountToken:prepared.appAccountToken, environment:'Sandbox' };
    apple.apply(tx, account, 'Sandbox');
    deletion.request(issuer, 'apple-owner', confirmation); await deletion.run();
    assert.equal(apple.apply({...tx,signedDate:Date.now()+1000}, account, 'Sandbox').state, 'account_deleted');
    assert.equal(ledger.db.prepare('SELECT SUM(total) n FROM grants WHERE account=?').get(account).n, 0);
  } finally { ledger.close(); }
});
