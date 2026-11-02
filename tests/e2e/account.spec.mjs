import { confirmExport } from "../ui-helpers.mjs";
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { DOCUMENT_PLANS } from '../../electron/commerce-catalog.mjs';
async function setup(page, signedIn = true, paymentsEnabled = false) {
  await page.addInitScript(({ plans, signedIn, paymentsEnabled }) => {
    let notify = () => {};
    const state = { enabled: true, phase: signedIn ? 'signed-in' : 'signed-out', account: signedIn ? { accountId: 'fixture', remaining: 0, reserved: 0 } : null, plans: plans.map(p => ({ ...p, purchasable: paymentsEnabled })), paymentsEnabled };
    window.caviardDesktop = {
      checkout: async (planId,billing) => { window.checkoutRequest={planId,billing}; return {opened:true}; },
      info: async () => ({ version: 'test' }), updateState: async () => ({ phase: 'disabled' }), onUpdate: () => () => {}, setDocumentState: () => {},
      accountState: async () => state, onAccount: fn => { notify = fn; return () => {}; },
      signIn: async () => notify({ ...state, phase: 'waiting', userCode: 'ABCD-EFGH' }),
      cancelSignIn: async () => notify(state),
      savePdf: async () => ({ saved: false, error: 'Vous avez utilisé tous vos crédits PDF. Votre travail reste ouvert.' }),
    };
  }, { plans: DOCUMENT_PLANS, signedIn, paymentsEnabled });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choisir des fichiers', exact: true })).toBeEnabled();
}
test('all approved plans are visible but purchases stay disabled pending payment activation', async ({ page }) => {
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
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(path.resolve('output/pdf/examples/invoice-01.pdf'));
  const layer = page.locator('.drawing-layer'); await expect(layer).toBeVisible(); await layer.scrollIntoViewIfNeeded();
  const b = await layer.boundingBox();
  await page.mouse.move(b.x + b.width * .15, b.y + b.height * .15); await page.mouse.down();
  await page.mouse.move(b.x + b.width * .8, b.y + b.height * .3, { steps: 5 }); await page.mouse.up();
  await page.getByRole('button', { name: /Exporter/ }).click();
  await confirmExport(page);
  await expect(page.getByRole('alert')).toContainText('tous vos crédits');
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Exporter/ })).toBeEnabled();
});
test('purchase displays TTC and requires metropolitan French billing before opening Stripe',async({page})=>{
 await setup(page,true,true);await page.getByRole('button',{name:'Offres et crédits'}).click();
 await page.getByRole('button',{name:'Choisir cette offre'}).first().click();
 const form=page.locator('.account-billing');await expect(form).toContainText('34,80');
 await form.getByLabel('Nom ou raison sociale').fill('Entreprise Exemple');await form.getByLabel('Adresse',{exact:true}).fill('1 rue Exemple');await form.getByLabel('Ville',{exact:true}).fill('Rennes');
 await form.getByLabel('Code postal').fill('97100');await form.getByRole('button',{name:/Continuer vers Stripe/}).click();
 expect(await page.evaluate(()=>window.checkoutRequest)).toBeUndefined();
 await form.getByLabel('Code postal').fill('35000');await form.getByRole('button',{name:/Continuer vers Stripe/}).click();
 await expect(form).toHaveCount(0);expect(await page.evaluate(()=>window.checkoutRequest)).toEqual({planId:'volume-100',billing:{name:'Entreprise Exemple',line1:'1 rue Exemple',city:'Rennes',postalCode:'35000',country:'FR'}});
});

test('Mac App Store offers use Apple prices and never show the Stripe billing form', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { phase: 'signed-in', enabled: true, externalPurchases: false, plans: [],
      account: { accountId: 'synthetic-apple', remaining: 20, reserved: 0 },
      apple: { enabled: true, pending: false, message: '', products: [100, 500, 1000].map((n, i) => ({
        id: 'com.benfavre.caviard.credits' + n, documents: n, label: n + ' exports PDF',
        formattedPrice: ['34,90 €', '118,99 €', '178,99 €'][i],
      })) } };
    window.caviardDesktop = {
      info: async () => ({ version: 'test', distributionChannel: 'mac-app-store' }),
      updateState: async () => ({ phase: 'store' }), onUpdate: () => () => {}, setDocumentState: () => {},
      accountState: async () => state, onAccount: () => () => {}, refreshAccount: async () => state,
      purchaseAppleCredits: async productId => { window.applePurchase = productId; return { queued: true }; },
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Offres et crédits' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crédits PDF · App Store' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('article')).toHaveCount(3);
  await expect(dialog).toContainText('34,90 €');
  await expect(dialog).toContainText('n’expirent pas');
  await expect(page.getByRole('button', { name: 'Facturation', exact: true })).toHaveCount(0);
  await expect(dialog.locator('.account-billing')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Acheter avec l’App Store' }).first().click();
  expect(await page.evaluate(() => window.applePurchase)).toBe('com.benfavre.caviard.credits100');
  await expect(page.getByText('20 PDF disponibles')).toBeVisible(); // queued does not invent credits
});

test('PDF account deletion explains shared-identity scope and requires exact confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    let notify = () => {};
    const state = { phase:'signed-in', accountDeletionEnabled:true, account:{accountId:'deletion-fixture',remaining:20}, externalPurchases:false, plans:[] };
    window.caviardDesktop = {
      info:async()=>({version:'test'}), updateState:async()=>({phase:'disabled'}), onUpdate:()=>()=>{}, setDocumentState:()=>{},
      accountState:async()=>state, onAccount:fn=>{notify=fn;return()=>{};}, refreshAccount:async()=>state,
      deletePdfAccount:async confirmation=>{window.deletionConfirmation=confirmation;notify({...state,phase:'signed-out',account:null,message:'La suppression de votre compte PDF est enregistrée.'});return{state:'pending'};}
    };
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Supprimer mon compte PDF',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Supprimer mon compte PDF'});
  await expect(dialog).toContainText('autres produits Inklura restent accessibles');
  const button=dialog.getByRole('button',{name:'Supprimer définitivement mon compte PDF'});
  await expect(button).toBeDisabled();
  await dialog.getByLabel(/Pour confirmer/).fill('SUPPRIMER MON COMPTE PDF');
  await expect(button).toBeEnabled();await button.click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>window.deletionConfirmation)).toBe('SUPPRIMER MON COMPTE PDF');
  await expect(page.getByRole('alert')).toContainText('suppression');
});
