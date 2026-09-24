import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
let app, page, directory;
async function launch() {
  const args = [`--user-data-dir=${directory}`];
  app = await electron.launch(
    process.env.CAVIARD_EXECUTABLE
      ? { executablePath: process.env.CAVIARD_EXECUTABLE, args }
      : { args: [path.resolve("."), ...args] },
  );
  expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(
    directory,
  );
  page = await app.firstWindow();
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
}
test.beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "inklura-project-e2e-"));
  await launch();
});
test.afterEach(async () => {
  if (app) {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    app = null;
  }
  await rm(directory, { recursive: true, force: true });
});
test("packaged local projects survive a full restart without uploading source PDFs", async () => {
  const requests = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") requests.push(r.url());
  });
  await page
    .locator("input[type=file]:not([webkitdirectory])")
    .setInputFiles(path.resolve("output/pdf/examples/invoice-01.pdf"));
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await page.getByRole("button", { name: "Rechercher et profils" }).click();
  await page
    .getByLabel("Texte à masquer", { exact: true })
    .fill("SECRET ACCOUNT");
  await page.getByRole("button", { name: "Lancer la recherche" }).click();
  await expect(page.locator(".search-results li")).toHaveCount(1);
  await page.getByRole("button", { name: /Ajouter 1 résultat/ }).click();
  await page.getByLabel("Page relue", { exact: true }).check();
  await page.locator(".project-panel summary").click();
  await page
    .getByLabel("Nom du projet", { exact: true })
    .fill("Native restart");
  await page
    .getByRole("button", { name: "Enregistrer le projet", exact: true })
    .click();
  await expect(page.locator(".project-message")).toContainText(
    "Projet enregistré",
  );
  expect(requests).toEqual([]);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
  app = null;
  await launch();
  await page.locator(".project-panel summary").click();
  await page
    .getByLabel("Projets enregistrés")
    .selectOption({ label: "Native restart · 1 PDF" });
  await page
    .getByRole("button", { name: "Ouvrir le projet", exact: true })
    .click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  await expect(page.getByLabel("Page relue", { exact: true })).toBeChecked();
  await page.locator(".project-panel summary").click();
  await page.screenshot({ path: "output/test-report/workspace-desktop.png" });
});
