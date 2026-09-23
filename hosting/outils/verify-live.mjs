// Verify the public page and exact installer bytes, without running installers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = process.env.INKLURA_DOWNLOAD_ORIGIN || 'https://outils.inklura.fr';
const release = JSON.parse(await readFile(new URL('./site/src/lib/inklura-pdf-release.json', import.meta.url)));
const output = new URL('../../output/hosting-verification/', import.meta.url);
await mkdir(output, { recursive: true });
const pagesOnly = process.argv.includes("--pages-only");
const results = { origin, version: release.version, downloadsSkipped: pagesOnly, downloads: [], pages: [] };
for (const asset of pagesOnly ? [] : release.assets) {
  const url = origin + asset.url;
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200, asset.name);
  assert.equal(Number(head.headers.get('content-length')), asset.size);
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  const range = await fetch(url, { headers: { Range: 'bytes=0-4095' } });
  assert.equal(range.status, 206, 'Resumable download: ' + asset.name);
  assert.equal((await range.arrayBuffer()).byteLength, 4096);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.url, url, 'Installer must be hosted directly, without redirect');
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of response.body) { hash.update(chunk); bytes += chunk.length; }
  assert.equal(bytes, asset.size);
  assert.equal(hash.digest('hex'), asset.sha256, asset.name + ' integrity');
  results.downloads.push({ name: asset.name, bytes, sha256: asset.sha256, range: 206 });
  console.log('Download verified:', asset.name);
}
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, width, dark, js] of [['desktop', 1440, false, true], ['mobile', 390, false, true], ['dark', 1440, true, true], ['no-js', 390, false, false]]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme: dark ? 'dark' : 'light', javaScriptEnabled: js });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(origin + '/inklura-pdf', { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.match(await page.title(), /^Inklura PDF/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), origin + '/inklura-pdf');
    assert.equal(await page.locator('#telecharger a[download]').count(), 4);
    assert.equal(await page.locator('.ipdf-start li').count(), 3);
    assert.equal(await page.locator('#exemples a[download]').count(), 2);
    for (const id of ['windows', 'mac-apple', 'mac-intel', 'linux']) {
      assert.equal(await page.locator('#' + id + ' a[download]').count(), 1);
    }
    assert.ok(await page.getByRole('link', { name: 'Lire le guide de démarrage' }).getAttribute('href'));
    for (const link of await page.locator('#telecharger a[download]').all()) {
      const href = await link.getAttribute("href");
      assert.ok(release.assets.some(a => a.url === href));
    }
    assert.ok(await page.locator('.ipdf-screenshot img').evaluate(img => img.complete && img.naturalWidth > 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' horizontal overflow');
    assert.equal(await page.locator('.ipdf-hero').evaluate(el => getComputedStyle(el).display), 'grid');
    const summary = page.getByText('Puis-je utiliser l’application sans IA ?', { exact: true });
    await summary.click();
    assert.equal(await page.locator('.ipdf-faq details').first().getAttribute('open'), '');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: new URL(label + '.png', output).pathname, fullPage: true });
    assert.deepEqual(errors, [], 'Browser errors');
    results.pages.push({ label, status: response.status(), overflow: false, errors });
    await context.close();
  }
  const page = await browser.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  const cards = page.locator('a[data-tool-card]');
  assert.ok(await cards.count() >= 51, 'Preserve existing tools');
  await page.locator('[data-filter-search]').fill('caviardage');
  const tile = page.locator('a[data-tool-card][href="/inklura-pdf"]');
  await tile.waitFor({ state: 'visible' });
  await tile.click();
  await page.waitForURL('**/inklura-pdf');
  assert.match(await page.title(), /^Inklura PDF/);
  await page.goto(origin + '/inklura-pdf#mac-apple');
  const target = page.locator('#mac-apple');
  await target.waitFor({ state: 'visible' });
  assert.equal(await target.evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(20, 107, 255)');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: '159 PDF d’exemple' }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'example-pdfs.zip');
  assert.equal(await download.failure(), null);
  const previous = await page.goto(origin + '/fusionner-pdf');
  assert.equal(previous.status(), 200);
  console.log('Page, mobile, dark mode, no-JS, catalog search and existing tool verified');
} finally { await browser.close(); }
await writeFile(new URL(pagesOnly ? 'pages-report.json' : 'report.json', output), JSON.stringify(results, null, 2) + '\n');
