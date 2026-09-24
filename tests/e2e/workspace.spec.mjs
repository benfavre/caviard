import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { confirmExport } from "../ui-helpers.mjs";
const fixture = "output/pdf/examples/invoice-01.pdf";
async function open(page, files = [fixture]) {
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
  await page
    .locator("input[type=file]:not([webkitdirectory])")
    .setInputFiles(files);
  await expect(page.locator(".drawing-layer")).toBeVisible();
}
async function draw(page) {
  const layer = page.locator(".drawing-layer");
  await layer.scrollIntoViewIfNeeded();
  const b = await layer.boundingBox();
  await page.mouse.move(b.x + b.width * 0.1, b.y + 30);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.7, b.y + 70, { steps: 5 });
  await page.mouse.up();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Choisir des fichiers", exact: true }),
  ).toBeEnabled();
});
test("named project restores source bytes, undo and review; deleting it removes unused document copies", async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await page.getByLabel("Page relue", { exact: true }).check();
  await page.locator(".project-panel summary").click();
  await page.getByLabel("Nom du projet", { exact: true }).fill("Client A");
  await page
    .getByRole("button", { name: "Enregistrer le projet", exact: true })
    .click();
  await expect(page.locator(".project-message")).toContainText(
    "Projet enregistré",
  );
  await page.reload();
  await page.locator(".project-panel summary").click();
  await page
    .getByLabel("Projets enregistrés")
    .selectOption({ label: "Client A · 1 PDF" });
  await page
    .getByRole("button", { name: "Ouvrir le projet", exact: true })
    .click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  await expect(page.getByLabel("Page relue", { exact: true })).toBeChecked();
  await page.locator(".project-panel summary").click();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(
    page.getByLabel("Page relue", { exact: true }),
  ).not.toBeChecked();
  await page.locator(".project-panel summary").click();
  await page
    .getByRole("button", { name: "Supprimer le projet", exact: true })
    .click();
  await expect(page.locator(".project-message")).toContainText("supprimés");
  expect(
    await page.evaluate(async () => {
      const db = await new Promise((r, j) => {
        const q = indexedDB.open("inklura-projects-v1");
        q.onsuccess = () => r(q.result);
        q.onerror = j;
      });
      return new Promise((r) => {
        const q = db.transaction("documents").objectStore("documents").count();
        q.onsuccess = () => r(q.result);
      });
    }),
  ).toBe(0);
});
test("recovery is opt-in and can be restored after reload then explicitly deleted", async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await page.locator(".project-panel summary").click();
  await page
    .getByLabel("Conserver une récupération automatique pendant cette session")
    .check();
  await expect(page.locator(".project-message")).toContainText(
    "Récupération enregistrée",
  );
  await page.reload();
  await page.locator(".project-panel summary").click();
  await page.getByRole("button", { name: "Restaurer la récupération" }).click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  await page
    .getByLabel("Conserver une récupération automatique pendant cette session")
    .check();
  await expect(page.locator(".project-message")).toContainText(
    "Récupération enregistrée",
  );
  await page
    .getByLabel("Conserver une récupération automatique pendant cette session")
    .uncheck();
  await expect(page.locator(".project-message")).toContainText(
    "copie automatique supprimée",
  );
  await page.reload();
  await expect(page.locator(".project-panel summary")).not.toContainText(
    "disponible",
  );
});
test("password retry, local project reopen and cancellation leave other PDFs usable", async ({
  page,
}) => {
  await page
    .locator("input[type=file]:not([webkitdirectory])")
    .setInputFiles("output/pdf/examples/encrypted-02.pdf");
  await page.getByLabel("Mot de passe du PDF").fill("wrong");
  await page.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Mot de passe du PDF").fill("pässword");
  await page.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(page.locator(".drawing-layer")).toBeVisible();
  await draw(page);
  await page.locator(".project-panel summary").click();
  await page.getByLabel("Nom du projet", { exact: true }).fill("Protected");
  await page
    .getByRole("button", { name: "Enregistrer le projet", exact: true })
    .click();
  await expect(page.locator(".project-message")).toContainText(
    "Projet enregistré",
  );
  await page.reload();
  await open(page);
  await page.locator(".project-panel summary").click();
  await page
    .getByLabel("Projets enregistrés")
    .selectOption({ label: "Protected · 1 PDF" });
  await page
    .getByRole("button", { name: "Ouvrir le projet", exact: true })
    .click();
  await expect(page.getByLabel("Mot de passe du PDF")).toBeVisible();
  await page.getByRole("button", { name: "Ignorer ce PDF" }).click();
  await expect(page.getByLabel("Document actif")).toContainText(
    "invoice-01.pdf",
  );
  await expect(page.locator(".drawing-layer")).toBeVisible();
});
test("search across documents previews results, applies selectively and supports saved profiles without model downloads", async ({
  page,
}) => {
  const buffer = await readFile(fixture);
  await open(page, [
    { name: "One.pdf", mimeType: "application/pdf", buffer },
    { name: "Two.pdf", mimeType: "application/pdf", buffer },
  ]);
  await page.getByRole("button", { name: "Rechercher et profils" }).click();
  await page
    .getByLabel("Texte à masquer", { exact: true })
    .fill("SECRET ACCOUNT");
  await page.getByRole("button", { name: "Lancer la recherche" }).click();
  await expect(page.locator(".search-results li")).toHaveCount(2);
  await page.getByRole("button", { name: "Voir la zone" }).last().click();
  await expect(page.locator(".ai-region")).toHaveCount(1);
  await page.getByRole("button", { name: "Rechercher et profils" }).click();
  await page.locator(".search-results input").first().uncheck();
  await page.getByRole("button", { name: /Ajouter 1 résultat/ }).click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
  await page.getByRole("button", { name: "Rechercher et profils" }).click();
  await page.getByRole("button", { name: "Profils réutilisables" }).click();
  await page.getByLabel("Nom du profil", { exact: true }).fill("Accounts");
  await page
    .getByLabel("Expressions à masquer (une par ligne)")
    .fill("SECRET ACCOUNT");
  await page
    .getByRole("button", { name: "Enregistrer le profil", exact: true })
    .click();
  await expect(page.locator(".search-dialog")).toContainText(
    "Profil enregistré",
  );
  await page.reload();
  await open(page);
  await page.getByRole("button", { name: "Rechercher et profils" }).click();
  await page.getByRole("button", { name: "Profils réutilisables" }).click();
  await page
    .getByLabel("Charger un profil")
    .selectOption({ label: "Accounts" });
  await expect(
    page.getByLabel("Expressions à masquer (une par ligne)"),
  ).toHaveValue("SECRET ACCOUNT");
});
test("export review selects documents, invalidates changed pages and preserves cancel without downloads", async ({
  page,
}) => {
  const buffer = await readFile(fixture);
  await open(page, [
    { name: "One.pdf", mimeType: "application/pdf", buffer },
    { name: "Two.pdf", mimeType: "application/pdf", buffer },
  ]);
  await draw(page);
  await page.getByLabel("Page relue", { exact: true }).check();
  await draw(page);
  await expect(
    page.getByLabel("Page relue", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Exporter les PDF", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmer l’export" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Revenir au document" }).click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Exporter les PDF", exact: true })
    .click();
  await page.locator(".export-review li input").last().uncheck();
  const pending = page.waitForEvent("download");
  await confirmExport(page);
  expect((await pending).suggestedFilename()).toBe("One-caviarde.pdf");
  await expect(page.locator(".document-tree")).toContainText("Exporté");
});
test("an interrupted project overwrite preserves the last complete snapshot", async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await page.locator(".project-panel summary").click();
  await page.getByLabel("Nom du projet", { exact: true }).fill("Atomic save");
  await page
    .getByRole("button", { name: "Enregistrer le projet", exact: true })
    .click();
  await expect(page.locator(".project-message")).toContainText(
    "Projet enregistré",
  );
  await page.locator(".project-panel summary").click();
  await draw(page);
  await page.locator(".project-panel summary").click();
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
      const tx = original.call(this, stores, mode, ...rest);
      if (mode === "readwrite") {
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => tx.abort());
      }
      return tx;
    };
  });
  await page
    .getByRole("button", { name: "Enregistrer le projet", exact: true })
    .click();
  await expect(page.locator(".project-message")).toContainText(
    "Sauvegarde locale",
  );
  await page.reload();
  await page.locator(".project-panel summary").click();
  await page
    .getByLabel("Projets enregistrés")
    .selectOption({ label: "Atomic save · 1 PDF" });
  await page
    .getByRole("button", { name: "Ouvrir le projet", exact: true })
    .click();
  await expect(page.locator(".redaction:not(.draft)")).toHaveCount(1);
});
