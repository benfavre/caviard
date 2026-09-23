import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
let bytes;
test.beforeAll(async () => {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    p = doc.addPage();
  p.drawText("Cliente : Elodie Martin", { x: 40, y: 700, size: 16, font });
  p.drawText("elodie@example.fr", { x: 40, y: 650, size: 16, font });
  bytes = Buffer.from(await doc.save());
});
async function setup(page, phase = "ready") {
  await page.addInitScript(
    ({ phase }) => {
      window.caviardDesktop = {
        info: async () => ({ version: "test" }),
        updateState: async () => ({ phase: "disabled", message: "Test" }),
        onUpdate: () => () => {},
        setDocumentState: () => {},
        models: async () => ({ phase, total: 1180213607, received: 0 }),
        onModels: () => () => {},
      };
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          if (!String(url).includes("/assets/worker-"))
            return new NativeWorker(url, options);
          // Deterministic UI contract double. Real models are verified separately.
          return {
            terminate() {
              clearTimeout(this.timer);
            },
            postMessage(data) {
              this.timer = setTimeout(() => {
                let result;
                if (data.type === "plan")
                  result = {
                    categories: ["person", "email"],
                    literals: [],
                    exclude: [],
                  };
                else {
                  const start = data.payload.text.indexOf("Elodie Martin");
                  result =
                    start < 0
                      ? []
                      : [
                          {
                            start,
                            end: start + 13,
                            text: "Elodie Martin",
                            label: "person",
                            source: "model",
                            score: 0.95,
                          },
                        ];
                }
                this.onmessage?.({ data: { id: data.id, result } });
              }, 120);
            },
          };
        }
      };
    },
    { phase },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-ai.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await page.getByRole("button", { name: /Assistant local/ }).click();
  await page.getByLabel("Analyser aussi les images").uncheck();
}
test("suggestions require selection, preview uses blue outlines, batch addition is undoable", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Rechercher les informations", exact: true })
    .click();
  await expect(page.locator(".suggestion")).toHaveCount(2);
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(0);
  await page.locator(".suggestion button").first().click();
  await expect(page.locator(".ai-region")).toHaveCount(1);
  await page.getByLabel("Tout sélectionner", { exact: true }).uncheck();
  await expect(
    page.getByRole("button", { name: "Ajouter la sélection à l’aperçu" }),
  ).toBeDisabled();
  await page.getByLabel("Tout sélectionner", { exact: true }).check();
  await page
    .getByRole("button", { name: "Ajouter la sélection à l’aperçu" })
    .click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(2);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(0);
});
test("automatic policy adds preview and preserves the ability to undo", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("tab", { name: "Politique automatique" }).click();
  await page
    .getByRole("button", { name: "Appliquer la politique et prévisualiser" })
    .click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(2);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(0);
});
test("instruction plan is reviewed and editable before it can scan", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("tab", { name: "Instruction libre" }).click();
  await expect(
    page.getByRole("button", {
      name: "Rechercher les informations",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByLabel("Que souhaitez-vous masquer ?")
    .fill("Masque les noms et les e-mails.");
  await page.getByRole("button", { name: "Préparer le plan" }).click();
  await expect(page.locator(".instruction-plan")).toBeVisible();
  await page
    .locator(".instruction-plan")
    .getByLabel("Noms de personnes")
    .uncheck();
  await page
    .getByRole("button", { name: "Rechercher les informations", exact: true })
    .click();
  await expect(page.locator(".suggestion")).toHaveCount(1);
  await expect(page.locator(".suggestion")).toContainText("elodie@example.fr");
});
test("optional models are clearly separate from manual PDF editing", async ({
  page,
}) => {
  await setup(page, "missing");
  await expect(
    page.getByRole("button", { name: "Installer les modèles" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Rechercher les informations",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".model-install")).toContainText("jamais envoyés");
});
