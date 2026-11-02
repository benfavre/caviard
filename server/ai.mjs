import { createHash } from 'node:crypto';
import { OvhMistral, DEFAULT_MODEL } from '../electron/ovh-mistral.mjs';
import { BillingError, operationId } from './ledger.mjs';
import { AICredits } from './ai-credits.mjs';

export class IncludedAI {
  #key;
  constructor({ ledger, apiKey = '', model = DEFAULT_MODEL, fetchImpl, now = () => Date.now(), dailyCalls = 500, dailyCharacters = 500000 }) {
    Object.assign(this, { ledger, model, fetchImpl, now, dailyCalls, dailyCharacters });
    this.#key = apiKey; this.credits = new AICredits(ledger);
    if (apiKey) new OvhMistral().configure({ apiKey, model });
    this.active = new Set(); this.results = new Map();
    ledger.db.exec(`CREATE TABLE IF NOT EXISTS ai_usage (
      account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, day INTEGER NOT NULL,
      calls INTEGER NOT NULL, characters INTEGER NOT NULL, plans INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(account, day))`);
  }
  status() { return { enabled: !!this.#key, model: this.model, creditsPerAnalysis: 1, trialAnalyses: 10, maxCharacters: 60000, dailyCalls: this.dailyCalls, dailyCharacters: this.dailyCharacters }; }
  async request(account, type, payload, consent, signal) {
    if (!this.#key) throw new BillingError('ai_not_configured', 503);
    if (consent !== true) throw new BillingError('ai_consent_required', 400);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BillingError('invalid_request');
    let blocks = [], characters, operation;
    if (type === 'plan') {
      if (Object.keys(payload).some(k => k !== 'instruction') || typeof payload.instruction !== 'string' || !payload.instruction.trim() || payload.instruction.length > 1000) throw new BillingError('invalid_request');
      characters = payload.instruction.length;
    } else if (type === 'analyze') {
      operation = operationId(payload.operation);
      if (Object.keys(payload).some(k => !['blocks','operation'].includes(k)) || !Array.isArray(payload.blocks) || !payload.blocks.length || payload.blocks.length > 64) throw new BillingError('invalid_request');
      blocks = payload.blocks; characters = 0;
      for (const block of blocks) {
        if (!block || Object.keys(block).some(k => !['text','labels'].includes(k)) || typeof block.text !== 'string' || !block.text.trim() || block.text.length > 12000 || !Array.isArray(block.labels) || !block.labels.length || block.labels.length > 3 || block.labels.some(x => !['person','address','organization'].includes(x))) throw new BillingError('invalid_request');
        characters += block.text.length;
      }
      if (characters > 60000) throw new BillingError('ai_document_too_large', 413);
    } else throw new BillingError('invalid_request');
    if (this.ledger.isBlocked(account)) throw new BillingError('account_under_review',403);
    if (this.active.has(account) || this.active.size >= 4) throw new BillingError('ai_busy', 429);
    signal?.throwIfAborted();
    for (const [key, cached] of this.results) if (cached.expires <= this.now()) this.results.delete(key);
    const cacheKey = account + ':' + operation;
    let held = false;
    if (type === 'analyze') {
      const digest = createHash('sha256').update(JSON.stringify(blocks)).digest('hex');
      const reservation = this.credits.reserve(account, operation, digest);
      if (reservation.state === 'committed') {
        const cached = this.results.get(cacheKey);
        if (!cached) throw new BillingError('ai_result_expired', 409);
        return cached.result;
      }
      if (!reservation.created) throw new BillingError('ai_busy', 409);
      held = true;
    } else if (this.credits.balance(account).remaining < 1) throw new BillingError('ai_quota_exhausted',402);
    const controller = new AbortController();
    const client = new OvhMistral({ fetchImpl: this.fetchImpl });
    client.configure({ apiKey: this.#key, model: this.model });
    const cancel = () => { controller.abort(); client.cancel(); };
    const timer = setTimeout(cancel,120000);
    signal?.addEventListener('abort',cancel,{once:true});
    this.active.add(account);
    try {
      const day = Math.floor(this.now()/86400000), calls = type === 'plan' ? 1 : blocks.length;
      this.ledger.transaction(() => {
        const usage = this.ledger.db.prepare('SELECT * FROM ai_usage WHERE account=? AND day=?').get(account,day);
        if ((usage?.calls || 0)+calls > this.dailyCalls || (usage?.characters || 0)+characters > this.dailyCharacters || (type === 'plan' && (usage?.plans || 0)>=20)) throw new BillingError('ai_daily_limit',429);
        this.ledger.db.prepare(`INSERT INTO ai_usage(account,day,calls,characters,plans) VALUES(?,?,?,?,?)
          ON CONFLICT(account,day) DO UPDATE SET calls=calls+excluded.calls,characters=characters+excluded.characters,plans=plans+excluded.plans`).run(account,day,calls,characters,type==='plan'?1:0);
      });
      let result;
      if (type === 'plan') result = await client.request('plan',payload,true);
      else {
        result = []; let count = 0;
        for (const block of blocks) {
          controller.signal.throwIfAborted();
          const found = await client.request('detect',block,true); count += found.length;
          if (count > 1000) throw new BillingError('ai_result_too_large',413);
          result.push(found);
        }
      }
      controller.signal.throwIfAborted();
      if (held) {
        if (JSON.stringify(result).length > 400000) throw new BillingError('ai_result_too_large',413);
        this.credits.settle(account,operation,true); held = false;
        const cached = {result,expires:this.now()+300000};
        this.results.set(cacheKey,cached);
        const expiry = setTimeout(() => { if (this.results.get(cacheKey) === cached) this.results.delete(cacheKey); },300000);
        expiry.unref?.();
        while (this.results.size>100) this.results.delete(this.results.keys().next().value);
      }
      return result;
    } catch (error) {
      if (held) this.credits.settle(account,operation,false);
      if (error instanceof BillingError) throw error;
      throw new BillingError(controller.signal.aborted ? 'ai_cancelled' : 'ai_provider_failed',503);
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort',cancel); client.clear(); this.active.delete(account);
    }
  }
}
