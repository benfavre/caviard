import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { exportRedacted, normalizeRect } from "../src/pdf.mjs";
import { writeFile, mkdir } from "node:fs/promises";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

test("redaction flattens all pages, destroys original text and metadata, and paints black pixels", async () => {
  const original = await PDFDocument.create();
  original.setTitle("SECRET ORIGINAL METADATA");
  const font = await original.embedFont(StandardFonts.Helvetica);
  const first = original.addPage([400, 500]);
  first.drawText("PRIVATE ACCOUNT 123456", { x: 40, y: 380, size: 18, font });
  first.drawText("Public information", { x: 40, y: 300, size: 18, font });
  first.drawRectangle({
    x: 40,
    y: 200,
    width: 100,
    height: 50,
    color: rgb(1, 0, 0),
  });
  const second = original.addPage([300, 400]);
  second.setRotation(degrees(90));
  second.drawText("SECOND PAGE", { x: 30, y: 320, size: 15, font });
  const bytes = await original.save();
  await mkdir("tests/fixtures", { recursive: true });
  await writeFile("tests/fixtures/sample.pdf", bytes);
  const inputTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const input = await inputTask.promise;
  const sourceText = await (await input.getPage(1)).getTextContent();
  assert.ok(sourceText.items.some((item) => item.str.includes("PRIVATE")));
  const progress = [];
  const result = await exportRedacted(
    input,
    [{ page: 1, x: 0.08, y: 0.19, width: 0.8, height: 0.09 }],
    {
      createCanvas: () => createCanvas(1, 1),
      onProgress: (...args) => progress.push(args),
    },
  );
  await writeFile("tests/fixtures/redacted.pdf", result);
  const outputTask = pdfjs.getDocument({ data: result, useSystemFonts: true });
  const output = await outputTask.promise;
  assert.equal(output.numPages, 2);
  for (let n = 1; n <= 2; n++) {
    const page = await output.getPage(n);
    assert.equal(
      (await page.getTextContent()).items.length,
      0,
      "No original text objects should remain",
    );
    assert.deepEqual(await page.getAnnotations(), []);
  }
  const metadata = await output.getMetadata();
  assert.notEqual(metadata.info.Title, "SECRET ORIGINAL METADATA");
  assert.deepEqual(progress, [
    [1, 2],
    [2, 2],
  ]);
  assert.deepEqual(
    (await output.getPage(2)).view,
    [0, 0, 400, 300],
    "Rotated page dimensions are preserved",
  );
  const page = await output.getPage(1),
    viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(viewport.width, viewport.height),
    context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  assert.deepEqual(
    [...context.getImageData(45, 110, 1, 1).data],
    [0, 0, 0, 255],
    "Selected area is black",
  );
  assert.deepEqual(
    [...context.getImageData(50, 260, 1, 1).data],
    [255, 0, 0, 255],
    "Unselected image content is preserved",
  );
  await inputTask.destroy();
  await outputTask.destroy();
});

test("reverse and out-of-page drags produce bounded rectangles", () => {
  assert.deepEqual(normalizeRect({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 }), {
    x: 0.2,
    y: 0.1,
    width: 0.8 - 0.2,
    height: 0.7 - 0.1,
  });
  assert.deepEqual(normalizeRect({ x: -0.2, y: -1 }, { x: 2, y: 3 }), {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
});
