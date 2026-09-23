# Inklura local assistant

The desktop app offers three ways to prepare the same reversible redaction rectangles:

- **Suggestions**: choose categories, scan the current PDF or page, inspect each suggestion, select results and add them to the preview.
- **Automatic policy**: personal contact details, banking information, or all supported categories; add the resulting rectangles in one undoable operation. Export remains separate.
- **Natural-language instruction**: a local model proposes categories. Check and edit the plan before scanning. Exact strings and exceptions must be quoted, e.g. `Masque les noms sauf « Inklura »`. The supported operation is category/quoted-text redaction, not an unrestricted conversational agent.

## Privacy and installation

The first-use model pack is **1,180,213,607 bytes (about 1.18 GB)**. Models are optional and do not inflate the installer. The installer contains the inference and OCR code. Model downloads use pinned Hugging Face/GitHub revisions and SHA-256 hashes in `electron/ai-manifest.json`. Completed, verified files are reused when retrying an interrupted installation; an incomplete file is restarted. Models live in Electron's user-data directory under `ai-models/v1` and survive application updates.

Only model downloads and the existing application update checks require the network. The sandboxed renderer and its workers allow only same-origin resources. Documents, extracted text, and instructions are never uploaded. There is no telemetry, cloud inference, Python dependency, localhost server, or general-purpose tool execution. The instruction model receives the user's instruction only; PDF contents never enter its prompt. Closing the document releases its suggestions; no document text is logged or stored by the assistant.

Models execute on CPU using WebAssembly in a disposable worker. Cancelling terminates that worker. NER and instruction models are not held active together. The UI recommends 8 GB RAM; speed and peak memory depend on the document and machine. This is an optional assistant: manual redaction works without installing models.

## Detection and limits

GLiNER multilingual v2.1 identifies people, postal addresses/places, and organisations. Deterministic recognisers supplement it for email, phone, IBAN (mod-97), and payment-card numbers (Luhn). Qwen3-0.6B classifies natural-language redaction requests into the seven supported categories; named broad policies have explicit stable category sets. Its proposed plan is editable and always reviewed before analysis. It cannot distinguish a client's details from a supplier's details simply from their business role.

Local Tesseract recognises French and English images. OCR is enabled by default for every page, including mixed text/image PDFs. Low-confidence or empty OCR results are flagged. Handwriting, unusual layouts, other languages, vertical text, and other sensitive-data categories require manual inspection. Zero suggestions never means a document is free of sensitive data.

PDF text positions are mapped through the page viewport, including page rotation and crop offsets. OCR renders the underlying page upright and maps its word boxes back into the displayed rotation. To avoid guessing glyph widths, a matching PDF text item is covered in full; this may redact a complete line. OCR uses word boxes. The UI explains this and previews each suggestion in blue. Only black applied regions are exported. Exact-text exclusions that overlap a broader PDF text item cause that suggestion to be withheld with a warning. Users must inspect every page before export.

A policy application is a single undo step; manual regions survive it. The original PDF is unchanged. The existing raster export removes searchable text, forms, annotations, attachments and source metadata.

## Development and verification

```
npm run examples:ai
npm run test:ai
npm run test:all
npm run test:desktop:unit
```

`npm run examples:ai` generates twelve additional synthetic PDFs: digital text, scans, and mixed pages at 0°, 90°, 180°, 270°. All names, email addresses and bank details are fictitious/test values. No downloaded private documents are used.

For real inference, install the model pack through the app, or run `npm run models:install -- /absolute/model/cache`. The same downloader verifies every file. To exercise development Electron against that cache:

```
INKLURA_AI_MODELS=/absolute/model/cache npm run desktop
INKLURA_AI_MODELS=/absolute/model/cache npm run test:ai:real
```

The cache override is ignored in packaged applications. Standard CI does not download model weights; it runs deterministic rule/geometry/history/download tests and UI workflow tests. The real-model suite separately exercises the actual packaged browser worker, OCR, natural-language planning, cancellation and policy previews, with all HTTP(S) requests blocked after models have been installed.
