import { expect } from "@playwright/test";

export async function confirmExport(page) {
  const dialog = page.locator(".export-review");
  const acknowledgement = dialog.getByLabel(
    "Je souhaite exporter les pages non relues",
  );
  // check() returns immediately for an already checked input, even in the
  // previous hidden dialog. Wait for reopening and the fresh acknowledgement
  // reset before accepting; otherwise the opening effect can undo our check.
  await expect(dialog).toBeVisible();
  await expect(acknowledgement).not.toBeChecked();
  await acknowledgement.check();
  await dialog.getByRole("button", { name: "Confirmer l’export" }).click();
}
