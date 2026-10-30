import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { Ledger } from '../ledger.mjs';
import { ApplePurchases, appleProvider } from '../apple-purchases.mjs';
import { APPLE_PRODUCTS, APPLE_BUNDLE_ID, APPLE_APP_ID } from '../../electron/apple-catalog.mjs';
import { createApi } from '../http.mjs';

function fixture({ sandbox = false } = {}) {
  let now = Date.UTC(2026, 9, 30);
  const ledger = new Ledger(':memory:', { now: () => now });
  const a = ledger.account('https://auth.1clic.pro', 'test-a'), b = ledger.account('https://auth.1clic.pro', 'test-b');
  let transaction;
  const calls = [];
  const provider = { async transaction(id, env) { calls.push({ id, env }); return transaction; } };
  const apple = new ApplePurchases({ ledger, provider, sandboxAccounts: sandbox ? [a.id] : [] });
  const token = apple.prepare(a.id, APPLE_PRODUCTS[0].id).appAccountToken;
  transaction = { transactionId: '2000000001', productId: APPLE_PRODUCTS[0].id, bundleId: APPLE_BUNDLE_ID,
    appAccountToken: token, quantity: 1, purchaseDate: now - 1000, signedDate: now,
    type: 'Consumable', inAppOwnershipType: 'PURCHASED', environment: sandbox ? 'Sandbox' : 'Production' };
  return { ledger, apple, a, b, calls, transaction, advance: amount => { now += amount; } };
}

