import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
const ISSUER = 'https://auth.1clic.pro';
const PAIRING_PAGE = 'https://manage.inklura.fr/manage/device';
const messages = {
  quota_exhausted: 'Vous avez utilisé tous vos crédits PDF. Votre travail reste ouvert.',
  sign_in_required: 'Connectez-vous à votre compte Inklura pour exporter.',
  session_expired: 'Votre session a expiré. Reconnectez-vous à Inklura.',
  purchases_not_enabled: 'Les achats ne sont pas encore activés.',
  accounts_not_configured: 'La connexion Inklura est en préparation.',
  account_under_review: 'La facturation de ce compte nécessite une vérification.',
  subscription_already_exists: 'Un abonnement ou un paiement d’abonnement existe déjà pour ce compte.',
  france_only: 'Les achats sont réservés à la France métropolitaine pour le moment.',
  billing_address_required: 'Renseignez votre nom et votre adresse complète de facturation.',
};
export function accountApiUrl(value, development = false) {
  if (!value) return null;
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash) throw new Error('Invalid account service URL');
  const live = u.protocol === 'https:' && u.hostname === 'outils.inklura.fr' && !u.port && u.pathname.replace(/\/$/, '') === '/api/inklura-pdf';
  const local = development && u.protocol === 'http:' && u.hostname === '127.0.0.1';
  if (!live && !local) throw new Error('Untrusted account service');
  return u.href.replace(/\/$/, '');
}
export class AccountController extends EventEmitter {
  constructor({ apiUrl, development = false, fetcher = fetch, openExternal, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, onSignedIn = async () => {} }) {
    super(); Object.assign(this, { fetcher, openExternal, now, setTimer, clearTimer, onSignedIn });
    this.apiUrl = accountApiUrl(apiUrl, development); this.phase = this.apiUrl ? 'loading' : 'disabled';
    this.config = null; this.account = null; this.tokens = null; this.flow = null; this.timer = null; this.message = ''; this.generation = 0;
    this.checkoutOperations = new Map();
  }
  snapshot() {
    return { phase: this.phase, enabled: !!this.apiUrl && !!this.config?.enabled, message: this.message,
      account: this.account, userCode: this.flow?.userCode || null,
      plans: this.account?.plans || this.config?.plans || [], paymentsEnabled: !!this.account?.paymentsEnabled };
  }
  publish() { this.emit('state', this.snapshot()); return this.snapshot(); }
  async json(url, options = {}) {
    const response = await this.fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (text.length > 128 * 1024) throw new Error('Réponse du service trop volumineuse.');
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Le service Inklura est temporairement indisponible.'); }
    if (!response.ok) {
      const error = new Error(messages[data.error] || 'Le service Inklura est temporairement indisponible.');
      error.code = data.error; error.description = data.error_description; throw error;
    }
    return data;
  }
  async initialize() {
    if (!this.apiUrl) return this.publish();
    try {
      const config = await this.json(this.apiUrl + '/v1/config');
      if (config.enabled && (config.issuer !== ISSUER || config.deviceEndpoint !== ISSUER + '/oauth2/device' || config.tokenEndpoint !== ISSUER + '/oauth2/token' || typeof config.clientId !== 'string' || !config.clientId)) throw new Error('Configuration de connexion invalide.');
      this.config = config; this.phase = config.enabled ? 'signed-out' : 'disabled';
    } catch (error) { this.phase = 'error'; this.message = error.message; }
    return this.publish();
  }
  async form(endpoint, values) {
    return this.json(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() });
  }
  async signIn() {
    if (['waiting', 'connecting'].includes(this.phase)) return this.snapshot();
    if (!this.config?.enabled) await this.initialize();
    if (!this.config?.enabled) throw new Error(messages.accounts_not_configured);
    const generation = ++this.generation;
    this.phase = 'connecting'; this.message = ''; this.publish();
    try {
      const response = await this.form(this.config.deviceEndpoint, { client_id: this.config.clientId, scope: 'openid profile email offline_access' });
      if (generation !== this.generation) return this.snapshot();
      const url = new URL(response.verification_uri_complete || response.verification_uri);
      if (![ISSUER, new URL(PAIRING_PAGE).origin].includes(url.origin) || url.username || url.password || typeof response.device_code !== 'string' || !response.device_code || !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(response.user_code) || !Number.isFinite(response.expires_in) || response.expires_in <= 0) throw new Error('Réponse de connexion invalide.');
      this.flow = { deviceCode: response.device_code, userCode: response.user_code, expires: this.now() + Math.min(response.expires_in, 900) * 1000, interval: Math.max(5, Math.min(response.interval || 5, 60)) };
      this.phase = 'waiting'; this.publish();
      // Rebuild the hosted URL from the validated public code only. Never forward
      // provider query parameters, private device codes or redirect destinations.
      const pairing = new URL(PAIRING_PAGE);
      pairing.searchParams.set('user_code', response.user_code);
      await this.openExternal(pairing.href);
      if (generation === this.generation && this.flow) this.schedule(generation);
    } catch (error) { if (generation === this.generation) { this.phase = 'signed-out'; this.flow = null; this.message = error.message; this.publish(); } }
    return this.snapshot();
  }
  schedule(generation) { this.timer = this.setTimer(() => this.poll(generation), this.flow.interval * 1000); }
  async poll(generation = this.generation) {
    if (generation !== this.generation || !this.flow) return;
    if (this.now() >= this.flow.expires) { this.cancel(); this.message = 'Le code a expiré. Relancez la connexion.'; return this.publish(); }
    try {
      const tokens = await this.form(this.config.tokenEndpoint, { client_id: this.config.clientId, grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: this.flow.deviceCode });
      if (generation !== this.generation) return;
      this.acceptTokens(tokens);
      this.flow = null;
      await this.refresh();
      if (generation !== this.generation) return;
      await this.onSignedIn();
      if (generation === this.generation) await this.refresh();
    } catch (error) {
      if (generation !== this.generation) return;
      // Current Inklura provider carries device pending/slow_down in the
      // description of invalid_grant; also accept the standard RFC 8628 codes.
      const code = ['authorization_pending', 'slow_down'].includes(error.code) ? error.code : error.code === 'invalid_grant' ? error.description : '';
      if (code === 'authorization_pending' || code === 'slow_down') {
        if (code === 'slow_down') this.flow.interval += 5;
        return this.schedule(generation);
      }
      this.cancel(); this.message = error.code === 'access_denied' ? 'Connexion refusée.' : error.message; this.publish();
    }
  }
  acceptTokens(tokens) {
    if (tokens.token_type?.toLowerCase() !== 'bearer' || typeof tokens.access_token !== 'string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('Session Inklura invalide.');
    this.tokens = { access: tokens.access_token, refresh: tokens.refresh_token || this.tokens?.refresh, expires: this.now() + Math.min(tokens.expires_in, 86400) * 1000 };
  }
  async accessToken() {
    if (!this.tokens) throw new Error(messages.sign_in_required);
    if (this.tokens.expires < this.now() + 30000) {
      if (!this.tokens.refresh) throw Object.assign(new Error(messages.session_expired), { code: 'session_expired' });
      if (!this.refreshing) {
        const generation = this.generation;
        const refreshing = this.form(this.config.tokenEndpoint, { client_id: this.config.clientId, grant_type: 'refresh_token', refresh_token: this.tokens.refresh }).then(tokens => {
          if (generation !== this.generation) throw new Error(messages.sign_in_required);
          this.acceptTokens(tokens);
        }).catch(error => {
          if (error.code === 'invalid_grant') {
            error.code = 'session_expired'; error.message = messages.session_expired;
          }
          throw error;
        }).finally(() => { if (this.refreshing === refreshing) this.refreshing = null; });
        this.refreshing = refreshing;
      }
      await this.refreshing;
    }
    if (!this.tokens) throw new Error(messages.sign_in_required);
    return this.tokens.access;
  }
  async request(path, body) {
    const token = await this.accessToken();
    return this.json(this.apiUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async refresh() {
    if (!this.tokens) return this.snapshot();
    const generation = this.generation;
    try {
      const account = await this.request('/v1/account');
      if (generation !== this.generation) return this.snapshot();
      if (typeof account.accountId !== 'string' || !Number.isSafeInteger(account.remaining) || account.remaining < 0) throw new Error('Solde Inklura invalide.');
      this.account = account; this.phase = 'signed-in'; this.message = '';
    } catch (error) {
      if (generation !== this.generation) return this.snapshot();
      this.message = error.message;
      if (error.code === 'session_expired') { this.tokens = null; this.account = null; this.phase = 'signed-out'; }
      this.publish(); throw error;
    }
    return this.publish();
  }
  async checkout(planId, billing) {
    const plan = this.account?.plans?.find(p => p.id === planId);
    if (!plan?.purchasable || !this.account.paymentsEnabled) throw new Error(messages.purchases_not_enabled);
    if (!this.checkoutOperations.has(planId)) this.checkoutOperations.set(planId, randomUUID());
    const result = await this.request('/v1/checkout', { planId, operation: this.checkoutOperations.get(planId), billing });
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('Lien de paiement invalide.');
    await this.openExternal(url.href); this.checkoutOperations.delete(planId);
    return { opened: true };
  }
  async portal() {
    const result = await this.request('/v1/portal', {}), url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com' || url.username || url.password) throw new Error('Lien de facturation invalide.');
    await this.openExternal(url.href); return { opened: true };
  }
  cancel() { ++this.generation; this.clearTimer(this.timer); this.flow = null; this.phase = this.tokens ? 'signed-in' : 'signed-out'; return this.publish(); }
  logout() { this.cancel(); this.tokens = null; this.refreshing = null; this.account = null; this.checkoutOperations.clear(); this.phase = this.config?.enabled ? 'signed-out' : 'disabled'; this.message = ''; return this.publish(); }
  dispose() { this.cancel(); this.tokens = null; this.removeAllListeners(); }
}
