// Capture real packaged UI. Windows uses the exact submitted AppX.
// macOS uses a separately labelled, ad-hoc UI-only build; never a submission artifact.
// No mocked account, synthetic UI, DOM rewriting or marketing overlays.
import { _electron as electron, expect } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir, release } from 'node:os';
import path from 'node:path';

const mac = process.platform === 'darwin';
if ((!mac && process.platform !== 'win32') || !process.env.CAVIARD_EXECUTABLE) throw Error('Requires a native packaged executable');
if (mac && process.env.INKLURA_CAPTURE_UI_ONLY !== 'true') throw Error('macOS capture must explicitly acknowledge UI-only provenance');
const output = path.resolve('output/store-screenshots');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'inklura-store-capture-'));
const document = await PDFDocument.create();
const font = await document.embedFont(StandardFonts.Helvetica);
const bold = await document.embedFont(StandardFonts.HelveticaBold);
const sheet = document.addPage([595, 842]);
sheet.drawRectangle({ x: 0, y: 740, width: 595, height: 102, color: rgb(.08, .18, .24) });
sheet.drawText('ATELIER DEMONSTRATION', { x: 42, y: 794, size: 19, font: bold, color: rgb(1, 1, 1) });
sheet.drawText('Dossier client - exemple fictif', { x: 42, y: 766, size: 12, font, color: rgb(.8, .9, .9) });
const lines = [
  [690, 'FICHE DE CONTACT', true],
  [652, 'Client : Camille Exemple'],
  [627, 'Adresse : 12 rue de la Demonstration, 75000 Paris'],
  [602, 'E-mail : camille.exemple@example.com'],
  [550, 'OBJET DE LA DEMANDE', true],
  [513, 'Preparation de documents avant transmission a un partenaire.'],
  [486, 'Le dossier contient des coordonnees a retirer avant partage.'],
  [434, 'PIECES A TRANSMETTRE', true],
  [397, '1. Presentation du projet'],
  [370, '2. Planning previsionnel'],
  [343, '3. Document de travail sans coordonnees personnelles'],
  [277, 'Note : verifier chaque page avant de transmettre la copie.'],
];
for (const [y, text, strong] of lines) sheet.drawText(text, { x: 42, y, size: strong ? 13 : 11, font: strong ? bold : font, color: rgb(.1, .17, .22) });
sheet.drawText('DOCUMENT FICTIF - AUCUNE DONNEE CLIENT REELLE', { x: 42, y: 56, size: 10, font, color: rgb(.4, .45, .5) });
const pdf = path.join(profile, 'Dossier-demonstration.pdf');
await writeFile(pdf, await document.save());
let app;
const errors = [];
try {
  app = await electron.launch({ executablePath: process.env.CAVIARD_EXECUTABLE, args: [`--user-data-dir=${profile}`], timeout: 60000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(...(process.platform === 'darwin' ? [1440, 900] : [1600, 1000])));
  await expect(page.getByRole('button', { name: 'Choisir des fichiers', exact: true })).toBeEnabled();
  const info = await page.evaluate(() => window.caviardDesktop.info());
  expect(info.distributionChannel).toBe(mac ? 'mac-app-store' : 'microsoft-store');
  expect(info.platform).toBe(process.platform);
  expect(info.version).toBe('1.4.0');
  await expect(page.getByLabel('Version et mises à jour')).toContainText(mac ? 'gérées par App Store' : 'gérées par Microsoft Store');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(pdf);
  await expect(page.locator('.drawing-layer')).toBeVisible();
  await page.getByRole('button', { name: 'Réduire le zoom', exact: true }).click();
  await page.getByRole('button', { name: 'Réduire le zoom', exact: true }).click();
  await page.screenshot({ path: path.join(output, '01-document.png') });
  await page.getByRole('button', { name: 'Rechercher et profils' }).click();
  await page.getByLabel('Texte à masquer', { exact: true }).fill('camille.exemple@example.com');
  await page.getByRole('button', { name: 'Lancer la recherche' }).click();
  await expect(page.locator('.search-results li')).toHaveCount(1);
  await page.screenshot({ path: path.join(output, '02-recherche.png') });
  await page.getByRole('button', { name: /Ajouter 1 résultat/ }).click();
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Rechercher et caviarder' })).toBeHidden();
  // Use the real search workflow so every displayed demo coordinate is covered.
  for (const text of ['Camille Exemple', '12 rue de la Demonstration, 75000 Paris']) {
    await page.getByRole('button', { name: 'Rechercher et profils' }).click();
    await page.getByLabel('Texte à masquer', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Lancer la recherche' }).click();
    await expect(page.locator('.search-results li')).toHaveCount(1);
    await page.getByRole('button', { name: /Ajouter 1 résultat/ }).click();
    await expect(page.getByRole('dialog', { name: 'Rechercher et caviarder' })).toBeHidden();
  }
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(3);
  await page.getByLabel('Page relue', { exact: true }).check();
  await page.screenshot({ path: path.join(output, '03-relecture.png') });
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'provenance.json'), JSON.stringify({
    ...(mac ? { sourceCommit: process.env.GITHUB_SHA, sourceRun: process.env.GITHUB_RUN_ID } : { sourceRun: 41039014119, sourceSha256: 'd60a72e53bb3064ac3eb2605df9d3632b7800892e32af7a90ae40b58e70d8512' }),
    capture: mac ? 'Native macOS packaged UI, ad-hoc signature, App Store channel metadata; synthetic document; no account/authentication mocks' : 'Unmodified packaged UI extracted from AppX; synthetic document; no account/authentication mocks',
    platform: process.platform, osVersion: release(), info,
    checks: ['packaged launch', 'local PDF import', 'text search', 'three redactions', 'page review'],
    limitations: mac ? 'UI-only macOS CI build. Standard Electron, not MAS runtime: does not validate App Sandbox, StoreKit, provisioning, installed acceptance, export or App Store updates. Not for submission or distribution.' : 'Windows CI host, not Store-installed Windows 10/11 acceptance, live export, WACK or Store update validation',
  }, null, 2) + '\n');
} finally {
  if (app) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(win => win.destroy()));
    await app.close();
  }
  await rm(profile, { recursive: true, force: true });
}
