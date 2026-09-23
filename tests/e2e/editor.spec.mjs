import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { loadPdf, render, manifest } from "../helpers.mjs";
const fixture = (name) => path.resolve("output/pdf/examples", name);
const markSelector = ".redaction:not(.draft)";
async function upload(page, names = ["invoice-01.pdf"]) {
  await page.locator("input[type=file]").setInputFiles(names.map(fixture));
  await expect(page.locator(".drawing-layer")).toBeVisible();
}
async function draw(page, start = [0.15, 0.15], end = [0.8, 0.3]) {
  const layer = page.locator(".drawing-layer");
  await layer.scrollIntoViewIfNeeded();
  const box = await layer.boundingBox();
  await page.mouse.move(
    box.x + box.width * start[0],
    box.y + box.height * start[1],
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * end[0],
    box.y + box.height * end[1],
    { steps: 12 },
  );
  await page.mouse.up();
}
async function save(page, testInfo) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Appliquer et télécharger/ }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  return file;
}
const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
});

test("complete file picker → draw → download; exported pixels and text are checked", async ({
  page,
}, info) => {
  const requests = [];
  page.on("request", (r) =>
    requests.push({ method: r.method(), url: r.url() }),
  );
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choisir des fichiers", exact: true })
    .click();
  await (await chooser).setFiles(fixture("invoice-01.pdf"));
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Appliquer et télécharger/ }),
  ).toBeDisabled();
  await draw(page);
  await expect(page.locator(markSelector)).toHaveCount(1);
  const file = await save(page, info);
  expect(path.basename(file)).toBe("invoice-01-caviarde.pdf");
  const result = await loadPdf(file);
  try {
    const pdfPage = await result.pdf.getPage(1);
    expect((await pdfPage.getTextContent()).items).toHaveLength(0);
    const canvas = await render(pdfPage);
    expect([
      ...canvas.getContext("2d").getImageData(100, 130, 1, 1).data,
    ]).toEqual([0, 0, 0, 255]);
  } finally {
    await result.task.destroy();
  }
  await expect(page.getByRole("status")).toContainText("téléchargé");
  expect(
    requests.filter(
      (r) =>
        r.method !== "GET" ||
        (!r.url.startsWith("http://127.0.0.1:4174/") &&
          !r.url.startsWith("blob:")),
    ),
  ).toEqual([]);
});

test("reverse drag, undo button and shortcut, remove individual region, clear all", async ({
  page,
}) => {
  await upload(page);
  await draw(page, [0.8, 0.3], [0.15, 0.15]);
  await draw(page, [0.2, 0.4], [0.7, 0.45]);
  await expect(page.locator(markSelector)).toHaveCount(2);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(markSelector)).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.locator(markSelector)).toHaveCount(0);
  await draw(page);
  await page.locator(markSelector).hover();
  await page
    .getByRole("button", { name: "Supprimer cette zone", exact: true })
    .click();
  await expect(page.locator(markSelector)).toHaveCount(0);
  await draw(page);
  await page.getByRole("button", { name: "Tout effacer", exact: true }).click();
  await expect(page.locator(markSelector)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Appliquer et télécharger/ }),
  ).toBeDisabled();
});

test("page navigation preserves separate page selections", async ({
  page,
}, info) => {
  await upload(page, ["mixed-rotation-03.pdf"]);
  await draw(page);
  await page
    .getByRole("button", { name: "Page suivante", exact: true })
    .click();
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await expect(page.locator(markSelector)).toHaveCount(0);
  await draw(page);
  await page
    .getByRole("button", { name: "Page précédente", exact: true })
    .click();
  await expect(page.locator(markSelector)).toHaveCount(1);
  const result = await loadPdf(await save(page, info));
  expect(result.pdf.numPages).toBe(3);
  await result.task.destroy();
});

test("switch and close documents without losing other selections; reimport same file", async ({
  page,
}) => {
  await upload(page, ["invoice-01.pdf", "contract-02.pdf"]);
  await draw(page);
  await page.getByLabel("Document actif").selectOption("1");
  await expect(page.locator(markSelector)).toHaveCount(0);
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await draw(page);
  await page.getByLabel("Document actif").selectOption("0");
  await expect(page.locator(markSelector)).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fermer ce document", exact: true })
    .click();
  await expect(page.getByLabel("Document actif")).toContainText(
    "contract-02.pdf",
  );
  await expect(page.locator(markSelector)).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fermer ce document", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeVisible();
  await upload(page);
});

test("zoom retains geometry and exports same redacted region", async ({
  page,
}, info) => {
  await upload(page);
  await page
    .getByRole("button", { name: "Augmenter le zoom", exact: true })
    .click();
  await draw(page);
  await page
    .getByRole("button", { name: "Réduire le zoom", exact: true })
    .click();
  await expect(page.locator(markSelector)).toHaveCount(1);
  const result = await loadPdf(await save(page, info));
  const canvas = await render(await result.pdf.getPage(1));
  expect([
    ...canvas.getContext("2d").getImageData(100, 130, 1, 1).data,
  ]).toEqual([0, 0, 0, 255]);
  await result.task.destroy();
});

