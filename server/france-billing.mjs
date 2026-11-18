import { BillingError } from './ledger.mjs';

export function isMetropolitanFrance(address) {
  return address?.country === 'FR' && /^(?:0[1-9]|[1-8][0-9]|9[0-5])\d{3}$/.test(address?.postal_code || '');
}

export function billingDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['name', 'line1', 'postalCode', 'city', 'country'].includes(key))) throw new BillingError('billing_address_required');
  const clean = key => typeof value[key] === 'string' ? value[key].trim() : '';
  const result = { name: clean('name'), address: { line1: clean('line1'), city: clean('city'), postal_code: clean('postalCode'), country: clean('country') } };
  if (!isMetropolitanFrance(result.address)) throw new BillingError('france_only');
  if ([result.name, result.address.line1, result.address.city].some(text => text.length < 2 || text.length > 150 || /[\x00-\x1f]/.test(text))) throw new BillingError('billing_address_required');
  return result;
}

// Buyer details posted by pdf.inklura.fr/panier with the plan (activ #1104).
// They prefill Stripe Checkout; Stripe still collects and the webhook still
// checks the final billing address. Without them (no JavaScript) the checkout
// works as before.
export const BUYER_FIELDS = ['intent', 'email', 'name', 'company', 'taxId', 'line1', 'postalCode', 'city'];

// Promotion code typed on /panier: Stripe codes are case-insensitive.
export function promoCode(value) {
  const code = (value || '').trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) throw new BillingError('promo_invalid', 404);
  return code;
}
export function webBuyer(form) {
  if (!BUYER_FIELDS.some(key => form.has(key))) return null;
  const get = key => (form.get(key) || '').trim();
  const email = get('email').toLowerCase(), intent = get('intent');
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(email) || email.length > 160) throw new BillingError('invalid_buyer');
  if (intent && !/^[0-9a-f]{36}$/.test(intent)) throw new BillingError('invalid_buyer');
  const person = get('name'), company = get('company');
  if (company.length > 150 || /[\x00-\x1f]/.test(company)) throw new BillingError('invalid_buyer');
  // Optional French VAT number, typed on /panier (Stripe no longer asks for it).
  const taxId = get('taxId').replace(/[\s.-]/g, '').toUpperCase();
  if (taxId && !/^FR[0-9A-Z]{2}\d{9}$/.test(taxId)) throw new BillingError('invalid_buyer');
  const details = billingDetails({ name: company || person, line1: get('line1'), postalCode: get('postalCode').replace(/\s/g, ''), city: get('city'), country: 'FR' });
  return { ...details, email, intent: intent || null, contact: person, company: company || null, taxId: taxId || null };
}
