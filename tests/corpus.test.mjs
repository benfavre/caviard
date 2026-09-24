import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  decodePDFRawStream,
} from "pdf-lib";
import { exportRedacted } from "../src/pdf.mjs";
import {
  manifest,
  corpusDir,
  outputDir,
  loadPdf,
  render,
  fixtureMarks,
  canvasFactory,
} from "./helpers.mjs";
await mkdir(outputDir, { recursive: true });
const selected = process.env.PDF_QUICK
  ? manifest.filter((f) => f.variant === 1 || f.expect !== "valid")
  : manifest;

for (const fixture of selected)
  test(`${fixture.family}: ${fixture.file}`, { timeout: 180000 }, async () => {
    const filename = path.join(corpusDir, fixture.file);
    if (fixture.expect !== "valid") {
      await assert.rejects(loadPdf(filename), (error) =>
        fixture.expect === "password"
          ? error.name === "PasswordException"
          : ["InvalidPDFException", "UnknownErrorException"].includes(
              error.name,
            ),
      );
      if (fixture.expect === "password") {
        const loaded = await loadPdf(filename, { password: fixture.password });
        assert.equal(loaded.pdf.numPages, fixture.pages);
        await loaded.task.destroy();
      }
      return;
    }
    const source = await loadPdf(filename);
    let result;
    try {
      assert.equal(source.pdf.numPages, fixture.pages);
      const marks = await fixtureMarks(source.pdf, fixture),
        progress = [];
      const bytes = await exportRedacted(source.pdf, marks, {
        createCanvas: canvasFactory,
        onProgress: (n, total) => progress.push([n, total]),
      });
      await writeFile(path.join(outputDir, fixture.file), bytes);
      result = await loadPdf(bytes);
      assert.equal(result.pdf.numPages, source.pdf.numPages);
      assert.deepEqual(
        progress,
        Array.from({ length: fixture.pages }, (_, i) => [i + 1, fixture.pages]),
      );
      assert.equal(await result.pdf.getAttachments(), null);
      assert.equal(await result.pdf.getJSActions(), null);
      const metadata = await result.pdf.getMetadata();
      assert.ok(!JSON.stringify(metadata.info).includes("SECRET"));
      // Separate parser: inspect the saved document, not just the renderer's text extraction.
      const saved = await PDFDocument.load(bytes, { updateMetadata: false });
      assert.equal(saved.context.trailerInfo.Info, undefined, "No document Info metadata");
      assert.equal(saved.context.trailerInfo.ID, undefined, "No document identifier");
      assert.equal(metadata.metadata, null, "No XMP metadata");
      for (const key of [
        "AcroForm",
        "Names",
        "OpenAction",
        "AA",
        "OCProperties",
        "Metadata",
        "Outlines",
      ])
        assert.ok(
          !saved.catalog.has(PDFName.of(key)),
          `Original ${key} must not be retained`,
        );
      for (let n = 1; n <= fixture.pages; n++) {
        const originalPage = await source.pdf.getPage(n),
          outputPage = await result.pdf.getPage(n);
        const a = originalPage.getViewport({ scale: 1 }),
          b = outputPage.getViewport({ scale: 1 });
        assert.ok(
          Math.abs(a.width - b.width) < 0.001 &&
            Math.abs(a.height - b.height) < 0.001,
          "Visible dimensions preserved",
        );
        assert.equal((await outputPage.getTextContent()).items.length, 0);
        assert.deepEqual(await outputPage.getAnnotations(), []);
        const node = saved.getPage(n - 1).node;
        assert.ok(!node.has(PDFName.of("Metadata")), "No page metadata");
        const resources = node.Resources();
        const fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
        assert.ok(
          !fonts || fonts.keys().length === 0,
          "No font resources remain",
        );
        const xobjects = resources.lookup(PDFName.of("XObject"), PDFDict);
        assert.equal(
          xobjects.keys().length,
          1,
          "Exactly one flattened image per page",
        );
        const image = saved.context.lookup(xobjects.values()[0]);
        assert.equal(
          image.dict.get(PDFName.of("Subtype")).toString(),
          "/Image",
        );
        assert.ok(!image.dict.has(PDFName.of("Metadata")), "No image metadata");
        assert.ok(
          !image.dict.has(PDFName.of("SMask")),
          "No hidden transparent image layer",
        );
        const contents = node.Contents();
        const streams =
          contents instanceof PDFArray ? contents.asArray() : [contents];
        const commands = streams
          .map((ref) =>
            Buffer.from(
              decodePDFRawStream(saved.context.lookup(ref)).decode(),
            ).toString(),
          )
          .join("\n");
        assert.ok(
          !/\b(BT|ET|Tj|TJ|BI|BDC)\b/.test(commands),
          "No original text or marked content operators",
        );
        // Render through PDF.js and compare against a separately painted source reference.
        // Every page is checked; large pages are compared at a bounded preview scale.
        const scale = Math.min(1, 1000 / Math.max(a.width, a.height));
        const expected = await render(originalPage, scale),
          actual = await render(outputPage, scale);
        const context = expected.getContext("2d");
        context.fillStyle = "#000";
        const pageMarks = marks.filter((mark) => mark.page === n);
        const boundaries = new Uint8Array(expected.width * expected.height);
        for (const mark of pageMarks) {
          const left = mark.x * expected.width,
            top = mark.y * expected.height,
            right = (mark.x + mark.width) * expected.width,
            bottom = (mark.y + mark.height) * expected.height;
          context.fillRect(left, top, right - left, bottom - top);
          // Rasterization at two resolutions can move an edge by a pixel. Exclude
          // only that narrow boundary from visual comparison; check interiors below.
          for (
            let y = Math.max(0, Math.floor(top) - 2);
            y < Math.min(expected.height, Math.ceil(bottom) + 2);
            y++
          )
            for (
              let x = Math.max(0, Math.floor(left) - 2);
              x < Math.min(expected.width, Math.ceil(right) + 2);
              x++
            )
              if (
                Math.min(
                  Math.abs(x - left),
                  Math.abs(x - right),
                  Math.abs(y - top),
                  Math.abs(y - bottom),
                ) <= 2
              )
                boundaries[y * expected.width + x] = 1;
        }
        const expectedPixels = context.getImageData(
          0,
          0,
          expected.width,
          expected.height,
        ).data;
        const actualContext = actual.getContext("2d"),
          actualPixels = actualContext.getImageData(
            0,
            0,
            actual.width,
            actual.height,
          ).data;
        assert.equal(actualPixels.length, expectedPixels.length);
        let different = 0,
          sampled = 0;
        for (let i = 0; i < actualPixels.length; i += 4 * 13) {
          if (boundaries[i / 4]) continue;
          sampled++;
          if (
            Math.max(
              ...[0, 1, 2].map((c) =>
                Math.abs(actualPixels[i + c] - expectedPixels[i + c]),
              ),
            ) > 45
          )
            different++;
        }
        assert.ok(
          different / sampled < 0.025,
          `Visual difference ${((different / sampled) * 100).toFixed(2)}% exceeds tolerance`,
        );
        for (const mark of pageMarks) {
          const x = Math.floor((mark.x + mark.width / 2) * actual.width),
            y = Math.floor((mark.y + mark.height / 2) * actual.height);
          const pixel = [...actualContext.getImageData(x, y, 1, 1).data];
          assert.ok(
            pixel.slice(0, 3).every((v) => v < 3) && pixel[3] === 255,
            `Redaction center must be opaque black: ${pixel}`,
          );
        }
        expected.width = actual.width = 1;
        originalPage.cleanup();
        outputPage.cleanup();
      }
    } finally {
      await source.task.destroy();
      await result?.task.destroy();
    }
  });
