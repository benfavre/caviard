import { test, expect } from '@playwright/test';
import path from 'node:path';
import { DOCUMENT_PLANS } from '../../electron/commerce-catalog.mjs';
async function setup(page, signedIn = true) {
  await page.addInitScript(({ plans, signedIn }) => {
    let notify = () => {};
    const state = { enabled: true, phase: signedIn ? 'signed-in' : 'signed-out', account: signedIn ? { accountId: 'fixture', remaining: 0, reserved: 0 } : null, plans: plans.map(p => ({ ...p, purchasable: false })), paymentsEnabled: false };
    window.caviardDesktop = {
      info: async () => ({ version: 'test' }), updateState: async () => ({ phase: 'disabled' }), onUpdate: () => () => {}, setDocumentState: () => {},
      accountState: async () => state, onAccount: fn => { notify = fn; return () => {}; },
      signIn: async () => notify({ ...state, phase: 'waiting', userCode: 'ABCD-EFGH' }),
      cancelSignIn: async () => notify(state),
      savePdf: async () => ({ saved: false, error: 'Vous avez utilisé tous vos crédits PDF. Votre travail reste ouvert.' }),
    };
  }, { plans: DOCUMENT_PLANS, signedIn });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choisir des fichiers', exact: true })).toBeEnabled();
}
test('all approved plans are visible but purchases stay disabled pending pricing approval', async ({ page }) => {
  await setup(page);
  await expect(page.getByText('0 PDF disponibles')).toBeVisible();
  await page.getByRole('button', { name: 'Offres et crédits' }).click();
  await expect(page.locator('.account-offers article')).toHaveCount(6);
  for (const button of await page.locator('.account-offers article button').all()) await expect(button).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Facturation', exact: true })).toBeDisabled();
  await expect(page.locator('.account-offers')).toContainText('Les achats ne sont pas encore activés');
});
test('device code is displayed and login can be canceled', async ({ page }) => {
  await setup(page, false);
  await page.getByRole('button', { name: 'Se connecter à Inklura' }).click();
  await expect(page.getByText(/Confirmez le code ABCD-EFGH/)).toBeVisible();
  await page.getByRole('button', { name: 'Annuler la connexion' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter à Inklura' })).toBeEnabled();
});
test('exhausted quota blocks export without discarding the PDF or redaction selections', async ({ page }) => {
  await setup(page);
  await page.locator('input[type=file]').setInputFiles(path.resolve('output/pdf/examples/invoice-01.pdf'));
  const layer = page.locator('.drawing-layer'); await expect(layer).toBeVisible(); await layer.scrollIntoViewIfNeeded();
  const b = await layer.boundingBox();
  await page.mouse.move(b.x + b.width * .15, b.y + b.height * .15); await page.mouse.down();
  await page.mouse.move(b.x + b.width * .8, b.y + b.height * .3, { steps: 5 }); await page.mouse.up();
  await page.getByRole('button', { name: /Exporter/ }).click();
  await expect(page.getByRole('alert')).toContainText('tous vos crédits');
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Exporter/ })).toBeEnabled();
});
