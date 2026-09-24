export async function confirmExport(page) {
  const dialog = page.locator(".export-review");
  const acknowledgement = dialog.getByLabel(
    "Je souhaite exporter les pages non relues",
  );
  if (await acknowledgement.isVisible()) await acknowledgement.check();
  await dialog.getByRole("button", { name: "Confirmer l’export" }).click();
}
