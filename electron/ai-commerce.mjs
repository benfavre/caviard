// Approved 2026-11-02: separate AI and PDF-export balances.
export const AI_TRIAL_ANALYSES = 10;
export const AI_PLANS = Object.freeze([
  Object.freeze({ id: 'ai-100', label: 'IA · 100 analyses', creditType: 'ai', kind: 'volume', documents: 100,
    priceCentsHt: 500, currency: 'eur', validityMonths: 12 }),
]);
