// App Store Connect products approved by Ben, 30 October 2026.
// Display prices must come from StoreKit, not these reference prices.
export const APPLE_BUNDLE_ID = 'com.benfavre.caviard';
export const APPLE_APP_ID = 6828817692;
export const APPLE_PRODUCTS = Object.freeze([100, 500, 1000].map(documents => Object.freeze({
  id: `${APPLE_BUNDLE_ID}.credits${documents}`, documents,
  label: `${documents.toLocaleString('fr-FR')} exports PDF`, expiresAt: null,
})));
