import { PDFDocument } from "pdf-lib";

export function normalizeRect(start, end) {
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const x1 = clamp(start.x),
    y1 = clamp(start.y),
    x2 = clamp(end.x),
    y2 = clamp(end.y);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function validateMarks(marks, pageCount) {
  if (!Array.isArray(marks))
    throw new RangeError("Redactions must be an array.");
  for (const mark of marks) {
    if (
      !mark ||
      !Number.isInteger(mark.page) ||
      mark.page < 1 ||
      mark.page > pageCount ||
      ![mark.x, mark.y, mark.width, mark.height].every(Number.isFinite) ||
      mark.x < 0 ||
      mark.y < 0 ||
      mark.width <= 0 ||
      mark.height <= 0 ||
      mark.x + mark.width > 1 + 1e-12 ||
      mark.y + mark.height > 1 + 1e-12
    ) {
      // Refuse invalid selections rather than silently producing an unredacted PDF.
      throw new RangeError(
        "A redaction must be a nonempty rectangle within an existing page.",
      );
    }
  }
}

// Build a new document exclusively from flattened, already-redacted pixels.
// No original text, image objects, links, layers, attachments or metadata are copied.
export async function exportRedacted(
  pdf,
  marks,
  {
    createCanvas = () => document.createElement("canvas"),
    onProgress = () => {},
  } = {},
) {
  validateMarks(marks, pdf.numPages);
  // Suppress pdf-lib's default Creator/Producer and creation/modification dates.
  // A fresh document with metadata updates disabled has no Info dictionary,
  // XMP stream or trailer ID. Source objects are never copied into this document.
  const output = await PDFDocument.create({ updateMetadata: false });
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    let canvas;
    try {
      const size = page.getViewport({ scale: 1 });
      if (
        ![size.width, size.height].every(
          (value) => Number.isFinite(value) && value > 0,
        )
      )
        throw new RangeError("Invalid PDF page dimensions.");
      const scale = Math.min(
        2,
        8192 / Math.max(size.width, size.height),
        Math.sqrt(23983000 / (size.width * size.height)),
      );
      const viewport = page.getViewport({ scale });
      canvas = createCanvas();
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      await page.render({
        canvasContext: context,
        viewport,
        background: "rgb(255,255,255)",
      }).promise;
      context.fillStyle = "#000000";
      for (const mark of marks.filter((mark) => mark.page === pageNumber)) {
        const left = Math.floor(mark.x * canvas.width),
          top = Math.floor(mark.y * canvas.height);
        context.fillRect(
          left,
          top,
          Math.ceil((mark.x + mark.width) * canvas.width) - left,
          Math.ceil((mark.y + mark.height) * canvas.height) - top,
        );
      }
      const image = await output.embedPng(canvas.toDataURL("image/png"));
      output
        .addPage([size.width, size.height])
        .drawImage(image, {
          x: 0,
          y: 0,
          width: size.width,
          height: size.height,
        });
    } finally {
      if (canvas) canvas.width = canvas.height = 1;
      page.cleanup();
    }
    onProgress(pageNumber, pdf.numPages);
  }
  return output.save();
}
