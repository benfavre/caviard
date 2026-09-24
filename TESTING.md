# PDF fixtures and test coverage

This is a synthetic regression suite, not a certification that every possible PDF is supported. The fixtures contain no real personal data. Password-protected PDFs are intentionally rejected by the app; the fixture passwords are in the manifest.

## Install and run

Requires Node.js 22.13+, Python 3.10+, Poppler (`pdftoppm`, `pdftotext`), and DejaVu Sans. On Ubuntu:

```sh
sudo apt-get install poppler-utils fonts-dejavu-core
npm ci
python3 -m pip install --target .test-deps -r tests/requirements.txt
npx playwright install --with-deps chromium
npm run test:all
npm run examples:gallery
```

The Python dependencies are installed inside this project. Set `PYTHON` if your Python executable is not named `python3`.

| Command                    | Purpose                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run examples`         | Regenerate 159 synthetic PDFs, manifest, and download ZIP              |
| `npm test`                 | Run all Node export, corpus, and edge-case tests                       |
| `npm run test:unit`        | Run the smaller core and boundary suite                                |
| `npm run test:corpus`      | Export and inspect every fixture                                       |
| `npm run test:e2e`         | Build and exercise the production app in isolated Chromium             |
| `npm run test:audit`       | Independently inspect all saved exports using pypdf and Poppler        |
| `npm run test:all`         | Run Node tests, browser tests, independent audit, and production build |
| `npm run examples:gallery` | Render source previews and create the browsable catalog                |

Tests generate the fixtures automatically if missing or older than the generator. Run the corpus tests before the independent audit or gallery: those tools inspect the saved redacted outputs. Generated PDFs, reports, previews, and browser traces are ignored by git. The source generators and test code are kept in the project. A GitHub Actions workflow runs the full suite and keeps test reports as build artifacts.

## Example collection

- **144 documents in 24 families:** invoices, contracts, fictional medical records, bank statements, resumes, tables, scanned pages, scans with hidden OCR text, images, transparency, vector graphics, tiny text, embedded multilingual fonts, three rotation angles, mixed rotations, crop boxes, offset media boxes, interactive forms, annotations and links, attachments, metadata and inert JavaScript, and landscape pages. Each family has six combinations of page size, page count, and compression.
- **7 stress cases:** a 100-page document, 500 additional redaction rectangles, a 5000-point square page, a 20-point page, a long page, a blank page, and mixed page sizes.
- **3 encrypted PDFs:** known test passwords, used to check rejection and recovery.
- **5 invalid PDFs:** empty, plain text, header-only, truncated, and broken cross-reference/page tree.

The 151 valid PDFs contain **399 pages**. `output/pdf/examples/manifest.json` gives exact redaction boxes in PDF coordinates, expected outcomes, and source hashes. The tests transform these coordinates for crop boxes and rotation before using the application's export function.

Open `http://localhost:5173/output/pdf/index.html` while the dev server is running, or open `output/pdf/index.html` locally. It includes searchable previews, original files, tested redacted results, and a ZIP of all source examples.

## What the checks establish

The corpus tests call the application's actual `exportRedacted` function for every valid document and inspect every output page. They check page count, displayed dimensions, opaque redaction pixels, visual preservation outside selected areas, ordered progress, and removal of selectable text and annotations. Pixel comparisons allow small renderer differences and exclude a two-pixel band at rectangle edges. Separate boundary tests check every pixel in full-page, edge, overlapping, adjacent, fractional, and sub-pixel redactions at the export resolution.

The saved PDFs are also parsed with pdf-lib and, independently, with Python pypdf. The independent audit checks that every page has exactly one opaque image, uses only image-drawing operators, respects canvas limits, and contains no source fonts, forms, attachments, optional-content layers, names, actions, outlines, or metadata streams. It also requires the absence of the Info dictionary and trailer ID, including library-generated creator/producer and timestamps. A dedicated regression fixture contains source Info, XMP, page metadata and a document ID; exports with and without redaction selections must discard them all. Poppler's `pdftotext` must return no text for every export. Fixture checks confirm that the originals actually contain the forms, attachments, annotations, or hidden OCR content being tested.

The browser suite builds the production app and exercises real file selection, drag-and-drop, drawing, touch, zoom, page navigation, multiple documents and downloads, undo, clearing and deleting rectangles, offline use after initialization, Unicode filenames, invalid-file recovery, export failure recovery, and document loading races. It downloads and reopens PDFs and exports a representative of every document family and stress case. Unhandled browser errors fail the tests. A network check verifies no document-upload request or external request occurs during the basic workflow.

One thousand seeded randomized drag cases check clamping, reverse-drag symmetry, and coordinate bounds. Invalid rectangle inputs must fail before rendering, and simulated render failures must release canvas and page resources.

## Scope and limits

The suite uses synthetic PDFs generated with ReportLab and pypdf. It does not yet include a licensed, independently sourced corpus from every PDF producer; a complete malformed-PDF fuzzer; every CJK font or image codec; digital-signature preservation; or browser-engine coverage beyond Chromium. The app deliberately rasterizes output, removes document interactivity, and rejects password-protected imports. The offline test covers a loaded app, not reopening the website offline.

Production PDFs that fail or render unexpectedly should become sanitized regression fixtures with a documented expected result. Do not add real confidential documents to this repository or CI artifacts.
