<p align="center">
  <img src="public/inklura-icon.svg" width="64" height="64" alt="Inklura" />
</p>

<h1 align="center">Inklura PDF</h1>

<p align="center">Private PDF redaction, with an optional local AI assistant.<br />Windows · macOS · Linux · 20 trial PDFs per Inklura account</p>

<p align="center">
  <a href="https://pdf.inklura.fr/"><strong>Download Inklura PDF</strong></a> ·
  <a href="GUIDE.fr.md">Guide en français</a> ·
  <a href="https://github.com/benfavre/caviard/releases">Release notes</a> ·
  <a href="https://pdf.inklura.fr/#exemples">Example PDFs</a>
</p>

<p align="center">
  <strong>Sponsored by</strong><br />
  <a href="https://www.webdesign29.net/">Webdesign29</a> ·
  <a href="https://www.inklura.fr/">Inklura</a> ·
  <a href="https://www.activ-communication.com/">ACTIV communication</a>
</p>

Inklura PDF helps you remove sensitive information before sharing a document. Draw redaction rectangles yourself, review suggestions from a local model, or describe the information you want to mask. Your PDFs and instructions stay on your device.

## Account and pricing

Version 1.4.0 requires an Inklura account and an Internet connection for exports. Each account receives 20 trial PDFs once. An export consumes one credit only after the file is saved; import, analysis and canceled saves do not consume credits.

