export async function confirmExport(page) {
  const dialog = page.locator(".export-review");
  const acknowledgement = dialog.getByLabel(
    "Je souhaite exporter les pages non relues",
  );
  // These export tests intentionally leave pages unreviewed. Wait for the
  // dialog's initial selection to render instead of racing isVisible().
  await acknowledgement.check();
  await dialog.getByRole("button", { name: "Confirmer l’export" }).click();
}
