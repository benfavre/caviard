# Caviarder un PDF

A React and Vite reproduction of the French [pdfux redaction page](https://pdfux.com/fr/caviarder-pdf/), with local PDF redaction.

Desktop installers for Windows, macOS, and Linux are published at [Caviard Releases](https://github.com/benfavre/caviard/releases). Run `npm run desktop` for development or `npm run desktop:dist` to package. See [DESKTOP.md](DESKTOP.md) for automatic updates, signing, and release instructions.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173. Requires Node.js 22.13+ (or a newer supported version).

```sh
npm test       # Real PDF export and rectangle boundary tests
npm run build # Production output in dist/
npm run preview
```

## Features

- Responsive French interface matching the reference page.
- Select or drag in one or more PDFs, switch documents and navigate pages.
- Draw black redaction rectangles, remove individual rectangles, undo (Ctrl/Cmd+Z), clear selections, and zoom.
- Export creates entirely new PDFs from the redacted page images. Original text, annotations, attachments, layers, and source metadata are not copied.
- PDFs are processed in the browser; there is no upload endpoint or backend. Fonts, scripts, and the PDF worker are served locally.
- Output is rasterized at up to 144 DPI, with a canvas size limit for unusually large pages. Exported text cannot be selected or searched. Password-protected PDFs must be unlocked before importing.

The other PDF tools, additional languages, and footer links lead to the original external websites; this project implements the redaction page only. Multiple documents produce separate downloads; browsers may request permission for multiple downloads.

## Examples and tests

The project includes a reproducible **159-PDF synthetic corpus**: 151 valid PDFs (399 pages), 3 password-protected files, and 5 deliberately invalid files. It covers text, scans, hidden OCR, embedded fonts, forms, annotations, attachments, metadata, crop boxes, rotations, transparency, and stress cases.

```sh
python3 -m pip install --target .test-deps -r tests/requirements.txt
npx playwright install --with-deps chromium
npm run test:all
npm run examples:gallery
```

Poppler and DejaVu Sans are also needed for the independent audit and preview generation. See [TESTING.md](TESTING.md) for setup, commands, detailed coverage, and limitations.

- Example ZIP: `output/pdf/example-pdfs.zip`
- Browsable gallery: http://localhost:5173/output/pdf/index.html
- Browser report: `output/test-report/browser/index.html`
- Independent audit: `output/test-report/independent-audit.json`

The browser tests run in an isolated Chromium instance and exercise actual uploads, drawing, touch, and downloads. They do not depend on the ChatGPT extension's file-picker permission.

Reference branding and logo belong to pdfux. This is a reproduction, not an affiliated service.
