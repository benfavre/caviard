import { createServer } from 'node:http';
import { BillingError } from './ledger.mjs';
import { INKLURA_ISSUER } from './auth.mjs';
import { BUYER_FIELDS, promoCode, webBuyer } from './france-billing.mjs';
export function createApi({ webPurchases, applePurchases, accountDeletion, ledger, payments, authenticate, clientId, publicUrl, now = () => Date.now() }) {
  // Promotion code lookups: pdf.inklura.fr/api/panier/promo relays them (the
  // site limits each visitor); a global ceiling here bounds Stripe calls.
  let lookups = [];
  const allowLookup = () => {
    const t = now();
    lookups = lookups.filter(at => at > t - 10 * 60000);
    if (lookups.length >= 300) return false;
    lookups.push(t);
    return true;
  };
  const send = (res, status, data, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
    res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
  };
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, publicUrl).pathname;
      const prefix = new URL(publicUrl).pathname.replace(/\/$/, '');
      const path = prefix && pathname.startsWith(prefix + '/') ? pathname.slice(prefix.length) : pathname;
      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
      if (req.method === 'GET' && path === '/web/resume') {
        const receipt = /(?:^|; )__Host-pdf-purchase=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        res.writeHead(303, { location: receipt ? 'https://manage.inklura.fr/pdf/billing?claim=' + receipt : 'https://manage.inklura.fr/pdf/billing', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
        return res.end();
      }
      if (req.method === 'POST' && path === '/web/checkout') {
        if (!webPurchases) throw new BillingError('purchases_not_enabled', 503);
        if (!['https://pdf.inklura.fr', new URL(publicUrl).origin].includes(req.headers.origin)) throw new BillingError('origin_not_allowed', 403);
        if (!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) throw new BillingError('form_required', 415);
        const form = new URLSearchParams((await readBody(req, 2048)).toString());
        if ([...form.keys()].some(k => k !== 'planId' && k !== 'promoCode' && !BUYER_FIELDS.includes(k)) || [...new Set(form.keys())].some(k => form.getAll(k).length !== 1) || form.getAll('planId').length !== 1) throw new BillingError('invalid_request');
        // Prefill only: invalid buyer details never block the payment.
        let buyer = null, promo = null;
        try { buyer = webBuyer(form); } catch {}
        try { promo = promoCode(form.get('promoCode')); } catch {}
        const receipt = /(?:^|; )__Host-pdf-purchase=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        try {
          const result = await webPurchases.checkout(form.get('planId'), receipt, value => res.setHeader('set-cookie', '__Host-pdf-purchase=' + value + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400'), buyer, promo);
          res.writeHead(303, { location: result.url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
          return res.end();
        } catch (error) {
          if (error.code === 'checkout_closed') res.setHeader('set-cookie', '__Host-pdf-purchase=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
          return send(res, error instanceof BillingError ? error.status : 503, '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Paiement Inklura PDF</title><h1>Le paiement n’a pas pu être ouvert</h1><p>' + (String(error.code || '').startsWith('promo_') ? 'Le code promo n’est plus valable pour cette offre. Revenez à votre commande pour le retirer ou en saisir un autre.' : 'Réessayez dans un instant. Une session fermée ne peut pas être réutilisée.') + '</p><a href="https://pdf.inklura.fr/tarifs">Revenir aux offres</a></html>', 'text/html; charset=utf-8');
        }
      }
      if (path === '/web/promo') {
        // Server to server (the site relays /panier): browsers are refused.
        if (req.headers.origin) throw new BillingError('origin_not_allowed', 403);
        if (req.method !== 'POST') throw new BillingError('not_found', 404);
        if (!webPurchases) throw new BillingError('purchases_not_enabled', 503);
        if (!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) throw new BillingError('form_required', 415);
        const form = new URLSearchParams((await readBody(req, 512)).toString());
        if ([...form.keys()].some(k => !['planId', 'promoCode'].includes(k))) throw new BillingError('invalid_request');
        if (!allowLookup()) throw new BillingError('too_many_requests', 429);
        return send(res, 200, await webPurchases.promotion(form.get('planId'), form.get('promoCode')));
      }
      if (req.method === 'POST' && path === '/web/sales') {
        // Invoicing worker (tools/sync-pdf-sales.mjs): same signed bridge, no subject.
        if (!webPurchases) throw new BillingError('website_not_configured', 503);
        if (req.headers.origin) throw new BillingError('origin_not_allowed', 403);
        const raw = (await readBody(req, 1024)).toString();
        const data = webPurchases.verify(path, raw, req.headers.authorization);
        if (!data || typeof data !== 'object' || Object.keys(data).some(key => !['after', 'limit'].includes(key))) throw new BillingError('unexpected_fields');
        return send(res, 200, webPurchases.sales(data.after ?? 0, data.limit ?? 50));
      }
      if (req.method === 'POST' && path === '/web/receipt') {
        // Account page after payment (activ #1105): the order's e-mail prefills
        // account creation. Holding the receipt is the capability; no subject.
        if (!webPurchases) throw new BillingError('website_not_configured', 503);
        if (req.headers.origin) throw new BillingError('origin_not_allowed', 403);
        const raw = (await readBody(req, 1024)).toString();
        const data = webPurchases.verify(path, raw, req.headers.authorization);
        if (!data || typeof data !== 'object' || Object.keys(data).some(key => key !== 'receipt')) throw new BillingError('unexpected_fields');
        return send(res, 200, webPurchases.receipt(data.receipt));
      }
      if (req.method === 'POST' && ['/web/account', '/web/claim', '/web/portal'].includes(path)) {
        if (!webPurchases) throw new BillingError('website_not_configured', 503);
        // Only the signed Manage server bridge may use these routes. Browser
        // cookies, query subjects and desktop access tokens are not credentials here.
        if (req.headers.origin) throw new BillingError('origin_not_allowed', 403);
        const raw = (await readBody(req, 4096)).toString();
        const { data, account } = webPurchases.authenticate(path, raw, req.headers.authorization);
        const allowed = path === '/web/claim' ? ['subject', 'receipt'] : path === '/web/portal' ? ['subject', 'source'] : ['subject'];
        if (Object.keys(data).some(key => !allowed.includes(key))) throw new BillingError('unexpected_fields');
        if (path === '/web/claim') return send(res, 200, webPurchases.claim(account.id, data.receipt));
        if (path === '/web/portal') return send(res, 200, await webPurchases.portal(account.id, data.source));
        return send(res, 200, webPurchases.account(account.id));
      }
      if (req.headers.origin && req.headers.origin !== new URL(publicUrl).origin) throw new BillingError('origin_not_allowed', 403);
      if (req.method === 'GET' && path === '/v1/config') return send(res, 200, {
        enabled: !!clientId, issuer: INKLURA_ISSUER, clientId: clientId || null,
        deviceEndpoint: INKLURA_ISSUER + '/oauth2/device', tokenEndpoint: INKLURA_ISSUER + '/oauth2/token',
        plans: payments.catalog(), paymentsEnabled: payments.enabled, webPurchasesEnabled: !!webPurchases?.enabled,
        applePurchasesEnabled: !!applePurchases?.enabled, appleProducts: applePurchases?.catalog() || [],
        accountDeletionEnabled: !!accountDeletion,
      });
      if (req.method === 'GET' && ['/billing/success', '/billing/cancel'].includes(path)) {
        const success = path.endsWith('success');
        return send(res, 200, '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Inklura PDF</title><h1>' + (success ? 'Retour dans Inklura PDF' : 'Paiement annulé') + '</h1><p>' + (success ? 'Revenez dans l’application : vos crédits se mettent à jour après confirmation de Stripe. Si le solde ne change pas après quelques secondes, cliquez sur Actualiser.' : 'Aucun crédit n’a été ajouté. Vous pouvez revenir dans l’application.') + '</p><a href="https://pdf.inklura.fr/">Inklura PDF</a></html>', 'text/html; charset=utf-8');
      }
      if (req.method === 'POST' && path === '/v1/stripe/webhook') {
        const raw = await readBody(req, 1024 * 1024);
        return send(res, 200, await payments.webhook(raw, req.headers['stripe-signature']));
      }
      if (req.method === 'POST' && path === '/v1/apple/notifications') {
        if (!applePurchases?.enabled) throw new BillingError('apple_purchases_unavailable', 503);
        if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new BillingError('json_required', 415);
        let data;
        try { data = JSON.parse((await readBody(req, 130 * 1024)).toString()); }
        catch (error) { if (error instanceof BillingError) throw error; throw new BillingError('invalid_json'); }
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => k !== 'signedPayload')) throw new BillingError('invalid_request');
        return send(res, 200, await applePurchases.notification(data.signedPayload));
      }
      const allowed = new Set(['GET /v1/account', 'POST /v1/account/deletion', 'GET /v1/account/deletion', 'POST /v1/exports/reserve', 'POST /v1/exports/commit', 'POST /v1/exports/release', 'POST /v1/checkout', 'POST /v1/portal', 'POST /v1/apple/prepare', 'POST /v1/apple/claim']);
      if (!allowed.has(req.method + ' ' + path)) throw new BillingError('not_found', 404);
      const identity = await authenticate(req.headers.authorization);
      if (path === '/v1/account/deletion') {
        if (!accountDeletion) throw new BillingError('deletion_unavailable', 503);
        if (req.method === 'GET') {
          const deletion = ledger.deletionForIdentity(identity.issuer, identity.subject);
          return send(res, 200, { state: !deletion ? 'none' : deletion.completed !== null ? 'deleted' : 'pending' });
        }
        if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new BillingError('json_required', 415);
        let data;
        try { data = JSON.parse((await readBody(req, 512)).toString()); }
        catch (error) { if (error instanceof BillingError) throw error; throw new BillingError('invalid_json'); }
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => k !== 'confirmation')) throw new BillingError('invalid_request');
        const result = accountDeletion.request(identity.issuer, identity.subject, data.confirmation);
        void accountDeletion.run();
        return send(res, result.state === 'deleted' ? 200 : 202, result);
      }
      const account = ledger.account(identity.issuer, identity.subject);
      if (path === '/v1/account') return send(res, 200, { ...ledger.balance(account.id), plans: payments.catalog(), paymentsEnabled: payments.enabled,
        applePurchasesEnabled: !!applePurchases?.enabled, appleProducts: applePurchases?.catalog() || [] });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new BillingError('json_required', 415);
      let data;
      try { data = JSON.parse((await readBody(req, 4096)).toString()); } catch (error) { if (error instanceof BillingError) throw error; throw new BillingError('invalid_json'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BillingError('invalid_request');
      const keys = path === '/v1/apple/prepare' ? ['productId'] : path === '/v1/apple/claim' ? ['transactionId'] : path === '/v1/checkout' ? ['planId', 'operation', 'billing'] : path === '/v1/portal' ? [] : ['operation'];
      if (Object.keys(data).some(key => !keys.includes(key))) throw new BillingError('unexpected_fields');
      if (path.startsWith('/v1/apple/')) {
        if (!applePurchases?.enabled) throw new BillingError('apple_purchases_unavailable', 503);
        return send(res, 200, path.endsWith('/prepare') ? applePurchases.prepare(account.id, data.productId) : await applePurchases.claim(account.id, data.transactionId));
      }
      if (path === '/v1/checkout') return send(res, 200, await payments.checkout(account.id, data.planId, data.operation, data.billing));
      if (path === '/v1/portal') return send(res, 200, await payments.portal(account.id));
      const action = path.split('/').at(-1);
      return send(res, 200, action === 'reserve' ? ledger.reserve(account.id, data.operation) : ledger.transition(account.id, data.operation, action));
    } catch (error) {
      // No token, document data, SQL exception or provider response reaches logs/clients.
      send(res, error instanceof BillingError ? error.status : 503, { error: error instanceof BillingError ? error.code : 'service_unavailable' });
    }
  });
}
async function readBody(req, maximum) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maximum) throw new BillingError('request_too_large', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
