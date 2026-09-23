// Document quotas and EUR prices excluding tax approved on 2026-09-23.
export const TRIAL_DOCUMENTS = 20;
export const DOCUMENT_PLANS = Object.freeze([
  { id: 'volume-100', priceCentsHt: 2900, currency: 'eur', label: 'Volume 100', kind: 'volume', documents: 100, validityMonths: 12 },
  { id: 'volume-500', priceCentsHt: 9900, currency: 'eur', label: 'Volume 500', kind: 'volume', documents: 500, validityMonths: 12 },
  { id: 'volume-1000', priceCentsHt: 14900, currency: 'eur', label: 'Volume 1 000', kind: 'volume', documents: 1000, validityMonths: 12 },
  { id: 'business-20', priceCentsHt: 490, currency: 'eur', label: 'Entreprise 20', kind: 'subscription', documents: 20, interval: 'month' },
  { id: 'business-100', priceCentsHt: 1490, currency: 'eur', label: 'Entreprise 100', kind: 'subscription', documents: 100, interval: 'month' },
  { id: 'business-500', priceCentsHt: 3990, currency: 'eur', label: 'Entreprise 500', kind: 'subscription', documents: 500, interval: 'month' },
].map(Object.freeze));
export function planById(id) { return DOCUMENT_PLANS.find(plan => plan.id === id); }
