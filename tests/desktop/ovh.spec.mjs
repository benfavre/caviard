import { confirmExport } from "../ui-helpers.mjs";
import { test, expect, _electron as electron } from '@playwright/test';
import { once } from 'node:events';
import path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { Ledger, BillingError } from '../../server/ledger.mjs';
import { IncludedAI } from '../../server/ai.mjs';
import { Payments } from '../../server/payments.mjs';
import { createApi } from '../../server/http.mjs';
let app, page, server, ledger, owner, ai, requests, mode, errors;
test.beforeEach(async ({}, info) => {
  test.skip(info.title.startsWith('live authenticated') && !process.env.OVH_LIVE_TEST, 'Explicit opt-in required for live OVH usage');
  ledger = new Ledger(); owner = ledger.account('native-fixture', 'alice').id;
  requests = []; mode = 'success'; errors = [];
  const live = info.title.startsWith('live authenticated');
  ai = new IncludedAI({ ledger, apiKey: live ? process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN : 'synthetic-server-key',
    fetchImpl: live ? undefined : async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      if (mode === 'hold') return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted'))));
      if (mode === 'quota') return new Response('synthetic provider error', { status: 429 });
      const value = body.messages[0].content.startsWith('Classify') ? { categories: ['person'] }
        : { entities: [{ text: mode === 'hallucinate' ? 'Invented Person' : 'Alice Martin', label: 'person' }] };
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));
    } });
  server = createApi({ ledger, ai, payments: new Payments({ ledger }), clientId: 'native-fixture', publicUrl: 'http://127.0.0.1',
    authenticate: async auth => { if (auth !== 'Bearer native-fixture-token') throw new BillingError('sign_in_required', 401); return { issuer: 'native-fixture', subject: 'alice' }; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  app = await electron.launch({ ...(process.env.CAVIARD_EXECUTABLE ? {executablePath:process.env.CAVIARD_EXECUTABLE,args:[`--user-data-dir=${info.outputPath('profile')}`]} : {args:[path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`]}),
    env: { ...process.env, OVH_AI_ENDPOINTS_ACCESS_TOKEN: '', INKLURA_PDF_ACCOUNT_API: `http://127.0.0.1:${server.address().port}` } });
  // The real HTTP service and ledger run above; only OAuth login is a fixture.
  await app.evaluate(async ({ app }) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
    const { AccountController } = require(app.getAppPath() + '/electron/account.mjs');
    const initialize = AccountController.prototype.initialize;
    AccountController.prototype.initialize = async function () {
      // Packaged applications deliberately ignore environment endpoint overrides.
      this.apiUrl = process.env.INKLURA_PDF_ACCOUNT_API;
      await initialize.call(this);
      this.acceptTokens({ token_type: 'bearer', access_token: 'native-fixture-token', expires_in: 3600 });
      return this.refresh();
    };
  });
  page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('complementary', { name: 'Compte Inklura et crédits PDF' })).toContainText('20 PDF disponibles');
  await expect(page.getByRole('button', { name: 'Choisir des fichiers', exact: true })).toBeEnabled();
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Client : Alice Martin', { x: 40, y: 700, size: 14 });
  const input = info.outputPath('synthetic-contact.pdf');
  await mkdir(path.dirname(input), { recursive: true }); await writeFile(input, await pdf.save());
  await page.locator('input[type=file]').first().setInputFiles(input);
  await expect(page.locator('.drawing-layer')).toBeVisible();
  await page.getByRole('button', { name: '✦ Assistant local +', exact: true }).click();
  await page.getByLabel('Moteur de l’assistant').selectOption('ovh');
});
test.afterEach(async () => {
  if (app) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())); await app.close(); app = null; }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null; }
  ledger?.close(); ledger = null;
  expect(errors || []).toEqual([]);
});
const consent = () => page.getByRole('checkbox', { name: /J’autorise l’envoi à Inklura et OVHcloud/ });
const scan = () => page.getByRole('button', { name: 'Rechercher les informations', exact: true });
async function analyze() {
  await consent().check(); await scan().click();
  await expect(page.locator('.suggestion')).toHaveCount(1, { timeout: 55000 });
  expect(ledger.balance(owner).remaining).toBe(20);
  expect(ledger.balance(owner).reserved).toBe(0);
  expect(ai.credits.balance(owner).remaining).toBe(9);
  expect(ai.credits.balance(owner).reserved).toBe(0);
}
async function apply() { await page.getByRole('button', { name: 'Ajouter la sélection à l’aperçu', exact: true }).click(); await expect(page.locator('.redaction:not(.draft)')).toHaveCount(1); }
async function save(info) {
  const file = info.outputPath('redacted.pdf');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
  await page.getByRole('button', { name: /Exporter le PDF/ }).click();
  await confirmExport(page);
  await expect(page.getByRole('status')).toContainText('enregistré');
  expect((await readFile(file)).subarray(0,5).toString()).toBe('%PDF-');
  expect(ledger.balance(owner).remaining).toBe(19);
  expect(ledger.balance(owner).reserved).toBe(0);
  expect(ai.credits.balance(owner).remaining).toBe(9);
  await expect(page.getByRole('complementary', { name: 'Compte Inklura et crédits PDF' })).toContainText('19 PDF disponibles');
}
test('hosted analysis uses one AI credit; successful native export uses one separate PDF credit', async ({}, info) => {
  await expect(scan()).toBeDisabled(); expect(requests).toHaveLength(0);
  await expect(page.getByLabel('Clé API OVHcloud AI Endpoints')).toHaveCount(0);
  await analyze(); await expect(page.locator('.suggestion')).toContainText('Mistral · OVHcloud');
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(0);
  expect(JSON.stringify(requests)).not.toContain('synthetic-contact.pdf');
  await apply(); await page.getByTitle('Annuler (Ctrl/Cmd+Z)', { exact: true }).click();
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(0);
  expect(ledger.balance(owner).remaining).toBe(20);
  await apply(); await save(info);
  await page.screenshot({ path: info.outputPath('ovh-export-credit.png') });
});
test('planning is included; analysis costs one AI credit and provider change resets consent', async () => {
  await consent().check();
  await page.getByRole('tab', { name: 'Instruction libre', exact: true }).click();
  await page.getByLabel('Que souhaitez-vous masquer ?').fill('Masque les noms.');
  await page.getByRole('button', { name: 'Préparer le plan', exact: true }).click();
  await expect(page.locator('.instruction-plan')).toContainText('Plan proposé');
  expect(JSON.stringify(requests)).not.toContain('Alice Martin');
  expect(ledger.balance(owner).remaining).toBe(20);
  expect(ai.credits.balance(owner).remaining).toBe(10);
  await scan().click(); await expect(page.locator('.suggestion')).toHaveCount(1);
  expect(ledger.balance(owner).remaining).toBe(20);
  expect(ai.credits.balance(owner).remaining).toBe(9);
  await page.getByLabel('Moteur de l’assistant').selectOption('local');
  await page.getByLabel('Moteur de l’assistant').selectOption('ovh');
  await expect(consent()).not.toBeChecked();
});
test('cancelled Save and failed disk write consume no export credit after AI analysis', async ({}, info) => {
  await analyze(); await apply();
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  await page.getByRole('button', { name: /Exporter le PDF/ }).click();
  await confirmExport(page);
  await expect(page.getByRole('status')).toContainText('annulé');
  expect(ledger.balance(owner).remaining).toBe(20);
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, info.outputPath('nonexistent-dir/redacted.pdf'));
  await page.getByRole('button', { name: /Exporter le PDF/ }).click();
  await confirmExport(page);
  await expect(page.locator('.message.error')).toBeVisible();
  expect(ledger.balance(owner).remaining).toBe(20); expect(ledger.balance(owner).reserved).toBe(0);
});
test('native cancellation aborts the provider and costs no credits', async () => {
  mode = 'hold'; await consent().check(); await scan().click();
  await expect.poll(() => requests.length).toBe(1);
  await page.getByRole('button', { name: 'Annuler l’analyse', exact: true }).click();
  await expect(page.locator('.ai-error')).toContainText('annulée');
  await expect.poll(() => ai.active.size).toBe(0);
  expect(ledger.balance(owner).remaining).toBe(20);
  mode = 'success'; await scan().click(); await expect(page.locator('.suggestion')).toHaveCount(1);
});
for (const failure of ['quota', 'hallucinate']) test(`${failure} response creates no redactions and consumes no credit`, async () => {
  mode = failure; await consent().check(); await scan().click();
  await expect(page.locator('.ai-error')).toContainText('aucun crédit consommé');
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(0);
  expect(ledger.balance(owner).remaining).toBe(20);
});
test('exhausted AI credits block hosted AI while PDF credits remain usable', async () => {
  ledger.db.prepare('UPDATE ai_grants SET used=total WHERE account=?').run(owner);
  await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Compte Inklura et crédits PDF' })).toContainText('0 crédits IA');
  await consent().check(); await expect(scan()).toBeDisabled();
  const error = await page.evaluate(async () => { try { await window.caviardDesktop.ovhRequest('analyze', { blocks: [{text: 'Alice Martin', labels: ['person']}] }, true); } catch (e) { return e.message; } });
  expect(error).toContain('crédits'); expect(requests).toHaveLength(0);
});
test('live authenticated OVH uses one AI credit and a separate credit for native export', async ({}, info) => {
  await analyze(); await apply(); await save(info);
  await page.screenshot({ path: info.outputPath('live-ovh-export-credit.png') });
});

