// Approved document quotas. Prices are deliberately not configured in the app.
export const TRIAL_DOCUMENTS = 20;
export const DOCUMENT_PLANS = Object.freeze([
  { id: 'volume-100', label: 'Volume 100', kind: 'volume', documents: 100, validityMonths: 12 },
  { id: 'volume-500', label: 'Volume 500', kind: 'volume', documents: 500, validityMonths: 12 },
  { id: 'volume-1000', label: 'Volume 1 000', kind: 'volume', documents: 1000, validityMonths: 12 },
  { id: 'business-20', label: 'Entreprise 20', kind: 'subscription', documents: 20, interval: 'month' },
  { id: 'business-100', label: 'Entreprise 100', kind: 'subscription', documents: 100, interval: 'month' },
  { id: 'business-500', label: 'Entreprise 500', kind: 'subscription', documents: 500, interval: 'month' },
].map(Object.freeze));
export function planById(id) { return DOCUMENT_PLANS.find(plan => plan.id === id); }
