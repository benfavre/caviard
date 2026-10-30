import { BillingError } from './ledger.mjs';

// Durable PDF-only erasure. No requests go to the shared identity service.
// Freezing happens before any network call; transient Stripe failures leave a
// job that is retried on restart and every minute, never a false success.
export class AccountDeletion {
  constructor({ ledger, payments }) {
    Object.assign(this, { ledger, payments });
    this.running = null;
  }
  request(issuer, subject, confirmation) {
    if (confirmation !== 'SUPPRIMER MON COMPTE PDF') throw new BillingError('deletion_confirmation_required');
    const prior = this.ledger.deletionForIdentity(issuer, subject);
    if (prior) return { state: prior.completed !== null ? 'deleted' : 'pending' };
    this.ledger.requestDeletion(this.ledger.account(issuer, subject).id);
    return { state: 'pending' };
  }
  async erase(account) {
    const sources = this.ledger.db.prepare('SELECT source FROM account_deletion_sources WHERE account=?').all(account);
    for (const { source } of sources) {
      // Includes a Checkout that was already awaiting Stripe when deletion was
      // requested. After a restart, Stripe enumeration covers ambiguous replies.
      await this.payments.drainCheckouts(source);
      const owner = this.ledger.getAccount(source);
      if (!owner.customer) continue;
      const stripe = this.payments.stripe;
      if (!stripe) throw new BillingError('payments_not_configured', 503);
      for await (const session of stripe.checkout.sessions.list({ customer: owner.customer, status: 'open', limit: 100 })) {
        if (session.metadata?.inkluraPdfAccount !== source) continue;
        if (session.client_reference_id !== source) throw new BillingError('checkout_account_mismatch');
        await stripe.checkout.sessions.expire(session.id);
        this.ledger.db.prepare("UPDATE orders SET state='expired' WHERE checkout=? AND state='pending'").run(session.id);
      }
      for await (const subscription of stripe.subscriptions.list({ customer: owner.customer, status: 'all', limit: 100 })) {
        if (subscription.metadata?.inkluraPdfAccount !== source || ['canceled', 'incomplete_expired'].includes(subscription.status)) continue;
        // Do not cancel another product sharing a Stripe customer.
        const order = this.ledger.db.prepare('SELECT plan FROM orders WHERE account=? AND operation=?').get(source, subscription.metadata.inkluraPdfOrder);
        if (!order || order.plan !== subscription.metadata.inkluraPdfPlan) throw new BillingError('invoice_account_mismatch');
        await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
      }
    }
    this.ledger.completeDeletion(account);
  }
  run() {
    if (this.running) return this.running;
    this.running = (async () => {
      const jobs = this.ledger.db.prepare('SELECT account FROM account_deletions WHERE completed IS NULL ORDER BY requested LIMIT 50').all();
      for (const job of jobs) {
        try { await this.erase(job.account); }
        catch { /* Persisted pending state; retry without logging identities or provider responses. */ }
      }
    })().finally(() => { this.running = null; });
    return this.running;
  }
}
