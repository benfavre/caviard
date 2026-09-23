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
