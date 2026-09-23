import { createWorker } from "tesseract.js";
import { textIndex, ocrIndex, rotateRect } from "./geometry.mjs";
import {
  textChunks,
  ruleEntities,
  filterEntities,
  spanRegions,
  regionKey,
} from "./core.mjs";
const labels = {
  person: "person",
  address: "address",
  organization: "organization",
};
export async function analyzeDocument(
  pdf,
  plan,
  ai,
  {
    signal,
    onProgress = () => {},
    ocr = true,
    currentPage = null,
    onOcrWorker = () => {},
  } = {},
) {
  const suggestions = [],
    warnings = [],
    coverage = [],
    seen = new Set();
  let worker;
  const pages = currentPage
    ? [currentPage]
    : Array.from({ length: pdf.numPages }, (_, i) => i + 1);
  const check = () => signal?.throwIfAborted();
  const abortable = (promise) =>
    new Promise((resolve, reject) => {
      const abort = () =>
        reject(new DOMException("Analyse annulée", "AbortError"));
      if (signal?.aborted) return abort();
      signal?.addEventListener("abort", abort, { once: true });
      promise
        .then(resolve, reject)
        .finally(() => signal?.removeEventListener("abort", abort));
    });
  const scan = async (index, page, source) => {
    check();
    if (index.text.length > 80000)
      throw new Error(
        `Page ${page} trop volumineuse. Analysez une page à la fois ou caviardez-la manuellement.`,
      );
    let entities = ruleEntities(index.text, plan);
    const requested = plan.categories.filter((c) => labels[c]);
    if (requested.length)
      for (const chunk of textChunks(index.text)) {
        check();
        const result = await ai.request("detect", {
          text: chunk.text,
          labels: requested.map((c) => labels[c]),
        });
        entities.push(
          ...result.map((e) => ({
            ...e,
            start: e.start + chunk.start,
            end: e.end + chunk.start,
            category: requested.find((c) => labels[c] === e.label),
          })),
        );
      }
    for (const entity of filterEntities(entities, plan)) {
      if (entity.end > index.text.length) continue;
      const intersecting = index.items.filter(
        (i) => i.end > entity.start && i.start < entity.end,
      );
      if (
        intersecting.some((i) =>
          (plan.exclude || []).some((x) =>
            i.text.toLocaleLowerCase().includes(x.toLocaleLowerCase()),
          ),
        )
      ) {
        warnings.push(
          `Page ${page} : une zone contient aussi un texte à conserver ; vérifiez-la manuellement.`,
        );
        continue;
      }
      const regions = spanRegions(index, entity).map((r) => ({ ...r, page }));
      if (
        source === "ocr" &&
        suggestions.some(
          (s) =>
            s.page === page &&
            s.category === entity.category &&
            s.text.toLocaleLowerCase() === entity.text.toLocaleLowerCase() &&
            regions.every((r) =>
              s.regions.some(
                (x) =>
                  r.x >= x.x - 0.005 &&
                  r.y >= x.y - 0.005 &&
                  r.x + r.width <= x.x + x.width + 0.005 &&
                  r.y + r.height <= x.y + x.height + 0.005,
              ),
            ),
        )
      )
        continue;
      const key = regions.map(regionKey).join("|");
      if (!regions.length || seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        ...entity,
        id: crypto.randomUUID(),
        page,
        regions,
        source: source === "ocr" ? "ocr" : entity.source,
      });
      if (suggestions.length > 3000)
        throw new Error(
          "Plus de 3 000 suggestions. Réduisez la portée à la page courante.",
        );
    }
  };
  try {
    for (const number of pages) {
      check();
      onProgress(`Page ${number} / ${pdf.numPages} — lecture du texte`);
      const page = await pdf.getPage(number),
        viewport = page.getViewport({ scale: 1 });
      const index = textIndex(await page.getTextContent(), viewport);
      if (index.unsupported)
        warnings.push(
          `Page ${number} : certains textes verticaux nécessitent une vérification visuelle.`,
        );
      if (index.text.trim()) await scan(index, number, "text");
      let ocrText = "";
      if (ocr) {
        check();
        onProgress(
          `Page ${number} / ${pdf.numPages} — reconnaissance des images`,
        );
        if (!worker) {
          const creation = createWorker(["fra", "eng"], 1, {
            workerPath: location.origin + "/ai-runtime/ocr-worker.js",
            corePath: location.origin + "/ai-runtime/",
            langPath: location.origin + "/ai-models/ocr",
            gzip: false,
            cacheMethod: "none",
            workerBlobURL: false,
          });
          creation.then(
            (w) => {
              if (signal?.aborted) w.terminate();
            },
            () => {},
          );
          worker = await abortable(creation);
          onOcrWorker(worker);
        }
        check();
        const scale = Math.min(
          2,
          3200 / Math.max(viewport.width, viewport.height),
        );
        const renderViewport = page.getViewport({ scale, rotation: 0 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        const task = page.render({
          canvasContext: canvas.getContext("2d"),
          viewport: renderViewport,
        });
        const abort = () => task.cancel();
        signal?.addEventListener("abort", abort, { once: true });
        try {
          await task.promise;
        } finally {
          signal?.removeEventListener("abort", abort);
        }
        check();
        const { data } = await abortable(
          worker.recognize(canvas, {}, { blocks: true, text: true }),
        );
        const index = ocrIndex(data, canvas.width, canvas.height);
        index.items = index.items.map((item) => ({
          ...item,
          rect: item.rect ? rotateRect(item.rect, page.rotate) : null,
        }));
        canvas.width = canvas.height = 1;
        ocrText = index.text;
        await scan(index, number, "ocr");
        if (data.confidence < 60 && ocrText.trim())
          warnings.push(
            `Page ${number} : reconnaissance des caractères incertaine. Vérifiez les images.`,
          );
      }
      if (!index.text.trim() && !ocrText.trim())
        warnings.push(
          `Page ${number} : aucun texte reconnu. Vérifiez visuellement cette page.`,
        );
      if (!ocr)
        warnings.push(
          `Page ${number} : images et écritures manuscrites non analysées (OCR désactivé).`,
        );
      coverage.push(number);
    }
    check();
    return { suggestions, warnings: [...new Set(warnings)], coverage };
  } finally {
    await worker?.terminate();
    onOcrWorker(null);
  }
}