test('verified Apple purchase grants once, without expiry, after restart/repeated delivery', async () => {
  const f = fixture(); try {
    assert.equal((await f.apple.claim(f.a.id, f.transaction.transactionId)).state, 'credited');
    await f.apple.claim(f.a.id, f.transaction.transactionId);
    assert.equal(f.ledger.balance(f.a.id).remaining, 120);
    f.advance(10 * 366 * 86400000);
    assert.equal(f.ledger.balance(f.a.id).remaining, 120);
    assert.equal(f.ledger.balance(f.a.id).grants.find(g => g.kind === 'apple').expiresAt, null);
    assert.equal(f.ledger.db.prepare('SELECT COUNT(*) n FROM apple_transactions').get().n, 1);
  } finally { f.ledger.close(); }
});
test('transaction IDs alone cannot move purchases to another signed-in account', async () => {
  const f = fixture(); try {
    await assert.rejects(f.apple.claim(f.b.id, f.transaction.transactionId), { code: 'apple_purchase_account_mismatch' });
    assert.equal(f.ledger.balance(f.a.id).remaining, 20);
    assert.equal(f.ledger.balance(f.b.id).remaining, 20);
  } finally { f.ledger.close(); }
});
test('sandbox purchases are confined to server-allowlisted test accounts', async () => {
  const f = fixture({ sandbox: true }); try {
    await f.apple.claim(f.a.id, f.transaction.transactionId);
    assert.equal(f.calls[0].env, 'Sandbox');
    await assert.rejects(f.apple.claim(f.b.id, f.transaction.transactionId), { code: 'invalid_apple_transaction' });
    f.transaction.environment = 'Production';
    await assert.rejects(f.apple.claim(f.a.id, f.transaction.transactionId), { code: 'invalid_apple_transaction' });
  } finally { f.ledger.close(); }
});
test('wrong app, product, quantity, owner token, transaction or type fails without grants', async () => {
  for (const mutation of [{ bundleId: 'another.app' }, { productId: 'unknown' }, { quantity: 0 }, { quantity: 10000 },
    { appAccountToken: '' }, { type: 'Auto-Renewable Subscription' }, { transactionId: '2' }, { signedDate: undefined }, { inAppOwnershipType: 'FAMILY_SHARED' }]) {
    const f = fixture(); try {
      Object.assign(f.transaction, mutation);
      await assert.rejects(f.apple.claim(f.a.id, '2000000001'));
      assert.equal(f.ledger.balance(f.a.id).remaining, 20);
    } finally { f.ledger.close(); }
  }
});
test('refund removes unused credits; stale purchase delivery cannot undo it', async () => {
  const f = fixture(); try {
    const initial = { ...f.transaction };
    await f.apple.claim(f.a.id, f.transaction.transactionId);
    f.transaction.revocationDate = f.transaction.signedDate + 1000;
    f.transaction.signedDate += 1000;
    assert.equal((await f.apple.claim(f.a.id, f.transaction.transactionId)).state, 'revoked');
    assert.equal(f.ledger.balance(f.a.id).remaining, 20);
    Object.assign(f.transaction, initial); delete f.transaction.revocationDate;
    assert.equal((await f.apple.claim(f.a.id, f.transaction.transactionId)).state, 'revoked');
    assert.equal(f.ledger.balance(f.a.id).remaining, 20);
  } finally { f.ledger.close(); }
});
test('refund of spent/reserved credits blocks exports without corrupting holds or existing blocks', async () => {
  const f = fixture(); try {
    await f.apple.claim(f.a.id, f.transaction.transactionId);
    // The account's trial predates its first purchase.
    f.ledger.db.prepare("UPDATE grants SET starts=? WHERE account=? AND kind='trial'").run(f.transaction.purchaseDate - 1000, f.a.id);
    // Consume the trial first, then hold an Apple credit across the refund.
    for (let i = 0; i < 20; i++) { const op = 'trial-operation-' + String(i).padStart(3, '0'); f.ledger.reserve(f.a.id, op); f.ledger.transition(f.a.id, op, 'commit'); }
    f.ledger.reserve(f.a.id, 'apple-operation-001');
    f.transaction.revocationDate = f.transaction.signedDate + 1; f.transaction.signedDate += 1;
    await f.apple.claim(f.a.id, f.transaction.transactionId);
    assert.equal(f.ledger.balance(f.a.id).blocked, true);
    assert.equal(f.ledger.balance(f.a.id).remaining, 0);
    assert.throws(() => f.ledger.reserve(f.a.id, 'apple-operation-002'), { code: 'account_under_review' });
    f.ledger.transition(f.a.id, 'apple-operation-001', 'commit');
    f.ledger.db.prepare('UPDATE accounts SET blocked=1 WHERE id=?').run(f.a.id);
    delete f.transaction.revocationDate; f.transaction.signedDate += 1;
    await f.apple.claim(f.a.id, f.transaction.transactionId);
    assert.equal(f.ledger.balance(f.a.id).remaining, 99);
    assert.equal(f.ledger.balance(f.a.id).blocked, true);
  } finally { f.ledger.close(); }
});
test('real Apple verifier rejects an unsigned/forged transaction and notifications', async () => {
  const verifier = new SignedDataVerifier([readFileSync(new URL('../certificates/AppleRootCA-G3.cer', import.meta.url))], true, Environment.PRODUCTION, APPLE_BUNDLE_ID, APPLE_APP_ID);
  const forged = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ bundleId: APPLE_BUNDLE_ID, environment: 'Production' })).toString('base64url') + '.';
  await assert.rejects(verifier.verifyAndDecodeTransaction(forged));
  await assert.rejects(verifier.verifyAndDecodeNotification(forged));
  assert.equal(appleProvider({}), null);
});
test('HTTP rejects client-selected account/environment/amount and disabled purchases', async () => {
  const f = fixture();
  const payments = { catalog: () => [], enabled: false };
  const server = createApi({ ledger: f.ledger, applePurchases: f.apple, payments, clientId: 'test', publicUrl: 'http://127.0.0.1', authenticate: async () => ({ issuer: 'https://auth.1clic.pro', subject: 'test-a' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/v1/apple/claim`;
    for (const extra of [{ account: f.b.id }, { environment: 'Sandbox' }, { documents: 100000 }, { signedTransaction: 'fake' }]) {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transactionId: f.transaction.transactionId, ...extra }) });
      assert.equal(r.status, 400);
    }
    assert.equal(f.calls.length, 0);
    f.apple.enabled = false;
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transactionId: f.transaction.transactionId }) });
    assert.equal(r.status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); f.ledger.close(); }
});
