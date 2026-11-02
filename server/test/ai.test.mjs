import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Ledger } from '../ledger.mjs';
import { IncludedAI } from '../ai.mjs';
import { createApi } from '../http.mjs';
import { Payments } from '../payments.mjs';
const block = { text: 'Alice Martin est une personne fictive.', labels: ['person'] };
const answer = () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ entities: [{ text: 'Alice Martin', label: 'person' }] }) } }] }));
const payload = { blocks: [block], operation: 'ai-analysis-operation-12345' };
function fixture(options = {}) {
  const ledger = new Ledger(), owner = ledger.account('fixture', 'alice').id;
  const ai = new IncludedAI({ ledger, apiKey: 'synthetic-server-key', fetchImpl: async () => answer(), ...options });
  return { ledger, owner, ai };
}
test('AI batch charges one AI credit exactly once; provider failure and export credits remain isolated', async () => {
  const { ledger, owner, ai } = fixture();
  try {
    const before = ledger.balance(owner);
    assert.equal((await ai.request(owner, 'analyze', payload, true))[0][0].text, 'Alice Martin');
    await ai.request(owner, 'analyze', payload, true);
    assert.equal(ai.credits.balance(owner).remaining, 9);
    ai.fetchImpl = async () => new Response('private provider failure', { status: 429 });
    await assert.rejects(ai.request(owner, 'analyze', {...payload,operation:'failed-analysis-12345678'}, true), { code: 'ai_provider_failed' });
    assert.deepEqual(ledger.balance(owner), before);
    assert.equal(ai.credits.balance(owner).remaining, 9);
    assert.equal(ledger.db.prepare('SELECT count(*) AS count FROM exports').get().count, 0);
    ledger.reserve(owner, 'successful-export-123456');
    ledger.transition(owner, 'successful-export-123456', 'commit');
    ledger.transition(owner, 'successful-export-123456', 'commit');
    assert.equal(ledger.balance(owner).remaining, 19);
    ledger.reserve(owner, 'cancelled-export-123456');
    ledger.transition(owner, 'cancelled-export-123456', 'release');
    assert.equal(ledger.balance(owner).remaining, 19);
  } finally { ledger.close(); }
});
test('missing consent, no credit, blocked account and excess usage never invoke OVH', async () => {
  let calls = 0;
  const { ledger, owner, ai } = fixture({ dailyCalls: 1, fetchImpl: async () => { calls++; return answer(); } });
  try {
    await assert.rejects(ai.request(owner, 'analyze', payload, false), { code: 'ai_consent_required' });
    ledger.db.prepare('UPDATE accounts SET blocked=1 WHERE id=?').run(owner);
    await assert.rejects(ai.request(owner, 'analyze', payload, true), { code: 'account_under_review' });
    ledger.db.prepare('UPDATE accounts SET blocked=0 WHERE id=?').run(owner);
    ai.credits.balance(owner);
    ledger.db.prepare('UPDATE ai_grants SET used=total WHERE account=?').run(owner);
    await assert.rejects(ai.request(owner, 'analyze', payload, true), { code: 'ai_quota_exhausted' });
    assert.equal(calls, 0);
    ledger.db.prepare('UPDATE ai_grants SET used=0 WHERE account=?').run(owner);
    await ai.request(owner, 'analyze', payload, true);
    await assert.rejects(ai.request(owner, 'analyze', {...payload,operation:'over-limit-operation-1234'}, true), { code: 'ai_daily_limit' });
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(ai.status()).includes('synthetic-server-key'), false);
    const usage = ledger.db.prepare('SELECT * FROM ai_usage').get();
    assert.equal(usage.calls, 1); assert.equal(usage.characters, block.text.length);
    assert.equal(JSON.stringify(usage).includes('Alice Martin'), false);
  } finally { ledger.close(); }
});
test('cancellation releases concurrency without charging and a different account cannot exhaust another quota', async () => {
  let started;
  const pending = new Promise(resolve => { started = resolve; });
  const { ledger, owner, ai } = fixture({ fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Error('aborted'))); started();
  }) });
  try {
    const controller = new AbortController();
    const request = ai.request(owner, 'analyze', payload, true, controller.signal);
    await pending;
    await assert.rejects(ai.request(owner, 'analyze', payload, true), { code: 'ai_busy' });
    controller.abort();
    await assert.rejects(request, { code: 'ai_cancelled' });
    assert.equal(ledger.balance(owner).remaining, 20);
    assert.equal(ai.active.size, 0);
    assert.equal(ai.credits.balance(owner).remaining, 10);
    assert.equal(ai.credits.balance(owner).reserved, 0);
    const other = ledger.account('fixture', 'other').id;
    ai.fetchImpl = async () => answer();
    await ai.request(other, 'analyze', payload, true);
    assert.equal(ledger.balance(other).remaining, 20);
  } finally { ledger.close(); }
});
test('real HTTP routes enforce authentication, origin, schema and consent; AI and export share one real ledger', async () => {
  const { ledger, owner, ai } = fixture();
  const server = createApi({ ledger, ai, payments: new Payments({ ledger }), clientId: 'fixture', publicUrl: 'http://127.0.0.1',
    authenticate: async authorization => { if (authorization !== 'Bearer fixture') { const { BillingError } = await import('../ledger.mjs'); throw new BillingError('sign_in_required', 401); } return { issuer: 'fixture', subject: 'alice' }; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { authorization: 'Bearer fixture', 'content-type': 'application/json' };
  const post = (path, data, h = headers) => fetch(base + path, { method: 'POST', headers: h, body: JSON.stringify(data) });
  try {
    assert.equal((await post('/v1/ai/analyze', { payload, consent: true }, { 'content-type': 'application/json' })).status, 401);
    assert.equal((await post('/v1/ai/analyze', { payload, consent: true }, { ...headers, origin: 'https://evil.invalid' })).status, 403);
    assert.equal((await post('/v1/ai/analyze', { payload, consent: false })).status, 400);
    assert.equal((await post('/v1/ai/analyze', { payload: { ...payload, filename: 'secret.pdf' }, consent: true })).status, 400);
    const result = await post('/v1/ai/analyze', { payload, consent: true });
    assert.equal(result.status, 200); assert.equal((await result.json()).result[0][0].text, 'Alice Martin');
    assert.equal(ledger.balance(owner).remaining, 20);
    assert.equal(ai.credits.balance(owner).remaining, 9);
    for (const action of ['reserve', 'commit', 'commit']) assert.equal((await post('/v1/exports/' + action, { operation: 'native-export-12345678' })).status, 200);
    assert.equal(ledger.balance(owner).remaining, 19);
    const config = await (await fetch(base + '/v1/config')).json();
    assert.equal(config.ai.creditsPerAnalysis, 1); assert.equal(config.ai.enabled, true);
    assert.equal(JSON.stringify(config).includes('synthetic-server-key'), false);
  } finally { await new Promise(resolve => server.close(resolve)); ledger.close(); }
});

test('batch charging is once per document, and failed later blocks release the entire hold', async () => {
  let calls = 0;
  const {ledger,owner,ai} = fixture({fetchImpl:async()=>{calls++;return calls===2?new Response('failed',{status:500}):answer();}});
  try {
    await assert.rejects(ai.request(owner,'analyze',{...payload,blocks:[block,block]},true),{code:'ai_provider_failed'});
    assert.equal(ai.credits.balance(owner).remaining,10);assert.equal(ai.credits.balance(owner).reserved,0);
    ai.fetchImpl=async()=>answer();
    await ai.request(owner,'analyze',{blocks:[block,block],operation:'successful-batch-123456'},true);
    assert.equal(ai.credits.balance(owner).remaining,9);
    assert.equal(ledger.balance(owner).remaining,20);
  } finally {ledger.close();}
});
test('expired crash holds release, trial is unique, and operations cannot be reused for different text', async () => {
  const {ledger,owner,ai}=fixture();let time=ledger.getAccount(owner).created;ledger.now=()=>time;
  try {
    assert.equal(ai.credits.balance(owner).remaining,10);assert.equal(ai.credits.balance(owner).remaining,10);
    ai.credits.reserve(owner,'crashed-operation-12345','digest');
    assert.equal(ai.credits.balance(owner).remaining,9);
    time+=300001;assert.equal(ai.credits.balance(owner).remaining,10);
    await ai.request(owner,'analyze',payload,true);
    await assert.rejects(ai.request(owner,'analyze',{...payload,blocks:[{...block,text:'Different source'}]},true),{code:'ai_operation_conflict'});
    assert.equal(ai.credits.balance(owner).remaining,9);
    ai.results.clear();await assert.rejects(ai.request(owner,'analyze',payload,true),{code:'ai_result_expired'});
    assert.equal(ai.credits.balance(owner).remaining,9);
  } finally {ledger.close();}
});