for (const name of [
  "invalid-empty.pdf",
  "invalid-not-a-pdf.pdf",
  "invalid-header-only.pdf",
  "invalid-truncated.pdf",
  "invalid-broken-xref.pdf",
  "encrypted-01.pdf",
  "encrypted-02.pdf",
  "encrypted-03.pdf",
])
  test(`rejects ${name} and recovers for a valid PDF`, async ({ page }) => {
    await page.locator("input[type=file]").setInputFiles(fixture(name));
    await expect(page.getByRole("alert")).toContainText(
      name.startsWith("encrypted") ? "mot de passe" : "endommagé",
    );
    await upload(page);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

test("mixed invalid and valid file batch loads the valid documents", async ({
  page,
}) => {
  await upload(page, [
    "invalid-empty.pdf",
    "invoice-01.pdf",
    "encrypted-01.pdf",
    "contract-01.pdf",
  ]);
  await expect(page.getByRole("alert")).toContainText("invalid-empty.pdf");
  await expect(page.getByLabel("Document actif").locator("option")).toHaveCount(
    2,
  );
});

test("rejects non-PDF file type", async ({ page }) => {
  await page.locator("input[type=file]").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("example"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "choisissez un fichier PDF",
  );
});

test("drag and drop loads a real file", async ({ page }) => {
  const bytes = [...(await readFile(fixture("invoice-01.pdf")))];
  const transfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "dropped.pdf", {
        type: "application/pdf",
      }),
    );
    return dt;
  }, bytes);
  await page
    .locator(".dropzone")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await expect(page.getByLabel("Document actif")).toContainText("dropped.pdf");
});

test("works offline after initial page load", async ({
  page,
  context,
}, info) => {
  await context.setOffline(true);
  await upload(page);
  await draw(page);
  const result = await loadPdf(await save(page, info));
  expect(result.pdf.numPages).toBe(1);
  await result.task.destroy();
});

test("multi-file export emits a separate valid PDF for each document", async ({
  page,
}) => {
  await upload(page, ["invoice-01.pdf", "contract-02.pdf"]);
  await draw(page);
  const downloads = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: /Appliquer et télécharger/ }).click();
  await expect.poll(() => downloads.length).toBe(2);
  expect(downloads.map((d) => d.suggestedFilename())).toEqual([
    "invoice-01-caviarde.pdf",
    "contract-02-caviarde.pdf",
  ]);
});

test("mobile layout has no horizontal overflow and supports touch rectangles", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await upload(page);
  const layer = page.locator(".drawing-layer");
  await layer.scrollIntoViewIfNeeded();
  const b = await layer.boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width * 0.1, y: b.y + b.height * 0.15 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + b.width * 0.8, y: b.y + b.height * 0.3 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await expect(page.locator(markSelector)).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("mobile-editor.png"),
    fullPage: true,
  });
});

test("tools and language dialogs open and close by keyboard", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "TOUS LES OUTILS PDF", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Français", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choisir une langue" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

for (const example of manifest.filter(
  (record) => record.expect === "valid" && record.variant === 1,
))
  test(`browser export: ${example.family}`, async ({ page }, info) => {
    await upload(page, [example.file]);
    await draw(page);
    const result = await loadPdf(await save(page, info));
    expect(
      (await (await result.pdf.getPage(1)).getTextContent()).items,
    ).toHaveLength(0);
    await result.task.destroy();
  });

test("zero-area click is ignored; drag outside the page is clipped", async ({
  page,
}) => {
  await upload(page);
  const layer = page.locator(".drawing-layer");
  await layer.click({ position: { x: 80, y: 100 } });
  await expect(page.locator(markSelector)).toHaveCount(0);
  await draw(page, [0.2, 0.2], [1.1, 0.4]);
  await expect(page.locator(markSelector)).toHaveCount(1);
  const rect = await page.locator(markSelector).evaluate((el) => ({
    left: parseFloat(el.style.left),
    width: parseFloat(el.style.width),
  }));
  expect(rect.left + rect.width).toBeCloseTo(100, 5);
});

test("export failure is visible and can be retried without losing selections", async ({
  page,
}, info) => {
  await upload(page);
  await draw(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      HTMLCanvasElement.prototype.toDataURL = original;
      throw new Error("Intentional encoding failure");
    };
  });
  await page.getByRole("button", { name: /Appliquer et télécharger/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "n’a pas pu être exporté",
  );
  await expect(page.locator(markSelector)).toHaveCount(1);
  await save(page, info);
  await expect(page.getByRole("status")).toContainText("téléchargé");
});

test("Unicode filenames survive import and download", async ({
  page,
}, info) => {
  await page.locator("input[type=file]").setInputFiles({
    name: "Facture été_日本語.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixture("invoice-01.pdf")),
  });
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await draw(page);
  expect(path.basename(await save(page, info))).toBe(
    "Facture été_日本語-caviarde.pdf",
  );
});

test("editing after download clears the stale success message", async ({
  page,
}, info) => {
  await upload(page);
  await draw(page);
  await save(page, info);
  await expect(page.getByRole("status")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.locator(markSelector)).toHaveCount(0);
  await expect(page.getByRole("status")).toBeHidden();
});

test("closing or switching is disabled while additional files are being read", async ({
  page,
}) => {
  await upload(page);
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return original.call(this);
    };
  });
  await page
    .locator("input[type=file]")
    .setInputFiles(fixture("contract-01.pdf"));
  await expect(
    page.getByRole("button", { name: "Fermer ce document", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Document actif")).toBeDisabled();
  await expect(page.getByLabel("Document actif")).toBeEnabled();
  await expect(page.getByLabel("Document actif")).toHaveValue("1");
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await draw(page);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});
