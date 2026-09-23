// Legacy Stripe keys have no environment prefix. Never infer "test" from
// an unrecognised key: that would bypass the separate live activation flag.
export function stripeLiveMode(key, mode) {
  if (mode && !['live', 'test'].includes(mode)) throw Error('Invalid INKLURA_PDF_STRIPE_MODE');
  if (!key) return false;
  const detected = /^(sk|rk)_(live|test)_/.exec(key)?.[2];
  if (detected && mode && detected !== mode) throw Error('Stripe key and configured mode disagree');
  const resolved = detected || mode;
  if (!resolved) throw Error('Legacy Stripe key requires explicit INKLURA_PDF_STRIPE_MODE');
  return resolved === 'live';
}
