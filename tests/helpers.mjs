import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import path from "node:path";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
export const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
export const corpusDir = path.resolve("output/pdf/examples");
export const outputDir = path.resolve("output/pdf/redacted");
export const manifest = JSON.parse(
  await readFile(path.join(corpusDir, "manifest.json"), "utf8"),
);
export const canvasFactory = () => createCanvas(1, 1);
export async function loadPdf(fileOrBytes, options = {}) {
  const bytes =
    typeof fileOrBytes === "string" ? await readFile(fileOrBytes) : fileOrBytes;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    verbosity: 0,
    standardFontDataUrl:
      path.resolve("node_modules/pdfjs-dist/standard_fonts") + "/",
    cMapUrl: path.resolve("node_modules/pdfjs-dist/cmaps") + "/",
    wasmUrl: path.resolve("node_modules/pdfjs-dist/wasm") + "/",
    ...options,
  });
  try {
    return { task, pdf: await task.promise };
  } catch (error) {
    await task.destroy();
    throw error;
  }
}
export async function render(page, scale = 1) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
    background: "rgb(255,255,255)",
  }).promise;
  return canvas;
}
export async function fixtureMarks(pdf, fixture) {
  const marks = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n),
      v = page.getViewport({ scale: 1 });
    const [a, b, c, d, e, f] = v.transform;
    const [left, bottom, right, top] = fixture.boxes[n - 1];
    const [x1, y1, x2, y2] = [
      a * left + c * bottom + e,
      b * left + d * bottom + f,
      a * right + c * top + e,
      b * right + d * top + f,
    ];
    marks.push({
      page: n,
      x: Math.min(x1, x2) / v.width,
      y: Math.min(y1, y2) / v.height,
      width: Math.abs(x2 - x1) / v.width,
      height: Math.abs(y2 - y1) / v.height,
    });
  }
  for (let i = 0; i < (fixture.extraZones || 0); i++)
    marks.push({
      page: 1,
      x: (i % 20) / 21,
      y: Math.floor(i / 20) / 26,
      width: 0.025,
      height: 0.02,
    });
  return marks;
}
