import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
let app,
  page,
  requests = [];
test.beforeAll(async () => {
  if (!process.env.INKLURA_AI_MODELS)
    throw new Error("Set INKLURA_AI_MODELS to a verified model cache.");
  app = await electron.launch({ args: [path.resolve(".")], env: process.env });
  page = await app.firstWindow();
  // Block external network at the Electron session, including worker requests.
  await app.evaluate(({ session }) => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
  expect(
    (await page.evaluate(() => window.caviardDesktop.models())).phase,
  ).toBe("ready");
});
test.afterAll(async () => {
  if (app) {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
  }
  expect(requests).toEqual([]);
});
async function open(filename) {
  if (
    await page
      .getByRole("button", { name: "Fermer ce document", exact: true })
      .count()
  ) {
    await page
      .getByRole("button", { name: "Fermer ce document", exact: true })
      .click();
    if (
      await page
        .getByRole("dialog")
        .filter({ hasText: "Fermer sans exporter" })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Fermer sans exporter", exact: true })
        .click();
  }
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("output/pdf/ai-examples", filename));
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await page.getByRole("button", { name: /Assistant local/ }).click();
}
test("real detector and OCR propose French PII, preview and undo remain local", async () => {
  await open("contact-0.pdf");
  await page
    .getByRole("button", { name: "Rechercher les informations", exact: true })
    .click();
  await expect(page.locator(".assistant-results")).toBeVisible({
    timeout: 180000,
  });
  await expect(page.locator(".assistant-results")).toContainText(
    "Élodie Martin",
  );
  await expect(page.locator(".assistant-results")).toContainText(
    "elodie.martin@example.fr",
  );
  await expect(page.locator(".assistant-results")).toContainText("OCR");
  await page.locator(".suggestion button").first().click();
  await expect(page.locator(".ai-region").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Ajouter la sélection à l’aperçu" })
    .click();
  expect(await page.locator(".redaction:not(.draft)").count()).toBeGreaterThan(
    3,
  );
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(0);
  await page.screenshot({
    path: "output/test-report/ai-suggestions.png",
    fullPage: true,
  });
});
for (const angle of [0, 90, 180, 270])
  test(`automatic banking policy scans ${angle}° image-only pages and adds one undoable preview`, async () => {
    await open(`scan-${angle}.pdf`);
    await page.getByRole("tab", { name: "Politique automatique" }).click();
    await page.locator(".policy-select select").selectOption("finance");
    await page
      .getByRole("button", { name: "Appliquer la politique et prévisualiser" })
      .click();
    await expect(page.locator(".assistant-results")).toBeVisible({
      timeout: 180000,
    });
    await expect(page.locator(".assistant-results")).toContainText("4111");
    expect(
      await page.locator(".redaction:not(.draft)").count(),
    ).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(page.locator(".redaction:not(.draft)")).toHaveCount(0);
  });
test("real instruction model proposes editable categories and produces a reviewed preview", async () => {
  await open("contact-90.pdf");
  await page.getByRole("tab", { name: "Instruction libre" }).click();
  await page
    .getByLabel("Que souhaitez-vous masquer ?")
    .fill("Cache tous les noms et les adresses e-mail.");
  await page.getByRole("button", { name: "Préparer le plan" }).click();
  await expect(page.locator(".instruction-plan")).toBeVisible({
    timeout: 180000,
  });
  await expect(
    page.locator(".instruction-plan").getByLabel("Noms de personnes"),
  ).toBeChecked();
  await expect(
    page.locator(".instruction-plan").getByLabel("Adresses e-mail"),
  ).toBeChecked();
  await page.getByLabel("Analyser aussi les images").uncheck();
  await page
    .getByRole("button", { name: "Rechercher les informations", exact: true })
    .click();
  await expect(page.locator(".assistant-results")).toBeVisible({
    timeout: 180000,
  });
  await expect(page.locator(".assistant-results")).toContainText(
    "Élodie Martin",
  );
  await page.locator(".suggestion button").first().click();
  await expect(page.locator(".ai-region").first()).toBeVisible();
  await page.screenshot({
    path: "output/test-report/ai-instruction.png",
    fullPage: true,
  });
});
test("cancelling an analysis leaves the document editable with no applied regions", async () => {
  await open("mixed-0.pdf");
  await page
    .getByRole("button", { name: "Rechercher les informations", exact: true })
    .click();
  await page.getByRole("button", { name: "Annuler l’analyse" }).click();
  await expect(page.locator(".ai-error")).toContainText("annulée");
  await expect(
    page.getByRole("button", {
      name: "Rechercher les informations",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(0);
});
