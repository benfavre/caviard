import { DOCUMENT_PLANS, planById } from '../electron/commerce-catalog.mjs';
import { BillingError, addMonths, operationId } from './ledger.mjs';
import { billingDetails, isMetropolitanFrance } from './france-billing.mjs';
export class Payments {
  constructor({ ledger, stripe, webhookSecret, priceIds = {}, enabled = false, publicUrl, live = false, allowLive = false, portalConfiguration, franceTaxRate }) {
    Object.assign(this, { ledger, stripe, webhookSecret, priceIds, publicUrl, live, portalConfiguration, franceTaxRate });
    this.enabled = enabled && !!stripe && !!webhookSecret && !!franceTaxRate && (!live || allowLive);
  }
  catalog() {
    return DOCUMENT_PLANS.map(plan => ({ ...plan, priceCentsTtc: Math.round(plan.priceCentsHt * 1.2), taxPercent: 20, salesRegion: 'FR-METRO', purchasable: !!(this.enabled && this.priceIds[plan.id]) }));
  }
  async checkout(account, planId, operation, billing) {
    if (!this.enabled) throw new BillingError('purchases_not_enabled', 503);
    operationId(operation);
    const plan = planById(planId), priceId = this.priceIds[planId];
    if (!plan || !priceId) throw new BillingError('offer_not_available', 400);
    if (this.ledger.getAccount(account).blocked) throw new BillingError('account_under_review', 403);
    const details = billingDetails(billing);
    const tax = await this.stripe.taxRates.retrieve(this.franceTaxRate);
    if (!tax.active || tax.country !== 'FR' || tax.percentage !== 20 || tax.inclusive || tax.livemode !== this.live) throw new BillingError('tax_misconfigured', 503);
    const price = await this.stripe.prices.retrieve(priceId);
    if (!price.active || price.currency !== 'eur' || price.unit_amount !== plan.priceCentsHt || price.tax_behavior !== 'exclusive' ||
      (plan.kind === 'subscription' ? price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1 : !!price.recurring)) throw new BillingError('offer_misconfigured', 503);
    const order = this.ledger.transaction(() => this.ledger.createOrder(account, operation, plan));
    operation = order.operation;
    if (order.checkout) {
      const session = await this.stripe.checkout.sessions.retrieve(order.checkout);
      if (session.status === 'expired') this.ledger.db.prepare("UPDATE orders SET state='expired' WHERE checkout=? AND state='pending'").run(session.id);
      if (session.status !== 'open' || !session.url) throw new BillingError('checkout_closed', 409);
      return { url: checkoutUrl(session.url) };
    }
    let customer = this.ledger.getAccount(account).customer;
    if (!customer) {
      const created = await this.stripe.customers.create({ metadata: { inkluraPdfAccount: account } }, { idempotencyKey: 'inklura-pdf:customer:' + account });
      customer = created.id;
      this.ledger.db.prepare('UPDATE accounts SET customer=? WHERE id=?').run(customer, account);
    }
    // The legal billing address is validated here, not inferred from the card's country.
    await this.stripe.customers.update(customer, { ...details, tax_exempt: 'none', invoice_settings: { custom_fields: [
      { name: 'Vendeur', value: 'BEO PLUS / ACTIV communication — 4 allée des Planches, 35740 Pacé' },
      { name: 'SIREN vendeur', value: '790016885' }, { name: 'TVA vendeur', value: 'FR03790016885' },
    ] } });
    const metadata = { inkluraPdfAccount: account, inkluraPdfPlan: plan.id, inkluraPdfOrder: operation };
    const session = await this.stripe.checkout.sessions.create({
      mode: plan.kind === 'subscription' ? 'subscription' : 'payment', customer,
      client_reference_id: account, line_items: [{ price: priceId, quantity: 1, tax_rates: [this.franceTaxRate] }],
      metadata, ...(plan.kind === 'subscription' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      ...(plan.kind === 'volume' ? { invoice_creation: { enabled: true } } : {}),
      success_url: this.publicUrl + '/billing/success', cancel_url: this.publicUrl + '/billing/cancel',
      billing_address_collection: 'required', tax_id_collection: { enabled: true }, payment_method_types: ['card'], locale: 'fr',
      custom_text: { submit: { message: 'Achats réservés à la France métropolitaine. Adresse française obligatoire. TVA 20 %. Un paiement avec une adresse non admissible sera annulé et remboursé, sans ajout de crédits.' } },
      customer_update: { address: 'auto', name: 'auto' }, allow_promotion_codes: false,
    }, { idempotencyKey: 'inklura-pdf:checkout:' + account + ':' + operation });
    this.ledger.db.prepare('UPDATE orders SET checkout=? WHERE account=? AND operation=?').run(session.id, account, operation);
    return { url: checkoutUrl(session.url) };
  }
  async portal(account) {
    if (!this.enabled) throw new BillingError('purchases_not_enabled', 503);
    const customer = this.ledger.getAccount(account).customer;
    if (!customer) throw new BillingError('no_billing_account', 404);
    if (!this.portalConfiguration) throw new BillingError('portal_not_configured', 503);
    const session = await this.stripe.billingPortal.sessions.create({ customer, configuration: this.portalConfiguration, return_url: 'https://outils.inklura.fr/inklura-pdf' });
    const url = new URL(session.url);
    if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new BillingError('invalid_payment_url', 502);
    return { url: url.href };
  }
  async webhook(raw, signature) {
    if (!this.stripe || !this.webhookSecret) throw new BillingError('payments_not_configured', 503);
    let event;
    try { event = this.stripe.webhooks.constructEvent(raw, signature, this.webhookSecret); }
    catch { throw new BillingError('invalid_webhook_signature', 400); }
    if (!!event.livemode !== this.live) throw new BillingError('wrong_payment_environment', 400);
    if (this.ledger.db.prepare('SELECT 1 FROM events WHERE id=?').get(event.id)) return { received: true, duplicate: true };
    const obj = event.data.object;
    let apply = () => {};
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      // Retrieve authoritative state/line items, including delayed payment completion.
      const session = await this.stripe.checkout.sessions.retrieve(obj.id, { expand: ['line_items'] });
      if (!session.metadata?.inkluraPdfAccount) return { received: true, ignored: true };
      const order = this.ledger.db.prepare('SELECT * FROM orders WHERE checkout=?').get(session.id);
      if (!order) throw new BillingError('unknown_checkout', 409);
      const plan = planById(order.plan), owner = this.ledger.getAccount(order.account);
      if (session.customer !== owner.customer || session.client_reference_id !== owner.id ||
          session.metadata?.inkluraPdfOrder !== order.operation || session.metadata?.inkluraPdfAccount !== owner.id) throw new BillingError('checkout_account_mismatch', 400);
      const lines = session.line_items?.data;
      if (session.line_items?.has_more || lines?.length !== 1 || lines[0].quantity !== 1 || lines[0].price?.id !== this.priceIds[plan.id]) throw new BillingError('checkout_price_mismatch', 400);
      const expectedMode = plan.kind === 'volume' ? 'payment' : 'subscription';
      if (session.mode !== expectedMode) throw new BillingError('checkout_mode_mismatch', 400);
      if (session.payment_status === 'paid') {
        if (!isMetropolitanFrance(session.customer_details?.address)) {
          await this.rejectCountry(owner.id, order.operation, session.subscription, session.payment_intent);
          this.ledger.once(event.id, () => {});
          return { received: true, rejected: 'france_only' };
        }
        // Validity begins when payment succeeds, including delayed payments.
        // A second event for the same purchase preserves the original date.
        const starts = this.ledger.db.prepare('SELECT starts FROM grants WHERE id=?').get('checkout:' + session.id)?.starts ?? event.created * 1000;
        apply = () => {
          this.ledger.db.prepare("UPDATE orders SET state='paid',payment_intent=? WHERE checkout=?").run(session.payment_intent || null, session.id);
          if (plan.kind === 'volume') this.ledger.grant({ id: 'checkout:' + session.id, account: owner.id, kind: 'volume', units: plan.documents, starts, ends: addMonths(starts, 12) });
          // Monthly quota is granted only by a paid invoice, never twice at checkout.
        };
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = await this.stripe.invoices.retrieve(obj.id);
      if (invoice.status !== 'paid' || !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) return { received: true, ignored: true };
      const subscriptionId = invoice.parent?.subscription_details?.subscription || invoice.subscription;
      if (typeof subscriptionId !== 'string') throw new BillingError('invalid_subscription', 400);
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const { inkluraPdfAccount: accountId, inkluraPdfOrder: operation, inkluraPdfPlan: planId } = subscription.metadata || {};
      if (!accountId) return { received: true, ignored: true };
      const plan = planById(planId), owner = this.ledger.getAccount(accountId);
      const order = this.ledger.db.prepare('SELECT * FROM orders WHERE account=? AND operation=?').get(accountId, operation);
      if (!plan || plan.kind !== 'subscription' || order?.plan !== planId || owner.customer !== invoice.customer || owner.customer !== subscription.customer) throw new BillingError('invoice_account_mismatch', 400);
      const lines = invoice.lines?.data?.filter(line => (line.pricing?.price_details?.price || line.price?.id) === this.priceIds[planId]);
      if (invoice.lines?.has_more || lines?.length !== 1 || lines[0].quantity !== 1 || lines[0].proration || lines[0].parent?.subscription_item_details?.proration) throw new BillingError('invoice_price_mismatch', 400);
      if (!isMetropolitanFrance(invoice.customer_address)) {
        await this.rejectCountry(owner.id, operation, subscriptionId, null, invoice.id);
        this.ledger.once(event.id, () => {});
        return { received: true, rejected: 'france_only' };
      }
      const period = lines[0].period, starts = period?.start * 1000, ends = period?.end * 1000;
      if (!Number.isSafeInteger(starts) || !Number.isSafeInteger(ends) || ends <= starts || ends - starts > 32 * 86400000) throw new BillingError('invalid_invoice_period', 400);
      apply = () => {
        this.ledger.grant({ id: 'subscription:' + subscriptionId + ':' + period.start + ':' + period.end, account: owner.id, kind: 'subscription', units: plan.documents, starts, ends });
        if (subscription.status !== 'canceled') this.ledger.db.prepare('UPDATE accounts SET subscription=? WHERE id=?').run(subscriptionId, owner.id);
        this.ledger.db.prepare("UPDATE orders SET state='paid' WHERE account=? AND operation=?").run(owner.id, operation);
      };
    } else if (event.type === 'checkout.session.expired') {
      apply = () => this.ledger.db.prepare("UPDATE orders SET state='expired' WHERE checkout=? AND state='pending'").run(obj.id);
    } else if (event.type === 'customer.subscription.deleted') {
      apply = () => this.ledger.db.prepare('UPDATE accounts SET subscription=NULL WHERE subscription=?').run(obj.id);
    } else if (['charge.refunded', 'charge.dispute.created'].includes(event.type)) {
      // Pause consumption on a refund/dispute. Do not invent negative credits or
      // automatically unlock spent grants; reconcile with the operator first.
      const charge = event.type === 'charge.refunded' ? obj : await this.stripe.charges.retrieve(obj.charge);
      apply = () => this.ledger.db.prepare('UPDATE accounts SET blocked=1 WHERE customer=?').run(charge.customer);
    }
    this.ledger.once(event.id, apply);
    return { received: true };
  }
  async rejectCountry(account, operation, subscription, paymentIntent, invoiceId) {
    // No credits can be consumed while a rejected payment is being reconciled.
    this.ledger.db.prepare('UPDATE accounts SET blocked=1 WHERE id=?').run(account);
    if (subscription) {
      const current = await this.stripe.subscriptions.retrieve(subscription);
      if (current.status !== 'canceled') await this.stripe.subscriptions.cancel(subscription, { prorate: false, invoice_now: false });
      invoiceId ||= typeof current.latest_invoice === 'string' ? current.latest_invoice : current.latest_invoice?.id;
    }
    const intents = new Set(paymentIntent ? [paymentIntent] : []);
    if (invoiceId) {
      for await (const payment of this.stripe.invoicePayments.list({ invoice: invoiceId, status: 'paid', limit: 100 })) {
        if (payment.payment?.type === 'payment_intent') intents.add(typeof payment.payment.payment_intent === 'string' ? payment.payment.payment_intent : payment.payment.payment_intent?.id);
      }
    }
    if (!intents.size) throw new BillingError('country_refund_pending', 503);
    for (const id of intents) {
      if (!id) throw new BillingError('country_refund_pending', 503);
      const refund = await this.stripe.refunds.create({ payment_intent: id, metadata: { inkluraPdfCountryRejection: 'true' } }, { idempotencyKey: 'inklura-pdf:country-refund:' + id });
      if (['failed', 'canceled'].includes(refund.status)) throw new BillingError('country_refund_pending', 503);
    }
    this.ledger.db.prepare("UPDATE orders SET state='country_rejected' WHERE account=? AND operation=?").run(account, operation);
    this.ledger.db.prepare('UPDATE accounts SET subscription=NULL WHERE id=?').run(account);
  }
}
function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new BillingError('invalid_payment_url', 502);
  return url.href;
}
