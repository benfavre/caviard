Inklura PDF is an offline PDF redaction app. Documents stay on your device; exports flatten pages to images and discard source text and hidden PDF content.

- New Inklura identity with the official icon, blue palette, and Inter typography.
- Removed PDFux donation prompts, external tool listings, and unrelated social links.
- Added undo/redo for all region edits, page navigation and per-page counts, fit-to-width, useful help, and unsaved-document protection.
- Added an optional local assistant: reviewed sensitive-data suggestions, automatic policy previews, and editable plans from natural-language instructions.
- Local French/English OCR supports scanned and mixed PDFs. One-time model download: about 1.18 GB; documents and instructions stay on-device. Detection can miss information, so review every page before exporting.
- Existing Caviard installations use the same update feed.

- Windows: download and run the `.exe` installer (x64).
- macOS: choose the `arm64.dmg` for Apple Silicon or `x64.dmg` for Intel.
- Linux: download the `.AppImage`, make it executable, and run it (x64).

Windows and Linux check GitHub Releases for updates, download them in the background, and offer an explicit restart after you export unsaved redactions.

These initial builds are unsigned. macOS automatic updates remain disabled until a Developer ID signing certificate is configured; download new Mac versions here. Operating systems may display an unverified-publisher warning.

The source includes a reproducible corpus of 159 synthetic example PDFs plus 12 additional AI/OCR examples and tests covering redaction, export, desktop saving, and update handling. See `TESTING.md` and `DESKTOP.md`.
