import { EventEmitter } from 'node:events';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { APPLE_PRODUCTS } from './apple-catalog.mjs';

// StoreKit owns the durable payment queue. This private local journal additionally
// keeps successful transactions until the server acknowledges their credit grant.
export class AppleStore extends EventEmitter {
  constructor({ storeKit, account, directory }) {
    super(); Object.assign(this, { storeKit, account, directory });
    this.products = []; this.pending = []; this.requested = false; this.message = '';
    this.queue = Promise.resolve(); this.loaded = false;
    this.listener = (_event, transactions) => {
      void this.exclusive(async () => {
        await this.load();
        const failedDates = new Set(), unknownDates = new Set();
        for (const t of transactions) {
          if (!APPLE_PRODUCTS.some(p => p.id === t.payment?.productIdentifier)) { unknownDates.add(t.transactionDate); continue; }
          if (t.transactionState === 'failed') {
            this.requested = false;
            this.message = t.errorCode === 2 ? 'Achat annulé. Aucun crédit ajouté.' : 'L’achat Apple n’a pas abouti. Réessayez depuis les offres.';
            // Never finish all transactions: another purchase may not be credited.
            if (t.transactionDate) failedDates.add(t.transactionDate);
          } else if (t.transactionState === 'deferred') {
            this.requested = true; this.message = 'Achat en attente d’autorisation Apple.';
          } else if (t.transactionState === 'purchasing') {
            this.requested = true;
          } else if (['purchased', 'restored'].includes(t.transactionState)) {
            const id = t.transactionState === 'restored' ? t.originalTransactionIdentifier : t.transactionIdentifier;
            if (!/^[0-9]{1,40}$/.test(id || '') || !t.transactionDate) continue;
            if (!this.pending.some(p => p.id === id)) this.pending.push({ id, date: t.transactionDate, productId: t.payment.productIdentifier, settled: false });
            this.requested = false;
          }
        }
        await this.persist();
        for (const date of failedDates) {
          if (!unknownDates.has(date) && !this.pending.some(p => p.date === date)) this.storeKit.finishTransactionByDate(date);
        }
        await this.reconcileUnlocked();
        this.publish();
      }).catch(() => { this.message = 'Votre achat reste en attente. Reconnectez-vous puis cliquez sur Actualiser.'; this.publish(); });
    };
    storeKit.on('transactions-updated', this.listener);
  }
  exclusive(fn) { const result = this.queue.then(fn); this.queue = result.catch(() => {}); return result; }
  async load() {
    if (this.loaded) return;
    try {
      const data = await readFile(path.join(this.directory, 'pending.json'), 'utf8');
      if (data.length > 1024 * 1024) throw new Error('Journal Apple trop volumineux.');
      const pending = JSON.parse(data);
      if (!Array.isArray(pending) || pending.some(p => !/^[0-9]{1,40}$/.test(p.id || '') || typeof p.date !== 'string')) throw new Error('Journal Apple invalide.');
      this.pending = pending;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.loaded = true;
  }
  async persist() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const tmp = path.join(this.directory, randomUUID() + '.tmp');
    await writeFile(tmp, JSON.stringify(this.pending), { mode: 0o600, flag: 'wx' });
    await rename(tmp, path.join(this.directory, 'pending.json'));
  }
  snapshot() {
    return { products: this.products, pending: this.requested || this.pending.length > 0, message: this.message,
      enabled: !!this.account()?.account?.applePurchasesEnabled && this.storeKit.canMakePayments() };
  }
  publish() { this.emit('state'); return this.snapshot(); }
  async refreshProducts() {
    if (!this.account()?.account?.applePurchasesEnabled) { this.products = []; return this.publish(); }
    try {
      const products = await this.storeKit.getProducts(APPLE_PRODUCTS.map(p => p.id));
      this.products = APPLE_PRODUCTS.flatMap(p => {
        const found = products.find(product => product.productIdentifier === p.id);
        return found && typeof found.formattedPrice === 'string' ? [{ ...p, formattedPrice: found.formattedPrice }] : [];
      });
    } catch { this.products = []; this.message = 'Les offres Apple sont momentanément indisponibles.'; }
    return this.publish();
  }
  async purchase(productId) {
    if (this.snapshot().pending) throw new Error('Actualisez votre achat en attente avant d’en lancer un autre.');
    const account = this.account(), owner = account?.account?.accountId, generation = account?.generation;
    if (!owner || !this.snapshot().enabled || !this.products.some(p => p.id === productId)) throw new Error('Connectez-vous puis actualisez les offres Apple.');
    this.requested = true; this.message = ''; this.publish();
    try {
      const intent = await account.request('/v1/apple/prepare', { productId });
      if (account.generation !== generation || account.account?.accountId !== owner) throw new Error('Le compte a changé. Relancez l’achat.');
      if (intent.productId !== productId || !/^[a-f0-9-]{36}$/i.test(intent.appAccountToken || '')) throw new Error('Réponse Apple invalide.');
      const queued = await this.storeKit.purchaseProduct(productId, { quantity: 1, username: intent.appAccountToken });
      if (!queued) throw new Error('Cette offre Apple est momentanément indisponible.');
      return { queued: true };
    } catch (error) { this.requested = false; this.publish(); throw error; }
  }
  async reconcileUnlocked() {
    const account = this.account();
    if (!account?.account?.accountId) return;
    const generation = account.generation;
    for (const item of this.pending) {
      if (account.generation !== generation) return;
      if (item.settled) continue;
      try {
        const result = await account.request('/v1/apple/claim', { transactionId: item.id });
        if (result.transactionId !== item.id || !['credited', 'revoked'].includes(result.state)) throw new Error('Unconfirmed');
        item.settled = true;
        await this.persist();
      } catch {
        this.message = 'Un achat Apple attend sa synchronisation. Connectez-vous au compte utilisé lors de l’achat puis cliquez sur Actualiser.';
      }
    }
    // Electron finishes by date, not ID. Settle every observed transaction with
    // the same date before acknowledging that group to StoreKit.
    let finished = false;
    for (const date of new Set(this.pending.map(p => p.date))) {
      const group = this.pending.filter(p => p.date === date);
      if (!group.every(p => p.settled)) continue;
      this.storeKit.finishTransactionByDate(date);
      finished = true;
      this.pending = this.pending.filter(p => p.date !== date);
      await this.persist();
    }
    if (finished && !this.pending.length && !this.requested) this.message = '';
    await account.refresh().catch(() => {});
  }
  reconcile() { return this.exclusive(async () => { await this.load(); await this.reconcileUnlocked(); return this.publish(); }); }
  dispose() { this.storeKit.removeListener('transactions-updated', this.listener); this.removeAllListeners(); }
}