Purchases are available in metropolitan France: packs of 100/500/1,000 PDFs valid for 12 months, or subscriptions of 20/100/500 PDFs per month and account. Prices include 20% French VAT; [see all prices](https://pdf.inklura.fr/tarifs). Monthly credits do not roll over. Documents and local AI processing stay on the computer. Previous evaluation installers are retired from distribution.

## Download and start

| Your computer | Download | Installation |
| --- | --- | --- |
| Windows, Intel/AMD 64-bit | [Windows installer](https://pdf.inklura.fr/#windows) | Open the `.exe` and follow the installer. |
| Mac with an Apple chip | [Apple Silicon DMG](https://pdf.inklura.fr/#mac-apple) | Open the `.dmg` and drag Inklura PDF into Applications. |
| Mac with an Intel processor | [Intel DMG](https://pdf.inklura.fr/#mac-intel) | Open the `.dmg` and drag Inklura PDF into Applications. |
| Linux, Intel/AMD 64-bit | [Linux AppImage](https://pdf.inklura.fr/#linux) | Allow execution in the file properties, then open it. FUSE support is needed. |

The download page includes file sizes, SHA-256 checksums and installation details. Current builds are unsigned; Windows or macOS may show a publisher warning or block opening. Windows and Linux support integrated updates. macOS updates are currently downloaded manually.

1. **Import** one or more PDFs.
2. **Redact** manually or use the assistant, then review every page. Blue suggestions must be applied to become black redaction regions.
3. **Export** a new copy. Your original remains unchanged.

You can also import a whole folder, including subfolders, or drop it into the workspace. The desktop app accepts PDFs from the OS **Open with** menu and brings new selections into the existing window. Multi-document exports use one destination folder and preserve the imported subfolders. [Desktop integration and folder limits](DESKTOP.md#open-files-and-folders-from-your-desktop).

[Read the French getting-started guide →](GUIDE.fr.md)

## Document workspaces

Version 1.4.0 adds these workflows:

- **Local projects and recovery:** save source PDFs, redactions, undo history and page review states under a project name. Recovery is opt-in for each session. Both can be restored after restarting and explicitly deleted; passwords and account credentials are excluded.
- **Folder navigation:** browse the imported hierarchy, search filenames and see whether a document is untouched, modified, reviewed or exported.
- **Find and redact:** search exact text across all documents, preview and select results, then apply them with per-document undo. Optional OCR covers scans when models are installed.
- **Reusable profiles:** save categories, exact phrases and exceptions on this device. Built-in policies can be used as starting points. Text search and rule-based categories do not require the language models.
- **Export review:** mark pages as reviewed, revisit unchecked pages, select documents and see the number of credits before saving. Changing a page’s redactions invalidates its review status.
- **Protected PDFs:** retry a password or skip a locked file while continuing the import. Reopening a protected project asks for its password again.

Projects contain the **original, unredacted PDF bytes**. They remain in this application’s local storage until deleted; clearing browser/app data also removes them. Deleting a project removes source copies only when no other project or recovery uses them. These are local working copies, not portable backups. Recovery is debounced by 1.2 seconds and cannot recover changes made after the last successful save.

## Three ways to use local AI

| Mode | What it does | Your control |
| --- | --- | --- |
| Suggestions | Looks for people, addresses, organisations, emails, phones, IBANs and card numbers. | Review each result before adding it to the preview. |
| Automatic policy | Prepares redactions for selected categories across a document or batch. | Inspect the preview; undo an application in one step. |
| Natural-language instruction | Turns a request such as “mask names and contact details” into an editable plan. | Adjust the categories before analysis. |

French/English OCR also supports scanned and mixed PDFs, including rotated pages. The optional model pack downloads once (**about 1.18 GB**) and then runs offline on the CPU. No Python or separate model server is needed; 8 GB RAM is recommended. Manual redaction works without models.

The assistant can miss information or select an entire text line. Review every page before exporting. [Model details, privacy and limitations](AI.md).

<details>
<summary>See the local assistant with a synthetic document</summary>

![Inklura PDF showing a full-window document workspace and reviewable suggestions from a fictitious PDF](hosting/pdf/site/public/inklura-pdf/assistant-v1.2.0.png)

</details>

## What happens to your PDF

- **Local processing:** no document uploads, cloud inference or telemetry. Model downloads and application update checks use the network. The account-enabled edition also uses the network for login, credits and billing, without sending document content.
- **A new exported file:** pages are rebuilt from redacted images; source text, annotations, forms, attachments and layers are not copied. Exports contain no document metadata: no Info dictionary, XMP, PDF document ID, author, title, creator/producer or embedded timestamps. Filesystem timestamps and filenames are outside the PDF.
- **An intact original:** undo/redo, page navigation, region counts, zoom and unsaved-document protection help you review your work.
- **An image-based result:** exported text cannot be selected or searched. Output uses up to 144 DPI, with a canvas size limit for unusually large pages. Password-protected PDFs open with a password prompt; passwords are never stored in projects.

The interface is in French, with built-in help and keyboard shortcuts. Multiple documents produce separate exports.

## Try 171 synthetic PDFs

[Download the example packs](https://pdf.inklura.fr/#exemples) to explore the app without using private documents:

- **159 core examples:** 151 valid PDFs (399 pages), 3 password-protected files and 5 intentionally invalid files. Covers text, scans, hidden OCR, fonts, forms, annotations, attachments, metadata, crop boxes, rotations, transparency and stress cases.
- **12 AI/OCR examples:** fictitious contact and banking data in digital, scanned and mixed pages at four rotations.

The test suite exercises real PDF exports, extracted text and pixels, browser interactions, native desktop saving, updates and local-model workflows. [Test setup, coverage and limitations](TESTING.md).

## Develop

Built with React, Vite and Electron. Requires Node.js 22.13+ (or a newer supported version).

```sh
npm ci
npm run dev          # Web development at http://localhost:5173
npm run desktop      # Build and launch Electron
npm test             # PDF export, geometry and other unit tests
npm run build        # Production web build
npm run desktop:dist # Installer for the current operating system
```

For the full PDF corpus and independent audit:

```sh
python3 -m pip install --target .test-deps -r tests/requirements.txt
npx playwright install --with-deps chromium
npm run test:all
npm run examples:gallery
```

Poppler and DejaVu Sans are also required for the independent audit and previews. Test reports are written under `output/test-report/`; the example gallery is available at `http://localhost:5173/output/pdf/index.html` after generation.

| Documentation | Contents |
| --- | --- |
| [Guide en français](GUIDE.fr.md) | Installation, first redaction, assistant and troubleshooting |
| [Local AI](AI.md) | Models, OCR, privacy, detection limits and real-model checks |
| [Desktop](DESKTOP.md) | Packaging, signing, updates and release procedure |
| [Testing](TESTING.md) | Corpus, browser tests and independent PDF audits |
| [Website deployment](hosting/pdf/README.md) | Hosting installers and verifying public downloads |

Found a problem? [Report an issue](https://github.com/benfavre/caviard/issues/new/choose) with your OS, app version and reproduction steps. Use a synthetic example instead of attaching a confidential document.

## Sponsors

**Sponsored by [Webdesign29](https://www.webdesign29.net/), [Inklura](https://www.inklura.fr/) and [ACTIV communication](https://www.activ-communication.com/).**

| Sponsor | Website |
| --- | --- |
| Webdesign29 | [Web and application development](https://www.webdesign29.net/) |
| Inklura | [Business applications and tools](https://www.inklura.fr/) |
| ACTIV communication | [Web, print and digital communication](https://www.activ-communication.com/) |

The Inklura icon and visual identity come from [Inklura](https://www.inklura.fr/). Internal application identifiers and the GitHub release repository remain stable so existing Caviard installations can receive updates.

## Account and billing integration

Version 1.3.0 connects to the deployed Inklura account and credit service. Purchases use ACTIV communication’s live Stripe account and are restricted to metropolitan France, with 20% VAT. In-app prices show both HT and TTC. The desktop workspace fills the window, keeps export controls visible and opens the local assistant in a separate scrolling side panel. [Offers and competitor comparison (French)](COMMERCIAL.md) · [Service setup](server/README.md).
