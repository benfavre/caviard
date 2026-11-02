import { randomUUID, createHash } from 'node:crypto';
export class AccountAI {
  constructor(account) { this.account = account; this.active = null; this.pending = null; }
  snapshot() {
    const state = this.account.snapshot();
    return { ...state.ai, signedIn: state.phase === 'signed-in', remaining: state.account?.aiCredits?.remaining || 0 };
  }
  cancel() { this.active?.abort(); }
  async request(type, payload, consent) {
    if (consent !== true) throw new Error('Autorisez l’envoi à Inklura et OVHcloud avant de lancer l’assistant.');
    if (!['plan', 'analyze'].includes(type)) throw new Error('Opération IA inconnue.');
    if (this.active) throw new Error('Une analyse est déjà en cours.');
    const controller = new AbortController(); this.active = controller;
    try {
      if (!this.account.tokens) throw new Error('Connectez-vous à Inklura pour utiliser l’assistant OVHcloud inclus.');
      controller.signal.throwIfAborted();
      if (type === 'analyze') {
        const owner = this.account.account?.accountId;
        const digest = createHash('sha256').update(JSON.stringify(payload.blocks)).digest('hex');
        if (!this.pending || this.pending.owner !== owner || this.pending.digest !== digest) this.pending = { owner, digest, operation: randomUUID() };
        payload = { blocks: payload.blocks, operation: this.pending.operation };
      }
      const response = await this.account.request('/v1/ai/' + type, { payload, consent: true }, { signal: controller.signal, timeoutMs: 130000, maximum: 512 * 1024 });
      if (type === 'analyze') this.pending = null;
      await this.account.refresh().catch(() => {});
      return response.result;
    } catch (error) {
      if (error.code && !['service_unavailable','ai_busy'].includes(error.code)) this.pending = null;
      await this.account.refresh().catch(() => {});
      if (controller.signal.aborted) throw new Error('Analyse annulée. Si elle était déjà terminée sur le serveur, son crédit IA reste consommé ; relancez la même analyse pour récupérer le résultat sans nouveau débit.');
      throw error;
    } finally { if (this.active === controller) this.active = null; }
  }
}
