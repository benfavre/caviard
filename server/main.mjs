import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { stripeLiveMode } from './stripe-mode.mjs';
import { Ledger } from './ledger.mjs';
import { Payments } from './payments.mjs';
import { createAuthenticator } from './auth.mjs';
import { WebPurchases } from './web-purchases.mjs';
import { createApi } from './http.mjs';
import { ALL_PLANS } from '../electron/commerce-catalog.mjs';
import { ApplePurchases, appleProvider } from './apple-purchases.mjs';
import { AccountDeletion } from './account-deletion.mjs';
const env = process.env;
const filename = env.INKLURA_PDF_DATABASE || './data/inklura-pdf.sqlite';
mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
const clientId = env.INKLURA_PDF_OIDC_CLIENT_ID || '';
const publicUrl = env.INKLURA_PDF_API_URL || 'http://127.0.0.1:4387';
const origin = new URL(publicUrl);
if (origin.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('HTTPS required');
const ledger = new Ledger(filename);
const key = env.STRIPE_SECRET_KEY || '';
const stripe = key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 }) : null;
const priceIds = Object.fromEntries(ALL_PLANS.map(plan => [plan.id, env['INKLURA_PDF_PRICE_' + plan.id.replaceAll('-', '_').toUpperCase()]]));
const payments = new Payments({ ledger, stripe, priceIds, webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  portalConfiguration: env.INKLURA_PDF_PORTAL_CONFIGURATION,
  franceTaxRate: env.INKLURA_PDF_FRANCE_TAX_RATE,
  enabled: env.INKLURA_PDF_PAYMENTS_ENABLED === 'true', live: stripeLiveMode(key, env.INKLURA_PDF_STRIPE_MODE),
  allowLive: env.INKLURA_PDF_ALLOW_LIVE_PAYMENTS === 'true', publicUrl: publicUrl.replace(/\/$/, '') });
const webPurchases = new WebPurchases({ ledger, payments, secret: env.INKLURA_PDF_WEB_SECRET || '' });
const applePurchases = new ApplePurchases({ ledger, provider: appleProvider(env),
  sandboxAccounts: (env.INKLURA_APPLE_SANDBOX_ACCOUNTS || '').split(',').map(s => s.trim()) });
const accountDeletion = new AccountDeletion({ ledger, payments });
const deletionTimer = setInterval(() => void accountDeletion.run(), 60000);
void accountDeletion.run();
const server = createApi({ accountDeletion, applePurchases, webPurchases, ledger, payments, clientId, publicUrl, authenticate: createAuthenticator({ clientId }) });
server.requestTimeout = 15000; server.headersTimeout = 10000;
server.listen(Number(env.INKLURA_PDF_PORT || 4387), '127.0.0.1', () => console.log('Inklura PDF account service listening on loopback; purchases ' + (payments.enabled ? 'enabled' : 'disabled')));
function close() { clearInterval(deletionTimer); server.close(async () => { await accountDeletion.running; ledger.close(); process.exit(0); }); }
process.on('SIGINT', close); process.on('SIGTERM', close);