test('own key bypasses hosted AI credits and is never sent to the Inklura service', async () => {
  await app.evaluate(() => {
    const original=globalThis.fetch;
    globalThis.fetch=async(url,options)=>url==='https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions'
      ? new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({entities:[{text:'Alice Martin',label:'person'}]})}}]}))
      : original(url,options);
  });
  await page.getByLabel('Moteur de l’assistant').selectOption('ovh-own');
  await page.getByLabel('Clé API OVHcloud AI Endpoints').fill('synthetic-personal-key');
  await page.getByRole('button',{name:'Utiliser pour cette session',exact:true}).click();
  await expect(page.getByLabel('Clé API OVHcloud AI Endpoints')).toHaveValue('');
  await page.getByRole('checkbox',{name:/J’autorise l’envoi à OVHcloud/}).check();
  await scan().click();await expect(page.locator('.suggestion')).toHaveCount(1);
  expect(requests).toHaveLength(0);expect(ai.credits.balance(owner).remaining).toBe(10);
  expect(ledger.balance(owner).remaining).toBe(20);
  await page.getByRole('button',{name:'Oublier la clé',exact:true}).click();
  expect(await page.evaluate(()=>window.caviardDesktop.ownOvhState())).toEqual({configured:false,model:'mistral@latest'});
});
test('AI purchase choice opens the approved separate 100-credit pack', async () => {
  await page.getByRole('button',{name:'Acheter des crédits IA · 6 € TTC',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Offres et crédits'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Facturation · IA · 100 analyses'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continuer vers Stripe · 6,00 € TTC',exact:true})).toBeVisible();
  expect(ai.credits.balance(owner).remaining).toBe(10);expect(ledger.balance(owner).remaining).toBe(20);
});
