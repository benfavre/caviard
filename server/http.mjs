import { createServer } from 'node:http';
import { BillingError } from './ledger.mjs';
import { INKLURA_ISSUER } from './auth.mjs';
export function createApi({ ledger, payments, authenticate, clientId, publicUrl }) {
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
      if (req.headers.origin && req.headers.origin !== new URL(publicUrl).origin) throw new BillingError('origin_not_allowed', 403);
      if (req.method === 'GET' && path === '/v1/config') return send(res, 200, {
        enabled: !!clientId, issuer: INKLURA_ISSUER, clientId: clientId || null,
        deviceEndpoint: INKLURA_ISSUER + '/oauth2/device', tokenEndpoint: INKLURA_ISSUER + '/oauth2/token',
        plans: payments.catalog(), paymentsEnabled: payments.enabled,
      });
      if (req.method === 'GET' && ['/billing/success', '/billing/cancel'].includes(path)) {
        const success = path.endsWith('success');
        return send(res, 200, '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Inklura PDF</title><h1>' + (success ? 'Retour dans Inklura PDF' : 'Paiement annulé') + '</h1><p>' + (success ? 'Revenez dans l’application : vos crédits se mettent à jour après confirmation de Stripe. Si le solde ne change pas après quelques secondes, cliquez sur Actualiser.' : 'Aucun crédit n’a été ajouté. Vous pouvez revenir dans l’application.') + '</p><a href="https://pdf.inklura.fr/">Inklura PDF</a></html>', 'text/html; charset=utf-8');
      }
      if (req.method === 'POST' && path === '/v1/stripe/webhook') {
        const raw = await readBody(req, 1024 * 1024);
        return send(res, 200, await payments.webhook(raw, req.headers['stripe-signature']));
      }
      const allowed = new Set(['GET /v1/account', 'POST /v1/exports/reserve', 'POST /v1/exports/commit', 'POST /v1/exports/release', 'POST /v1/checkout', 'POST /v1/portal']);
      if (!allowed.has(req.method + ' ' + path)) throw new BillingError('not_found', 404);
      const identity = await authenticate(req.headers.authorization);
      const account = ledger.account(identity.issuer, identity.subject);
      if (path === '/v1/account') return send(res, 200, { ...ledger.balance(account.id), plans: payments.catalog(), paymentsEnabled: payments.enabled });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new BillingError('json_required', 415);
      let data;
      try { data = JSON.parse((await readBody(req, 4096)).toString()); } catch (error) { if (error instanceof BillingError) throw error; throw new BillingError('invalid_json'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BillingError('invalid_request');
      const keys = path === '/v1/checkout' ? ['planId', 'operation', 'billing'] : path === '/v1/portal' ? [] : ['operation'];
      if (Object.keys(data).some(key => !keys.includes(key))) throw new BillingError('unexpected_fields');
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
