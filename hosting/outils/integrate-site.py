#!/usr/bin/env python3
"""Add the download page to the existing tools catalog and scope its metadata."""
from pathlib import Path
import re
import sys

site = Path(sys.argv[1])
layout = site / 'src/app/layout.tsx'
tools = site / 'src/lib/tools.ts'
source = layout.read_text()
if '// Inklura PDF download metadata' not in source:
    edits = [
      ('  const onIndex = path === "/";', '''  const onIndex = path === "/";
  // Inklura PDF download metadata: keep the existing shell for every other tool.
  const isPdfDownload = path.replace(/\\/$/, "") === "/inklura-pdf";
  const pdfTitle = "Inklura PDF — caviardage et IA locale | Télécharger gratuitement";
  const pdfDescription = "Caviardez vos PDF sur votre ordinateur avec Inklura PDF. Assistant IA et OCR locaux, sans compte. Téléchargement gratuit pour Windows, macOS et Linux.";'''),
      ('{props.title ?? "Outils gratuits pour professionnels — Inklura"}', '{isPdfDownload ? pdfTitle : props.title ?? "Outils gratuits pour professionnels — Inklura"}'),
      ('content="Convertisseurs, calculateurs financiers, générateurs PDF, outils marketing et bien plus. Tous gratuits, sans inscription, par Inklura."', 'content={isPdfDownload ? pdfDescription : "Convertisseurs, calculateurs financiers, générateurs PDF, outils marketing et bien plus. Tous gratuits, sans inscription, par Inklura."}'),
      ('content="Outils gratuits Inklura"', 'content={isPdfDownload ? pdfTitle : "Outils gratuits Inklura"}'),
      ('content="Plus de 40 outils professionnels gratuits : PDF, finance, marketing, email, conversion."', 'content={isPdfDownload ? pdfDescription : "Plus de 40 outils professionnels gratuits : PDF, finance, marketing, email, conversion."}'),
      ('<meta property="og:url" content="https://outils.inklura.fr/" />', '''<meta property="og:url" content={isPdfDownload ? "https://outils.inklura.fr/inklura-pdf" : "https://outils.inklura.fr/"} />
        {isPdfDownload ? <link rel="canonical" href="https://outils.inklura.fr/inklura-pdf" /> : null}'''),
    ]
    for before, after in edits:
        if source.count(before) != 1:
            raise SystemExit('Site layout changed; review before integrating: ' + before)
        source = source.replace(before, after)
registry = tools.read_text()
if 'id: "inklura-pdf"' not in registry:
    marker = 'export const TOOLS: Tool[] = ['
    if registry.count(marker) != 1:
        raise SystemExit('Tools registry changed; review before integrating')
    registry = registry.replace(marker, marker + '''
  { id: "inklura-pdf", title: "Inklura PDF · Caviardage", description: "Application gratuite à télécharger : caviardez vos PDF avec un assistant IA et un OCR locaux, sur Windows, macOS et Linux", icon: "shield", category: "PDF", difficulty: "Facile", tags: ["caviarder", "caviardage", "masquer", "anonymiser", "confidentialité", "IA", "OCR", "télécharger", "Windows", "macOS", "Linux"], ported: true },''')
# Upgrade metadata/catalog from the earlier unlimited-free presentation.
source, title_count = re.subn(r'  const pdfTitle = "[^"\n]*";', '  const pdfTitle = "Inklura PDF — caviardage et IA locale | Essai gratuit";', source)
source, desc_count = re.subn(r'  const pdfDescription = "[^"\n]*";', '  const pdfDescription = "Essayez Inklura PDF sur Windows, macOS et Linux. Caviardage, assistant IA et OCR locaux. Offres Volume et Entreprise Inklura en préparation.";', source)
if title_count != 1 or desc_count != 1:
    raise SystemExit('Download metadata changed; review integration')
footer = '© Inklura · outils.inklura.fr — Hébergé en France 🇫🇷 · 100% gratuit · Sans inscription'
if footer in source and '{isPdfDownload ? "© Inklura' not in source:
    source = source.replace(footer, '{isPdfDownload ? "© Inklura · outils.inklura.fr — Essai gratuit · Offres professionnelles en préparation" : "' + footer + '"}')
registry = registry.replace('Application gratuite à télécharger : caviardez vos PDF avec un assistant IA et un OCR locaux, sur Windows, macOS et Linux', 'Essai gratuit : caviardez vos PDF avec un assistant IA et un OCR locaux. Offres professionnelles Inklura en préparation')
home = site / 'src/app/page.tsx'
home_source = home.read_text()
home_source = home_source.replace('<span className="pdot"></span>Gratuit</span>', '<span className="pdot"></span>{t.id === "inklura-pdf" ? "Essai gratuit" : "Gratuit"}</span>')
home_source = home_source.replace('{available.length} outils gratuits · sans inscription', '{available.filter((t) => t.id !== "inklura-pdf").length} outils gratuits · sans inscription')
# Prepare all replacements before writing either file; avoid partial integration on drift.
for path, content in ((layout, source), (tools, registry), (home, home_source)):
    if path.read_text() != content:
        tmp = path.with_suffix(path.suffix + '.tmp')
        tmp.write_text(content)
        tmp.replace(path)
ignore = site / '.gitignore'
ignored = ignore.read_text() if ignore.exists() else ''
pattern = '/public/downloads/inklura-pdf/'
if pattern not in ignored.splitlines():
    ignore.write_text(ignored.rstrip() + '\n\n# Published installers are mirrored, never committed.\n' + pattern + '\n')
print('Catalog and page metadata integrated')
