import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { normalizeRect, exportRedacted } from "../src/pdf.mjs";
import { loadPdf, render, canvasFactory, corpusDir } from "./helpers.mjs";
import path from "node:path";

test("1,000 deterministic drags stay bounded, symmetric, and cover both endpoints", () => {
  let seed = 12345;
  const random = () =>
    ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) * 3 - 1;
  const clamp = (n) => Math.min(1, Math.max(0, n));
  for (let i = 0; i < 1000; i++) {
    const a = { x: random(), y: random() },
      b = { x: random(), y: random() },
      rect = normalizeRect(a, b);
    assert.deepEqual(rect, normalizeRect(b, a));
    assert.ok(
      rect.x >= 0 &&
        rect.y >= 0 &&
        rect.width >= 0 &&
        rect.height >= 0 &&
        rect.x + rect.width <= 1 + 1e-12 &&
        rect.y + rect.height <= 1 + 1e-12,
    );
    for (const p of [a, b])
      assert.ok(
        clamp(p.x) >= rect.x - 1e-12 &&
          clamp(p.x) <= rect.x + rect.width + 1e-12 &&
          clamp(p.y) >= rect.y - 1e-12 &&
          clamp(p.y) <= rect.y + rect.height + 1e-12,
      );
  }
});
for (const [label, rects] of [
  ["entire page", [{ x: 0, y: 0, width: 1, height: 1 }]],
  [
    "all four edges",
    [
      { x: 0, y: 0, width: 1, height: 0.03 },
      { x: 0, y: 0.97, width: 1, height: 0.03 },
      { x: 0, y: 0, width: 0.03, height: 1 },
      { x: 0.97, y: 0, width: 0.03, height: 1 },
    ],
  ],
  [
    "overlapping boxes",
    [
      { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
      { x: 0.3, y: 0.3, width: 0.5, height: 0.5 },
    ],
  ],
  [
    "fractional coordinates",
    [{ x: 0.123456, y: 0.345678, width: 0.234567, height: 0.034567 }],
  ],
  ["sub-pixel region", [{ x: 0.5, y: 0.5, width: 0.001, height: 0.001 }]],
  [
    "adjacent boxes",
    [
      { x: 0.1, y: 0.1, width: 0.4, height: 0.3 },
      { x: 0.5, y: 0.1, width: 0.4, height: 0.3 },
    ],
  ],
])
  test(`opaque redaction at export resolution: ${label}`, async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const input = await loadPdf(await doc.save());
    let output;
    try {
      output = await loadPdf(
        await exportRedacted(
          input.pdf,
          rects.map((r) => ({ ...r, page: 1 })),
          { createCanvas: canvasFactory },
        ),
      );
      const canvas = await render(await output.pdf.getPage(1), 2),
        ctx = canvas.getContext("2d");
      for (const r of rects)
        for (
          let y = Math.floor(r.y * 200);
          y < Math.ceil((r.y + r.height) * 200);
          y++
        )
          for (
            let x = Math.floor(r.x * 200);
            x < Math.ceil((r.x + r.width) * 200);
            x++
          )
            assert.deepEqual(
              [...ctx.getImageData(x, y, 1, 1).data],
              [0, 0, 0, 255],
            );
    } finally {
      await input.task.destroy();
      await output?.task.destroy();
    }
  });
const invalidMarks = [
  ["NaN", { x: NaN }],
  ["infinity", { width: Infinity }],
  ["negative coordinate", { x: -0.1 }],
  ["negative width", { width: -0.1 }],
  ["past page edge", { x: 0.95, width: 0.2 }],
  ["zero width", { width: 0 }],
  ["zero height", { height: 0 }],
  ["missing page", { page: undefined }],
  ["page zero", { page: 0 }],
  ["past final page", { page: 2 }],
  ["fractional page", { page: 1.5 }],
  ["string coordinate", { x: "0.1" }],
];
for (const [label, change] of invalidMarks)
  test(`reject unsafe rectangle: ${label}`, async () => {
    const doc = {
      numPages: 1,
      getPage() {
        throw new Error("Must validate before rendering");
      },
    };
    await assert.rejects(
      exportRedacted(
        doc,
        [{ page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2, ...change }],
        { createCanvas: canvasFactory },
      ),
      { name: "RangeError" },
    );
  });

test("failed render releases the canvas and page resources", async () => {
  const canvas = canvasFactory();
  let cleaned = false;
  const doc = {
    numPages: 1,
    getPage: async () => ({
      getViewport: ({ scale }) => ({ width: 100 * scale, height: 100 * scale }),
      render: () => ({
        promise: Promise.reject(new Error("test render failure")),
      }),
      cleanup: () => {
        cleaned = true;
      },
    }),
  };
  await assert.rejects(
    exportRedacted(doc, [], { createCanvas: () => canvas }),
    /test render failure/,
  );
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.equal(cleaned, true);
});

for (const stage of ["null blob", "encoding exception", "blob read failure"]) {
  test(`failed PNG export releases resources: ${stage}`, async () => {
    const canvas = canvasFactory();
    let cleaned = false;
    canvas.toBlob = (callback) => {
      if (stage === "encoding exception") throw new Error("encoding failed");
      callback(stage === "null blob" ? null : {
        arrayBuffer: async () => { throw new Error("blob read failed"); },
      });
    };
    const pdf = {
      numPages: 1,
      getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 100 * scale, height: 100 * scale }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: () => { cleaned = true; },
      }),
    };
    const progress = [];
    await assert.rejects(exportRedacted(pdf, [], {
      createCanvas: () => canvas,
      onProgress: (...args) => progress.push(args),
    }));
    assert.equal(canvas.width, 1);
    assert.equal(canvas.height, 1);
    assert.equal(cleaned, true);
    assert.deepEqual(progress, []);
  });
}

test("successful export does not mutate the original document or selection list", async () => {
  const input = await loadPdf(path.join(corpusDir, "invoice-01.pdf"));
  let output;
  try {
    const before = (
      await (await input.pdf.getPage(1)).getTextContent()
    ).items.map((x) => x.str);
    const marks = Object.freeze([
      Object.freeze({ page: 1, x: 0.1, y: 0.1, width: 0.6, height: 0.3 }),
    ]);
    output = await loadPdf(
      await exportRedacted(input.pdf, marks, { createCanvas: canvasFactory }),
    );
    assert.deepEqual(
      (await (await input.pdf.getPage(1)).getTextContent()).items.map(
        (x) => x.str,
      ),
      before,
    );
    assert.equal(
      (await (await output.pdf.getPage(1)).getTextContent()).items.length,
      0,
    );
  } finally {
    await input.task.destroy();
    await output?.task.destroy();
  }
});
