import test from "node:test";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { analyzeDocument } from "../src/ai/analyze.mjs";

const plan = { categories: ["email"], literals: [], exclude: [] };
const recognized = {
  confidence: 95,
  text: "elodie@example.fr",
  blocks: [{ paragraphs: [{ lines: [{ words: [{
    text: "elodie@example.fr",
    bbox: { x0: 10, y0: 20, x1: 150, y1: 40 },
  }] }] }] }],
};

function fixture(t, { render, recognize, getTextContent } = {}) {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "https://local.invalid" },
  });
  t.after(() => {
    if (previousLocation)
      Object.defineProperty(globalThis, "location", previousLocation);
    else delete globalThis.location;
  });
  const canvases = [],
    notifications = [];
  let cleaned = 0,
    terminated = 0,
    created = 0;
  const page = {
    rotate: 0,
    getViewport: ({ scale }) => ({ width: 200 * scale, height: 100 * scale }),
    getTextContent: getTextContent || (async () => ({ items: [], styles: {} })),
    render: render || (() => ({ promise: Promise.resolve() })),
    cleanup: () => cleaned++,
  };
  const worker = {
    recognize: recognize || (async () => ({ data: recognized })),
    terminate: async () => {
      terminated++;
    },
  };
  const pdf = { numPages: 1, getPage: async () => page };
  const options = {
    createOcrWorker: async () => {
      created++;
      return worker;
    },
    createCanvas: () => {
      const canvas = {
        getContext: () => ({
          translate() {},
          rotate() {},
          drawImage() {},
        }),
      };
      canvases.push(canvas);
      return canvas;
    },
    onOcrWorker: (value) => notifications.push(value),
  };
  return {
    pdf,
    options,
    canvases,
    assertReleased(pages = 1, workers = 1) {
      assert.equal(cleaned, pages);
      assert.equal(created, workers);
      assert.equal(terminated, workers);
      assert.equal(notifications.at(-1), null);
      for (const canvas of canvases) {
        assert.equal(canvas.width, 1);
        assert.equal(canvas.height, 1);
      }
    },
  };
}

test("OCR reuses one worker across pages and releases each canvas and page", async (t) => {
  const f = fixture(t);
  f.pdf.numPages = 3;
  const result = await analyzeDocument(f.pdf, plan, null, f.options);
  assert.deepEqual(result.coverage, [1, 2, 3]);
  assert.deepEqual(
    result.suggestions.map((s) => s.text),
    Array(3).fill(recognized.text),
  );
  assert.equal(f.canvases.length, 3);
  f.assertReleased(3);
});

for (const stage of ["render", "recognition", "orientation"]) {
  test(`OCR ${stage} failure releases all resources`, async (t) => {
    let calls = 0;
    const failure = new Error(`${stage} failed`);
    const f = fixture(t, {
      render: stage === "render"
        ? () => ({ promise: Promise.reject(failure) })
        : undefined,
      recognize: async () => {
        if (stage === "orientation" && calls++ === 0)
          return { data: { confidence: 0, text: "", blocks: [] } };
        throw failure;
      },
    });
    await assert.rejects(analyzeDocument(f.pdf, plan, null, f.options), failure);
    assert.equal(f.canvases.length, stage === "orientation" ? 2 : 1);
    f.assertReleased();
  });
}

for (const stage of ["recognition", "orientation"]) {
  test(`canceling pending OCR ${stage} releases resources and abort listeners`, async (t) => {
    const controller = new AbortController();
    let calls = 0;
    const f = fixture(t, {
      recognize: () => {
        if (stage === "orientation" && calls++ === 0)
          return Promise.resolve({ data: { confidence: 0, text: "", blocks: [] } });
        queueMicrotask(() => controller.abort());
        return new Promise(() => {});
      },
    });
    await assert.rejects(
      analyzeDocument(f.pdf, plan, null, { ...f.options, signal: controller.signal }),
      { name: "AbortError" },
    );
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.canvases.length, stage === "orientation" ? 2 : 1);
    f.assertReleased();
  });
}

test("canceling model detection does not wait for an unresponsive model", async (t) => {
  const controller = new AbortController();
  const f = fixture(t, {
    getTextContent: async () => ({
      styles: {},
      items: [{
        str: "Elodie Martin", fontName: "test", width: 80,
        transform: [12, 0, 0, 12, 10, 20],
      }],
    }),
  });
  // Text geometry needs the PDF viewport transform.
  const page = await f.pdf.getPage(1);
  page.getViewport = () => ({
    width: 200, height: 100, transform: [1, 0, 0, -1, 0, 100],
  });
  const ai = {
    request() {
      queueMicrotask(() => controller.abort());
      return new Promise(() => {});
    },
  };
  await assert.rejects(
    analyzeDocument(
      f.pdf, { ...plan, categories: ["person"] }, ai,
      { ...f.options, ocr: false, signal: controller.signal },
    ),
    { name: "AbortError" },
  );
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  f.assertReleased(1, 0);
});

test("text extraction failure still releases the PDF page", async (t) => {
  const f = fixture(t, {
    getTextContent: async () => { throw new Error("bad text"); },
  });
  await assert.rejects(analyzeDocument(f.pdf, plan, null, f.options), /bad text/);
  f.assertReleased(1, 0);
});
