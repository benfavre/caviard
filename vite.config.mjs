import { defineConfig } from "vite";
import { cp, mkdir } from "node:fs/promises";
// All executable AI assets ship with the app; no CDN code at inference time.
async function copyRuntime(target) {
  await mkdir(target, { recursive: true });
  for (const name of [
    "ort-wasm-simd-threaded.asyncify.mjs",
    "ort-wasm-simd-threaded.asyncify.wasm",
    "ort-wasm-simd-threaded.jspi.mjs",
    "ort-wasm-simd-threaded.jspi.wasm",
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.jsep.mjs",
    "ort-wasm-simd-threaded.jsep.wasm",
  ])
    await cp(`node_modules/onnxruntime-web/dist/${name}`, `${target}/${name}`);
  await cp(
    "node_modules/tesseract.js/dist/worker.min.js",
    `${target}/ocr-worker.js`,
  );
  for (const suffix of ["relaxedsimd-lstm", "simd-lstm", "lstm"])
    for (const ext of ["wasm", "wasm.js"])
      await cp(
        `node_modules/tesseract.js-core/tesseract-core-${suffix}.${ext}`,
        `${target}/tesseract-core-${suffix}.${ext}`,
      );
}
export default defineConfig({
  worker: { format: "es" },
  plugins: [
    {
      name: "local-ai-runtime",
      async closeBundle() {
        await copyRuntime("dist/ai-runtime");
      },
    },
  ],
});
