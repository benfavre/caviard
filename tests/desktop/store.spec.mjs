import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Exercise the real main/preload/renderer with store package metadata. This is
// not a native MAS sandbox or installed AppX acceptance test.
for (const channel of ["mac-app-store", "microsoft-store"]) {
  test(`${channel}: store-owned updates in the real desktop UI and IPC`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "inklura-store-"));
    let app;
    try {
      await symlink(path.resolve("electron"), path.join(root, "electron"), "junction");
      await writeFile(path.join(root, "package.json"), JSON.stringify({
        name: "inklura-store-test", version: "1.4.0", main: "electron/main.mjs",
        type: "module", distributionChannel: channel,
        accountApi: "https://outils.inklura.fr/api/inklura-pdf",
      }));
      app = await electron.launch({ args: [root] });
      const page = await app.firstWindow();
      await expect(page.getByLabel("Version et mises à jour")).toContainText(
        channel === "mac-app-store" ? "gérées par App Store" : "gérées par Microsoft Store");
      await expect(page.getByRole("button", { name: "Rechercher une mise à jour" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Télécharger pour mon Mac" })).toHaveCount(0);
      const result = await page.evaluate(async () => ({
        info: await window.caviardDesktop.info(),
        update: await window.caviardDesktop.checkUpdates(),
        install: await window.caviardDesktop.installUpdate(),
        account: await window.caviardDesktop.accountState(),
      }));
      expect(result.info.distributionChannel).toBe(channel);
      expect(result.update.phase).toBe("store");
      expect(result.install.reason).toBe("store-managed");
      expect(result.account.externalPurchases).toBe(channel !== "mac-app-store");
      if (channel === "mac-app-store") {
        expect(await page.evaluate(async () => {
          try { await window.caviardDesktop.checkout("volume-100", {}); return "opened"; }
          catch (error) { return error.message; }
        })).toContain("achats externes");
      }
      expect(await app.evaluate(({ app }) => {
        const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/package.json");
        return Object.keys(require.cache).some(file => file.includes("electron-updater"));
      })).toBe(false);
    } finally {
      if (app) {
        await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); });
        await app.close();
      }
      await rm(root, { recursive: true, force: true });
    }
  });
}
