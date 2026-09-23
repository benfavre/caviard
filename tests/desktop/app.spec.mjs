import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
const version = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;
import { loadPdf, render } from "../helpers.mjs";
let app, page, errors;
test.beforeEach(async () => {
  app = await electron.launch({
    ...(process.env.CAVIARD_EXECUTABLE
      ? { executablePath: process.env.CAVIARD_EXECUTABLE, args: [] }
      : { args: [path.resolve(".")] }),
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "false" },
  });
  page = await app.firstWindow();
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
});
test.afterEach(async () => {
  await app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
  });
  await app.close();
  expect(errors).toEqual([]);
});
async function edit() {
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("output/pdf/examples/invoice-01.pdf"));
  const layer = page.locator(".drawing-layer");
  await expect(layer).toBeVisible();
  await layer.scrollIntoViewIfNeeded();
  const b = await layer.boundingBox();
  await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.3, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
}
// Substitute only the account boundary inside the Playwright-controlled main
// process. The shipped application has no test flag or authentication bypass.
async function fixtureAccount() {
  await app.evaluate(async ({ app }) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
    const { AccountController } = require(app.getAppPath() + '/electron/account.mjs');
    AccountController.prototype.refresh = async function () {
      this.account = { accountId: 'packaged-test', remaining: 20, reserved: 0 };
      this.phase = 'signed-in'; return this.publish();
    };
    AccountController.prototype.request = async function (route) {
      if (!['/v1/exports/reserve', '/v1/exports/commit', '/v1/exports/release'].includes(route)) throw Error('Unexpected fixture request');
      return { remaining: 20 };
    };
  });
}
test("sandboxed renderer and bundled assets work without a server", async () => {
  expect(page.url()).toBe("caviard://app/");
  await expect(page).toHaveTitle("Inklura PDF — Caviardage");
  expect(await app.evaluate(({ app }) => app.getName())).toBe("Inklura PDF");
  expect(
    await page.locator('a[href*="pdfux"], a[href*="buymeacoffee"]').count(),
  ).toBe(0);
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  expect(
    await app.evaluate(({ BrowserWindow }) => {
      const p =
        BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {
        sandbox: p.sandbox,
        contextIsolation: p.contextIsolation,
        nodeIntegration: p.nodeIntegration,
      };
    }),
  ).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
  const info = await page.evaluate(() => window.caviardDesktop.info());
  expect(info.version).toBe(version);
  const packaged = await app.evaluate(({ app }) => app.isPackaged);
  const button = page.getByRole("button", {
    name: "Rechercher une mise à jour",
    exact: true,
  });
  if (packaged && info.platform === "win32") await expect(button).toBeEnabled();
  else if (info.platform !== "darwin") await expect(button).toBeDisabled();
});
test("native Save dialog exports black pixels and removes searchable text", async ({}, info) => {
  await fixtureAccount();
  await edit();
  const destination = info.outputPath("redacted.pdf");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, destination);
  await page.getByRole("button", { name: /Exporter/ }).click();
  await expect(page.getByRole("status")).toContainText("enregistré");
  const result = await loadPdf(destination);
  try {
    const first = await result.pdf.getPage(1);
    expect((await first.getTextContent()).items).toHaveLength(0);
    const canvas = await render(first);
    expect([
      ...canvas.getContext("2d").getImageData(100, 130, 1, 1).data,
    ]).toEqual([0, 0, 0, 255]);
  } finally {
    await result.task.destroy();
  }
});
test('account-enabled build refuses unauthenticated export and preserves edits', async ({}, info) => {
  const configured = await app.evaluate(async ({ app }) => {
    const { readFile } = process.getBuiltinModule('fs/promises');
    return !!JSON.parse(await readFile(app.getAppPath() + '/package.json', 'utf8')).accountApi || !!process.env.INKLURA_PDF_ACCOUNT_API;
  });
  test.skip(!configured, 'Evaluation build has no account gate');
  await edit();
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, info.outputPath('must-not-exist.pdf'));
  await page.getByRole('button', { name: /Exporter/ }).click();
  await expect(page.getByRole('alert')).toContainText('Connectez-vous');
  await expect(page.locator('.redaction:not(.draft)')).toHaveCount(1);
  const { existsSync } = await import('node:fs');
  expect(existsSync(info.outputPath('must-not-exist.pdf'))).toBe(false);
});
test("canceling native Save preserves selections and does not report success", async () => {
  await edit();
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await page.getByRole("button", { name: /Exporter/ }).click();
  await expect(page.getByRole("status")).toContainText("annulé");
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
});
test("closing unsaved work can be canceled; logo navigation cannot discard it", async () => {
  await edit();
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0 });
  });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  await page.locator(".logo").click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
});
