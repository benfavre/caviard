import { DOCUMENT_PLANS, planById, periodMonths } from '../electron/commerce-catalog.mjs';
import { BillingError, addMonths, operationId } from './ledger.mjs';
import { billingDetails, isMetropolitanFrance, promoCode } from './france-billing.mjs';
export class Payments {
  constructor({ ledger, stripe, webhookSecret, priceIds = {}, enabled = false, publicUrl, live = false, allowLive = false, portalConfiguration, franceTaxRate }) {
    Object.assign(this, { ledger, stripe, webhookSecret, priceIds, publicUrl, live, portalConfiguration, franceTaxRate });
    this.enabled = enabled && !!stripe && !!webhookSecret && !!franceTaxRate && (!live || allowLive);
  }
  catalog() {
    return DOCUMENT_PLANS.map(plan => ({ ...plan, priceCentsTtc: Math.round(plan.priceCentsHt * 1.2), taxPercent: 20, salesRegion: 'FR-METRO', purchasable: !!(this.enabled && this.priceIds[plan.id]) }));
  }
  async checkout(account, planId, operation, billing, web = {}) {
    if (!this.enabled) throw new BillingError('purchases_not_enabled', 503);
    operationId(operation);
    const plan = planById(planId), priceId = this.priceIds[planId];
    if (!plan || !priceId) throw new BillingError('offer_not_available', 400);
    if (this.ledger.isBlocked(account)) throw new BillingError('account_under_review', 403);
    // Website: the /panier details (name, address, e-mail) are stored on the
    // customer and Stripe does not ask for them again (activ #1105); the webhook
    // checks that stored address. Without them (no JavaScript) Stripe collects them.
    const buyer = web.website ? web.buyer || null : null;
    const details = web.website ? (buyer ? { name: buyer.name, address: buyer.address, email: buyer.email } : {}) : billingDetails(billing);
    const tax = await this.stripe.taxRates.retrieve(this.franceTaxRate);
    if (!tax.active || tax.country !== 'FR' || tax.percentage !== 20 || tax.inclusive || tax.livemode !== this.live) throw new BillingError('tax_misconfigured', 503);
    const price = await this.stripe.prices.retrieve(priceId);
    if (!price.active || price.currency !== 'eur' || price.unit_amount !== plan.priceCentsHt || price.tax_behavior !== 'exclusive' ||
      (plan.kind === 'subscription' ? price.recurring?.interval !== (plan.interval || 'month') || price.recurring?.interval_count !== 1 : !!price.recurring)) throw new BillingError('offer_misconfigured', 503);
    // A code typed on /panier is applied to the session; without one, the
    // Stripe page still accepts a code.
    const promo = web.website && web.promo ? await this.promotion(planId, web.promo, price) : null;
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
      { name: 'Vendeur', value: 'BEO PLUS / ACTIV communication — 3 allée de la grande Egalonne, 35740 Pacé' },
      { name: 'SIREN vendeur', value: '790016885' }, { name: 'TVA vendeur', value: 'FR03790016885' },
    ] } });
    const metadata = { inkluraPdfAccount: account, inkluraPdfPlan: plan.id, inkluraPdfOrder: operation, ...(buyer ? { inkluraPdfBuyer: '1' } : {}), ...(buyer?.intent ? { inkluraPdfIntent: buyer.intent } : {}), ...(promo ? { inkluraPdfPromo: promo.code } : {}) };
    const session = await this.stripe.checkout.sessions.create({
      mode: plan.kind === 'subscription' ? 'subscription' : 'payment', customer,
      client_reference_id: account, line_items: [{ price: priceId, quantity: 1, tax_rates: [this.franceTaxRate] }],
      metadata, ...(plan.kind === 'subscription' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      // No Stripe invoice for packs: ACTIV's invoice comes from Manage (tools/sync-pdf-sales.ts).
      success_url: web.website ? web.successUrl : this.publicUrl + '/billing/success', cancel_url: web.website ? 'https://pdf.inklura.fr/tarifs?checkout=cancel' : this.publicUrl + '/billing/cancel',
      billing_address_collection: buyer ? 'auto' : 'required', ...(buyer ? {} : { tax_id_collection: { enabled: true } }), payment_method_types: ['card'], locale: 'fr',
      custom_text: { submit: { message: buyer ? 'Votre facture est établie avec les coordonnées de votre commande. Achats réservés à la France métropolitaine, TVA 20 %.' : 'Achats réservés à la France métropolitaine. Adresse française obligatoire. TVA 20 %. Un paiement avec une adresse non admissible sera annulé et remboursé, sans ajout de crédits.' } },
      ...(buyer ? {} : { customer_update: { address: 'auto', name: 'auto' } }), ...(promo ? { discounts: [{ promotion_code: promo.promotionCode }] } : { allow_promotion_codes: true }),
    }, { idempotencyKey: 'inklura-pdf:checkout:' + account + ':' + operation });
    this.ledger.db.prepare('UPDATE orders SET checkout=? WHERE account=? AND operation=?').run(session.id, account, operation);
    return { url: checkoutUrl(session.url) };
  }
  /** Checks a promotion code for an offer and returns the discounted totals (cents). */
  async promotion(planId, value, price = null) {
    if (!this.enabled) throw new BillingError('purchases_not_enabled', 503);
    const plan = planById(planId), priceId = this.priceIds[planId];
    if (!plan || !priceId) throw new BillingError('offer_not_available', 400);
    const code = promoCode(value);
    if (!code) throw new BillingError('promo_invalid', 404);
    const found = (await this.stripe.promotionCodes.list({ code, active: true, limit: 1 })).data?.[0];
    const now = Math.floor(Date.now() / 1000);
    if (!found || found.code.toUpperCase() !== code || found.customer || (found.expires_at && found.expires_at <= now) ||
      (found.max_redemptions && found.times_redeemed >= found.max_redemptions)) throw new BillingError('promo_invalid', 404);
    const couponRef = found.promotion?.coupon ?? found.coupon;
    const coupon = await this.stripe.coupons.retrieve(typeof couponRef === 'string' ? couponRef : couponRef?.id, { expand: ['applies_to'] });
    price ||= await this.stripe.prices.retrieve(priceId);
    const products = coupon?.applies_to?.products;
    if (!coupon?.valid || (products && !products.includes(typeof price.product === 'string' ? price.product : price.product?.id))) throw new BillingError('promo_not_applicable', 409);
    if (coupon.amount_off && coupon.currency !== 'eur') throw new BillingError('promo_not_applicable', 409);
    const minimum = found.restrictions?.minimum_amount;
    if (minimum && plan.priceCentsHt < minimum) throw new BillingError('promo_not_applicable', 409);
    const subtotal = plan.priceCentsHt;
    const discount = Math.min(subtotal, coupon.percent_off ? Math.round(subtotal * coupon.percent_off / 100) : coupon.amount_off || 0);
    if (discount <= 0) throw new BillingError('promo_not_applicable', 409);
    const net = subtotal - discount, tax = Math.round(net * 0.2);
    return {
      code, promotionCode: found.id, percentOff: coupon.percent_off ?? null, amountOff: coupon.amount_off ?? null,
      duration: coupon.duration, durationInMonths: coupon.duration_in_months ?? null,
      subtotalCentsHt: subtotal, discountCentsHt: discount, totalCentsHt: net, taxCents: tax, totalCentsTtc: net + tax, free: net === 0,
    };
  }
  async portal(account, website = false) {
    if (!this.enabled) throw new BillingError('purchases_not_enabled', 503);
    const customer = (website ? [account] : this.ledger.sources(account)).map(id => this.ledger.getAccount(id)).sort((a, b) => Number(!!b.subscription) - Number(!!a.subscription)).find(a => a.customer)?.customer;
    if (!customer) throw new BillingError('no_billing_account', 404);
    if (!this.portalConfiguration) throw new BillingError('portal_not_configured', 503);
    const session = await this.stripe.billingPortal.sessions.create({ customer, configuration: this.portalConfiguration, return_url: website ? 'https://manage.inklura.fr/pdf/billing' : 'https://pdf.inklura.fr/' });
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
      const noCharge = ['paid', 'no_payment_required'].includes(session.payment_status) && session.amount_total === 0 && session.status === 'complete';
      if (session.payment_status === 'paid' || noCharge) {
        // /panier buyers: Stripe only collects what the card needs, the billing
        // identity is the one stored on the customer at checkout.
        let details = session.customer_details || {};
        if (session.metadata?.inkluraPdfBuyer === '1') {
          const customer = await this.stripe.customers.retrieve(session.customer);
          details = { ...details, name: customer.name || details.name, email: customer.email || details.email, address: customer.address };
        }
        if (!isMetropolitanFrance(details.address)) {
          await this.rejectCountry(owner.id, order.operation, session.subscription, session.payment_intent, null, noCharge);
          this.ledger.once(event.id, () => {});
          return { received: true, rejected: 'france_only' };
        }
        // Validity begins when payment succeeds, including delayed payments.
        // A second event for the same purchase preserves the original date.
        const starts = this.ledger.db.prepare('SELECT starts FROM grants WHERE id=?').get('checkout:' + session.id)?.starts ?? event.created * 1000;
        // The code shown on the Manage invoice: from /panier, or typed on the Stripe page.
        let promoCode = session.metadata?.inkluraPdfPromo || null;
        if (!promoCode && session.total_details?.amount_discount > 0) {
          try { promoCode = (await this.stripe.checkout.sessions.retrieve(session.id, { expand: ['discounts.promotion_code'] })).discounts?.find(d => d.promotion_code?.code)?.promotion_code.code || null; } catch {}
        }
        apply = () => {
          this.ledger.db.prepare("UPDATE orders SET state='paid',payment_intent=? WHERE checkout=?").run(session.payment_intent || null, session.id);
          if (plan.kind === 'volume') this.ledger.grant({ id: 'checkout:' + session.id, account: owner.id, kind: 'volume', units: plan.documents, starts, ends: addMonths(starts, 12) });
          this.ledger.recordSale({ id: 'checkout:' + session.id, kind: 'first', account: owner.id, operation: order.operation, plan: plan.id,
            amountTotal: session.amount_total, amountTax: session.total_details?.amount_tax ?? null, currency: session.currency,
            name: details.name, email: details.email, address: details.address, taxId: details.tax_ids?.[0]?.value ?? null, customer: session.customer,
            invoice: typeof session.invoice === 'string' ? session.invoice : session.invoice?.id, subscription: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
            paymentIntent: session.payment_intent || null, periodStart: starts, periodEnd: addMonths(starts, plan.kind === 'volume' ? 12 : periodMonths(plan)),
            amountSubtotal: session.amount_subtotal ?? null, amountDiscount: session.total_details?.amount_discount ?? 0, promoCode });
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
        await this.rejectCountry(owner.id, operation, subscriptionId, null, invoice.id, invoice.amount_paid === 0 && invoice.amount_due === 0);
        this.ledger.once(event.id, () => {});
        return { received: true, rejected: 'france_only' };
      }
      const period = lines[0].period, starts = period?.start * 1000, ends = period?.end * 1000;
      const months = periodMonths(plan);
      if (!Number.isSafeInteger(starts) || !Number.isSafeInteger(ends) || ends <= starts || ends - starts > months * 31 * 86400000 + 86400000) throw new BillingError('invalid_invoice_period', 400);
      apply = () => {
        const base = 'subscription:' + subscriptionId + ':' + period.start + ':' + period.end;
        if (months === 1) this.ledger.grant({ id: base, account: owner.id, kind: 'subscription', units: plan.documents, starts, ends });
        // An annual invoice pays for 12 monthly quotas: one grant per month of the
        // paid year, each usable only during its own month (no carry-over).
        else for (let k = 0; k < months; k++) {
          const from = addMonths(starts, k), to = k === months - 1 ? ends : Math.min(addMonths(starts, k + 1), ends);
          if (to > from) this.ledger.grant({ id: base + ':m' + k, account: owner.id, kind: 'subscription', units: plan.documents, starts: from, ends: to });
        }
        if (subscription.status !== 'canceled') this.ledger.db.prepare('UPDATE accounts SET subscription=? WHERE id=?').run(subscriptionId, owner.id);
        this.ledger.db.prepare("UPDATE orders SET state='paid' WHERE account=? AND operation=?").run(owner.id, operation);
        // The first period is recorded from checkout.session.completed.
        if (invoice.billing_reason === 'subscription_cycle') this.ledger.recordSale({ id: 'invoice:' + invoice.id, kind: 'renewal', account: owner.id, operation, plan: plan.id,
          amountTotal: invoice.total, amountTax: Number.isSafeInteger(invoice.total_excluding_tax) ? invoice.total - invoice.total_excluding_tax : null, currency: invoice.currency,
          name: invoice.customer_name, email: invoice.customer_email, address: invoice.customer_address, customer: invoice.customer,
          invoice: invoice.id, subscription: subscriptionId, periodStart: starts, periodEnd: ends,
          amountSubtotal: invoice.subtotal ?? null, amountDiscount: (invoice.total_discount_amounts || []).reduce((sum, d) => sum + (d.amount || 0), 0) });
      };
    } else if (event.type === 'checkout.session.expired') {
      apply = () => this.ledger.db.prepare("UPDATE orders SET state='expired' WHERE checkout=? AND state='pending'").run(obj.id);
    } else if (event.type === 'customer.subscription.deleted') {
      apply = () => {
        this.ledger.db.prepare('UPDATE accounts SET subscription=NULL WHERE subscription=?').run(obj.id);
        // The invoicing worker stops the matching Manage schedule.
        const sold = this.ledger.db.prepare('SELECT account,operation,plan FROM sales WHERE subscription=? ORDER BY seq LIMIT 1').get(obj.id);
        if (sold) this.ledger.recordSale({ id: 'cancel:' + obj.id, kind: 'cancel', account: sold.account, operation: sold.operation, plan: sold.plan, subscription: obj.id,
          customer: typeof obj.customer === 'string' ? obj.customer : null, periodEnd: Number.isSafeInteger(obj.ended_at) ? obj.ended_at * 1000 : null });
      };
    } else if (['charge.refunded', 'charge.dispute.created'].includes(event.type)) {
      // Pause consumption on a refund/dispute. Do not invent negative credits or
      // automatically unlock spent grants; reconcile with the operator first.
      const charge = event.type === 'charge.refunded' ? obj : await this.stripe.charges.retrieve(obj.charge);
      apply = () => this.ledger.db.prepare('UPDATE accounts SET blocked=1 WHERE customer=?').run(charge.customer);
    }
    this.ledger.once(event.id, apply);
    return { received: true };
  }
  async rejectCountry(account, operation, subscription, paymentIntent, invoiceId, noCharge = false) {
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
    if (!intents.size && !noCharge) throw new BillingError('country_refund_pending', 503);
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
