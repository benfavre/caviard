import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppleStore } from '../../electron/apple-purchases.mjs';
import { APPLE_PRODUCTS } from '../../electron/apple-catalog.mjs';

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'inklura-apple-'));
  const storeKit = new EventEmitter(), finish = [], requests = [], purchases = [];
  storeKit.canMakePayments = () => true;
  storeKit.getProducts = async () => APPLE_PRODUCTS.map(p => ({ productIdentifier: p.id, formattedPrice: p.id.endsWith('100') ? '34,90 €' : 'Prix Apple' }));
  storeKit.purchaseProduct = async (...args) => { purchases.push(args); return true; };
  storeKit.finishTransactionByDate = date => finish.push(date);
  const account = { account: { accountId: 'owner-a', applePurchasesEnabled: true }, generation: 1, refresh: async () => {},
    request: async (url, body) => { requests.push({ url, body }); return url.endsWith('/prepare') ? { productId: body.productId, appAccountToken: '4a5ec122-bd9e-44bc-8587-888435eb7000' } : { transactionId: body.transactionId, state: 'credited' }; } };
  const options = { directory, storeKit, account: () => account };
  const apple = new AppleStore(options);
  const transaction = (id = '2000000001', date = '2026-10-30T12:00:00Z') => ({ transactionIdentifier: id, transactionDate: date, transactionState: 'purchased', payment: { productIdentifier: APPLE_PRODUCTS[0].id } });
  return { directory, storeKit, account, options, apple, finish, requests, purchases, transaction, cleanup: async () => { apple.dispose(); await rm(directory, { recursive: true, force: true }); } };
}
test('purchase uses StoreKit localized price, one unit, and server-generated account token', async () => {
  const f = await fixture(); try {
    await f.apple.refreshProducts();
    assert.equal(f.apple.snapshot().products[0].formattedPrice, '34,90 €');
    assert.equal((await f.apple.purchase(APPLE_PRODUCTS[0].id)).queued, true);
    assert.deepEqual(f.purchases, [[APPLE_PRODUCTS[0].id, { quantity: 1, username: '4a5ec122-bd9e-44bc-8587-888435eb7000' }]]);
    assert.equal(f.finish.length, 0); // queued is not paid or credited
    await assert.rejects(f.apple.purchase(APPLE_PRODUCTS[0].id), /en attente/);
  } finally { await f.cleanup(); }
});
test('server outage retains a purchase on disk and never acknowledges it to Apple', async () => {
  const f = await fixture(); try {
    f.account.request = async () => { throw Error('offline'); };
    f.storeKit.emit('transactions-updated', {}, [f.transaction()]); await f.apple.queue;
    assert.equal(f.finish.length, 0);
    assert.equal(JSON.parse(await readFile(path.join(f.directory, 'pending.json'))).length, 1);
    f.apple.dispose();
    f.account.request = async (_url, body) => ({ transactionId: body.transactionId, state: 'credited' });
    const reopened = new AppleStore(f.options);
    await reopened.reconcile();
    assert.deepEqual(f.finish, ['2026-10-30T12:00:00Z']);
    assert.equal(reopened.snapshot().pending, false);
    reopened.dispose();
  } finally { await f.cleanup(); }
});
test('all transactions sharing an Electron finish date must be credited first', async () => {
  const f = await fixture(); try {
    f.account.request = async (_url, body) => { if (body.transactionId.endsWith('2')) throw Error('offline'); return { transactionId: body.transactionId, state: 'credited' }; };
    f.storeKit.emit('transactions-updated', {}, [f.transaction('1'), f.transaction('2')]); await f.apple.queue;
    assert.equal(f.finish.length, 0);
    f.account.request = async (_url, body) => ({ transactionId: body.transactionId, state: 'credited' });
    await f.apple.reconcile();
    assert.equal(f.finish.length, 1);
  } finally { await f.cleanup(); }
});
test('cancellation sharing a date with a paid transaction cannot discard the paid transaction', async () => {
  const f = await fixture(); try {
    f.account.request = async () => { throw Error('offline'); };
    f.storeKit.emit('transactions-updated', {}, [{ ...f.transaction('1'), transactionState: 'failed', errorCode: 2 }, f.transaction('2')]); await f.apple.queue;
    assert.equal(f.finish.length, 0);
    assert.equal(f.apple.pending.length, 1);
  } finally { await f.cleanup(); }
});
test('account change while preparing a purchase prevents adding it to the payment queue', async () => {
  const f = await fixture(); try {
    await f.apple.refreshProducts();
    f.account.request = async () => { f.account.generation++; return {}; };
    await assert.rejects(f.apple.purchase(APPLE_PRODUCTS[0].id), /compte a changé/);
    assert.equal(f.purchases.length, 0);
  } finally { await f.cleanup(); }
});
test('transaction arriving while signed out waits for authenticated recovery', async () => {
  const f = await fixture(); try {
    f.account.account = null;
    f.storeKit.emit('transactions-updated', {}, [f.transaction()]); await f.apple.queue;
    assert.equal(f.requests.length, 0);
    assert.equal(f.finish.length, 0);
    f.account.account = { accountId: 'owner-a', applePurchasesEnabled: true };
    await f.apple.reconcile();
    assert.equal(f.finish.length, 1);
  } finally { await f.cleanup(); }
});
