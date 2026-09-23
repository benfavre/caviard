import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { loadPdf, render } from "../tests/helpers.mjs";
const directory = new URL("../output/pdf/ai-examples/", import.meta.url);
await mkdir(directory, { recursive: true });
const lines = [
  "EXEMPLE FICTIF — AUCUNE DONNÉE RÉELLE",
  "Cliente : Élodie Martin",
  "Adresse : 14 rue Victor Hugo, 29200 Brest",
  "Entreprise : Atelier Horizon",
  "E-mail : elodie.martin@example.fr",
  "Téléphone : 06 12 34 56 78",
  "IBAN : FR76 3000 6000 0112 3456 7890 189",
  "Carte de test : 4111 1111 1111 1111",
  "Texte public à conserver : Inklura",
];
const manifest = [];
for (const rotation of [0, 90, 180, 270]) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    page = pdf.addPage([600, 800]);
  lines.forEach((line, i) =>
    page.drawText(line, { x: 40, y: 750 - i * 45, size: 15, font }),
  );
  page.setRotation(degrees(rotation));
  const bytes = await pdf.save();
  const filename = `contact-${rotation}.pdf`;
  await writeFile(new URL(filename, directory), bytes);
  manifest.push({ filename, rotation, type: "text" });
  const source = await loadPdf(bytes);
  const image = await render(await source.pdf.getPage(1), 1.5);
  await source.task.destroy();
  for (const mixed of [false, true]) {
    const scanned = await PDFDocument.create(),
      png = await scanned.embedPng(image.toBuffer("image/png")),
      p = scanned.addPage([png.width / 1.5, png.height / 1.5]);
    p.drawImage(png, {
      x: 0,
      y: 0,
      width: p.getWidth(),
      height: p.getHeight(),
    });
    if (mixed) {
      const f = await scanned.embedFont(StandardFonts.Helvetica);
      p.drawText("COPIE AVEC IMAGE", { x: 10, y: 10, size: 8, font: f });
    }
    const filename = `${mixed ? "mixed" : "scan"}-${rotation}.pdf`;
    await writeFile(new URL(filename, directory), await scanned.save());
    manifest.push({ filename, rotation, type: mixed ? "mixed" : "scan" });
  }
}
await writeFile(
  new URL("manifest.json", directory),
  JSON.stringify(manifest, null, 2),
);
console.log(`Generated ${manifest.length} synthetic AI examples.`);
