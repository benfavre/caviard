import test from "node:test";
import assert from "node:assert/strict";
import { OvhMistral, OVH_ENDPOINT, exactEntities } from "../../electron/ovh-mistral.mjs";
const key = "synthetic-test-token";
const payload = { text: "Élodie Martin rencontre Élodie Martin.", labels: ["person"] };
const response = (answer, finish_reason = "stop") => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(answer) }, finish_reason }],
}));
function fixture(fetchImpl) {
  const client = new OvhMistral({ fetchImpl });
  client.configure({ apiKey: key });
  return client;
}
test("OVH requires an explicit consent and a key; configuration never sends a request or exposes the key", async () => {
  let calls = 0;
  const client = new OvhMistral({ fetchImpl: async () => { calls++; return response({ entities: [] }); } });
  await assert.rejects(client.request("detect", payload, true), /clé API/);
  assert.deepEqual(client.configure({ apiKey: key }), { configured: true, model: "mistral@latest" });
  assert.equal(JSON.stringify(client).includes(key), false);
  for (const consent of [false, undefined, "true"]) await assert.rejects(client.request("detect", payload, consent), /Autorisez/);
  assert.equal(calls, 0);
  client.clear();
  assert.equal(client.snapshot().configured, false);
});
test("only a fixed OVH HTTPS endpoint receives bounded text and the key, with redirects disabled", async () => {
  let sent;
  const client = fixture(async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    return response({ entities: [{ text: "Élodie Martin", label: "person" }] });
  });
  const found = await client.request("detect", { ...payload, filename: "private.pdf", pdf: "must-not-send" }, true);
  assert.equal(sent.url, OVH_ENDPOINT);
  assert.equal(sent.options.redirect, "error");
  assert.equal(sent.options.headers.Authorization, `Bearer ${key}`);
  assert.equal(sent.body.max_tokens, 2048);
  assert.equal(sent.body.stream, false);
  assert.equal(sent.options.body.includes("private.pdf"), false);
  assert.equal(sent.options.body.includes("must-not-send"), false);
  assert.deepEqual(found.map(e => [e.start, e.end, e.source]), [[0, 13, "ovh"], [24, 37, "ovh"]]);
});
test("hallucinations, unknown labels and malformed output fail instead of creating guessed rectangles", () => {
  for (const value of [{}, { entities: "oops" }, { entities: [null] },
    { entities: [{ text: "Alice", label: "person" }] },
    { entities: [{ text: "Élodie Martin", label: "password" }] },
    { entities: [{ text: "", label: "person" }] }])
    assert.throws(() => exactEntities(value, payload.text, payload.labels));
  assert.deepEqual(exactEntities({ entities: [] }, payload.text, payload.labels), []);
});
test("planning sends only the instruction and preserves local literal/exclusion rules", async () => {
  let body;
  const client = fixture(async (_url, opts) => {
    body = JSON.parse(opts.body);
    return response({ categories: ["person", "email"], exclude: ["invented"] });
  });
  const plan = await client.request("plan", { instruction: 'Masque les noms et emails sauf « Inklura »', document: payload.text }, true);
  assert.deepEqual(plan, { categories: ["person", "email"], literals: [], exclude: ["Inklura"] });
  assert.equal(JSON.stringify(body).includes(payload.text), false);
  assert.equal(body.max_tokens, 256);
  await assert.rejects(client.request("plan", { instruction: "Ne pas masquer les noms" }, true), /manuelle/);
});
test("invalid operations, oversized input and invalid model/token values never contact OVH", async () => {
  let calls = 0;
  const client = fixture(async () => { calls++; return response({}); });
  for (const [type, value] of [["shell", {}], ["detect", { ...payload, text: "x".repeat(12001) }],
    ["detect", { ...payload, labels: ["secret"] }], ["plan", { instruction: "x".repeat(1001) }]])
    await assert.rejects(client.request(type, value, true));
  for (const config of [{ apiKey: "bad\nkey" }, { model: "https://evil.invalid/mistral" }, { model: "qwen" }])
    assert.throws(() => client.configure(config));
  assert.equal(calls, 0);
});
test("OVH error bodies and transport errors never expose credentials or document text", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const client = fixture(async () => new Response(`${key} ${payload.text}`, { status }));
    await assert.rejects(client.request("detect", payload, true), error =>
      !error.message.includes(key) && !error.message.includes(payload.text));
  }
  const client = fixture(async () => { throw new Error(`${key} ${payload.text}`); });
  await assert.rejects(client.request("detect", payload, true), /Connexion à OVHcloud/);
});
test("truncated responses and invalid plans cannot be treated as complete suggestions", async () => {
  const client = fixture(async () => response({ entities: [] }, "length"));
  await assert.rejects(client.request("detect", payload, true), /incomplète/);
  const invalidPlan = fixture(async () => response({ categories: ["password"] }));
  await assert.rejects(invalidPlan.request("plan", { instruction: "Masque les secrets" }, true), /Catégories/);
});
test("oversized streamed replies are rejected even without a Content-Length header", async () => {
  const client = fixture(async () => new Response("x".repeat(256 * 1024 + 1)));
  await assert.rejects(client.request("detect", payload, true), /volumineuse/);
});
test("cancel stops an in-flight request, rejects concurrent work, and allows retry", async () => {
  let started;
  const start = new Promise(resolve => { started = resolve; });
  const client = fixture(async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")));
    started();
  }));
  const pending = client.request("detect", payload, true);
  await start;
  await assert.rejects(client.request("detect", payload, true), /déjà en cours/);
  assert.throws(() => client.configure({ apiKey: "another-key" }), /fin de l’analyse/);
  client.cancel();
  await assert.rejects(pending, /annulée/);
  client.fetchImpl = async () => response({ entities: [] });
  assert.deepEqual(await client.request("detect", payload, true), []);
});
test("timeout aborts the connection and leaves the next request usable", async () => {
  const client = new OvhMistral({ timeoutMs: 5, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("timeout")));
  }) });
  client.configure({ apiKey: key });
  await assert.rejects(client.request("detect", payload, true), /pas répondu à temps/);
  client.fetchImpl = async () => response({ entities: [] });
  assert.deepEqual(await client.request("detect", payload, true), []);
});
