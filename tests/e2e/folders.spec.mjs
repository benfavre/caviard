import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
let root, folder;
test.beforeEach(async ({ page }) => {
  root = await mkdtemp(path.join(os.tmpdir(), "inklura-web-folder-"));
  folder = path.join(root, "Documents");
  await mkdir(path.join(folder, "nested"), { recursive: true });
  for (const file of ["invoice.pdf", "nested/invoice.pdf"])
    await copyFile("output/pdf/examples/invoice-01.pdf", path.join(folder, file));
  await writeFile(path.join(folder, "notes.txt"), "ignored");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Importer un dossier", exact: true })).toBeEnabled();
});
test.afterEach(async () => rm(root, { recursive: true, force: true }));

test("browser directory picker imports subfolders and ignores unrelated files", async ({ page }) => {
  await page.locator("input[webkitdirectory]").setInputFiles(folder);
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await expect(page.getByLabel("Document actif").locator("option")).toHaveText([
    "Documents/invoice.pdf", "Documents/nested/invoice.pdf",
  ]);
  await expect(page.getByRole("status")).toContainText("non PDF ignoré");
  await page.locator("input[webkitdirectory]").setInputFiles(folder);
  await expect(page.getByRole("status")).toContainText("déjà ouvert");
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(2);
  const empty = path.join(root, "empty");
  await mkdir(empty);
  await page.locator("input[webkitdirectory]").setInputFiles(empty);
  await expect(page.getByRole("status")).toContainText("Aucun PDF trouvé");
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(2);
  await page.screenshot({ path: "output/test-report/folders-workspace.png", fullPage: true });
});

test("folder controls fit a narrow workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("input[webkitdirectory]").setInputFiles(folder);
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Importer un dossier", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "output/test-report/folders-mobile.png", fullPage: true });
});
