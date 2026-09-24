import { confirmExport } from "../ui-helpers.mjs";
import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, mkdir, copyFile, writeFile, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fixtureAccount } from "./helpers.mjs";
import { loadPdf } from "../helpers.mjs";

let app, page, root, folder, errors;
test.beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "inklura-import-e2e-"));
  folder = path.join(root, "Documents été");
  for (const client of ["Client A", "Client B"]) {
    await mkdir(path.join(folder, client), { recursive: true });
    await copyFile("output/pdf/examples/invoice-01.pdf", path.join(folder, client, "facture.pdf"));
  }
  await writeFile(path.join(folder, "notes.txt"), "Not a PDF");
  errors = [];
});
test.afterEach(async () => {
  if (app) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()));
    await app.close();
    app = null;
  }
  await rm(root, { recursive: true, force: true });
  expect(errors).toEqual([]);
});
async function start(paths = []) {
  app = await electron.launch(process.env.CAVIARD_EXECUTABLE
    ? { executablePath: process.env.CAVIARD_EXECUTABLE, args: paths }
    : { args: [path.resolve("."), ...paths] });
  page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page).toHaveTitle("Inklura PDF — Caviardage");
}
async function expectFolder() {
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await expect(page.getByLabel("Document actif").locator("option")).toHaveText([
    "Documents été/Client A/facture.pdf", "Documents été/Client B/facture.pdf",
  ]);
}
async function draw() {
  const layer = page.locator(".drawing-layer");
  await layer.scrollIntoViewIfNeeded();
  const box = await layer.boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await page.mouse.up();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
}

test("startup folder arguments are delivered after the renderer is ready", async () => {
  await start([folder]);
  await expectFolder();
  await expect(page.getByRole("status")).toContainText("ignoré");
  expect(await page.evaluate(async () => {
    try { await window.caviardDesktop.readDocument("/etc/passwd"); return false; }
    catch { return true; }
  })).toBe(true);
});

test("folder picker imports nested PDFs and repeated imports preserve edits", async () => {
  await start();
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, folder);
  await page.getByRole("button", { name: "Importer un dossier", exact: true }).click();
  await expectFolder();
  await draw();
  await page.getByRole("button", { name: "Importer un dossier", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("déjà ouvert");
  await expectFolder();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
});

test("macOS open-file and second-instance events add documents without replacing the workspace", async () => {
  await start([path.join(folder, "Client A", "facture.pdf")]);
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await draw();
  await app.evaluate(({ app }, file) => {
    app.emit("open-file", { preventDefault() {} }, file);
  }, path.join(folder, "Client B", "facture.pdf"));
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(2);
  const third = path.join(root, "third.pdf");
  await copyFile("output/pdf/examples/invoice-01.pdf", third);
  const args = process.env.CAVIARD_EXECUTABLE ? [third] : [path.resolve("."), third];
  // Playwright's process is a cmd.exe wrapper on Windows; launch Electron itself.
  const executable = await app.evaluate(() => process.execPath);
  const second = spawn(executable, args, { stdio: "ignore" });
  const [code] = await once(second, "exit");
  expect(code).toBe(0);
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(3);
  await page.getByLabel("Document actif").selectOption("0");
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
});

test("batch export asks for one folder and saves distinct, flattened copies in their subfolders", async () => {
  await start([folder]);
  await expectFolder();
  await fixtureAccount(app);
  await draw();
  const output = path.join(root, "output");
  await mkdir(output);
  const original = await readFile(path.join(folder, "Client A", "facture.pdf"));
  await app.evaluate(({ dialog }, output) => {
    globalThis.folderPrompts = 0;
    dialog.showOpenDialog = async () => {
      globalThis.folderPrompts++;
      return { canceled: false, filePaths: [output] };
    };
    dialog.showSaveDialog = async () => { throw new Error("A batch must not prompt per file"); };
  }, output);
  await page.getByRole("button", { name: "Exporter les PDF", exact: true }).click();
  await confirmExport(page);
  await expect(page.getByRole("status")).toContainText("2 PDF enregistrés");
  expect(await app.evaluate(() => globalThis.folderPrompts)).toBe(1);
  const [exportFolder] = await readdir(output);
  expect(exportFolder).toMatch(/^Inklura-caviardages-/);
  for (const client of ["Client A", "Client B"]) {
    const loaded = await loadPdf(path.join(output, exportFolder, "Documents été", client, "facture-caviarde.pdf"));
    try { expect((await (await loaded.pdf.getPage(1)).getTextContent()).items).toHaveLength(0); }
    finally { await loaded.task.destroy(); }
  }
  expect(await readFile(path.join(folder, "Client A", "facture.pdf"))).toEqual(original);
});

test("OS imports wait until an in-progress export finishes", async () => {
  await start([path.join(folder, "Client A", "facture.pdf")]);
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await draw();
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = () => new Promise((resolve) => { globalThis.finishSaveDialog = resolve; });
  });
  await page.getByRole("button", { name: "Exporter le PDF", exact: true }).click();
  await confirmExport(page);
  await expect.poll(() => app.evaluate(() => typeof globalThis.finishSaveDialog)).toBe("function");
  await app.evaluate(({ app }, file) => app.emit("open-file", { preventDefault() {} }, file),
    path.join(folder, "Client B", "facture.pdf"));
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(1);
  await app.evaluate(() => globalThis.finishSaveDialog({ canceled: true }));
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(2);
  await page.getByLabel("Document actif").selectOption("0");
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
});

test("canceling batch destination does not reserve credits or discard edits", async () => {
  await start([folder]);
  await expectFolder();
  await draw();
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await page.getByRole("button", { name: "Exporter les PDF", exact: true }).click();
  await confirmExport(page);
  await expect(page.getByRole("status")).toContainText("Enregistrement annulé");
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("partial batch failure preserves earlier saves and leaves remaining edits unsaved", async () => {
  await start([folder]);
  await expectFolder();
  await fixtureAccount(app);
  await draw();
  await page.getByLabel("Document actif").selectOption("1");
  await draw();
  const output = path.join(root, "partial");
  await mkdir(output);
  await app.evaluate(({ app, dialog }, output) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [output] });
    const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/package.json");
    const { AccountController } = require(app.getAppPath() + "/electron/account.mjs");
    const request = AccountController.prototype.request;
    let reservations = 0;
    AccountController.prototype.request = async function (route) {
      if (route === "/v1/exports/reserve" && ++reservations === 2)
        throw new Error("Quota de test épuisé.");
      return request.call(this, route);
    };
  }, output);
  await page.getByRole("button", { name: "Exporter les PDF", exact: true }).click();
  await confirmExport(page);
  await expect(page.getByRole("alert")).toContainText("1 PDF déjà enregistré");
  await page.getByLabel("Document actif").selectOption("0");
  await page.getByRole("button", { name: "Fermer ce document", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(1);
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  const [exportFolder] = await readdir(output);
  expect(await readdir(path.join(output, exportFolder, "Documents été", "Client A")))
    .toEqual(["facture-caviarde.pdf"]);
});
