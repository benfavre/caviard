// Creates (or verifies) the Stripe prices of the website-only annual plans
// (activ #1104). Uses the service's own key and checks it is the account that
// already holds the monthly prices. Prints env lines, never a secret.
import Stripe from 'stripe';
import { WEB_PLANS } from '../electron/commerce-catalog.mjs';
import { stripeLiveMode } from './stripe-mode.mjs';
const env = process.env, key = env.STRIPE_SECRET_KEY;
if (!key) throw Error('STRIPE_SECRET_KEY required');
const live = stripeLiveMode(key, env.INKLURA_PDF_STRIPE_MODE);
if (live && !process.argv.includes('--live')) throw Error('Live setup requires --live');
const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
const ref = await stripe.prices.retrieve(env.INKLURA_PDF_PRICE_BUSINESS_20);
if (ref.metadata?.inkluraProduct !== 'inklura-pdf' || ref.livemode !== live) throw Error('Unexpected Stripe account: no changes made');
for (const plan of WEB_PLANS) {
  const lookup = 'inklura_pdf_' + plan.id.replaceAll('-', '_') + '_v1';
  const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 2 });
  if (found.data.length > 1) throw Error('Ambiguous existing price');
  let price = found.data[0];
  if (!price) {
    const product = await stripe.products.create({ id: lookup, name: 'Inklura PDF · ' + plan.label, description: plan.documents + ' PDF par mois pendant 12 mois, paiement annuel', tax_code: 'txcd_10202003', metadata: { inkluraProduct: 'inklura-pdf', planId: plan.id } }, { idempotencyKey: lookup + ':product' });
    price = await stripe.prices.create({ product: product.id, lookup_key: lookup, currency: 'eur', unit_amount: plan.priceCentsHt, tax_behavior: 'exclusive', recurring: { interval: 'year', interval_count: 1 }, metadata: { inkluraProduct: 'inklura-pdf', planId: plan.id } }, { idempotencyKey: lookup + ':price' });
  }
  if (price.unit_amount !== plan.priceCentsHt || price.currency !== 'eur' || price.tax_behavior !== 'exclusive' || price.recurring?.interval !== 'year' || price.recurring?.interval_count !== 1) throw Error('Existing price differs from approved catalog: ' + plan.id);
  console.log('INKLURA_PDF_PRICE_' + plan.id.replaceAll('-', '_').toUpperCase() + '=' + price.id);
}
