import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  shell,
  session,
} from "electron";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import electronUpdater from "electron-updater";
import {
  APP_URL,
  isAppUrl,
  assetPath,
  externalUrl,
  safePdfName,
  pdfBuffer,
} from "./security.mjs";
import { UpdateController } from "./updater.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "../dist");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "caviard",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window,
  controller,
  allowClose = false,
  closingPrompt = false;
let documentState = { dirty: false, busy: false };
const csp =
  "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};
function trusted(event) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !isAppUrl(event.senderFrame.url)
  )
    throw new Error("Untrusted IPC sender");
}
function publishState(state) {
  if (window && !window.isDestroyed())
    window.webContents.send("updates:state", state);
}
async function openExternal(value) {
  const url = externalUrl(value);
  if (url) await shell.openExternal(url).catch(() => {});
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 390,
    minHeight: 600,
    title: "Caviard",
    icon: path.join(dist, "caviard-icon.png"),
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    if (!isAppUrl(url)) openExternal(url);
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.on("close", (event) => {
    if (allowClose || (!documentState.dirty && !documentState.busy)) return;
    event.preventDefault();
    if (closingPrompt) return;
    closingPrompt = true;
    dialog
      .showMessageBox(window, {
        type: "warning",
        title: "Fermer Caviard ?",
        message: documentState.busy
          ? "Un PDF est en cours de traitement."
          : "Des caviardages n’ont pas encore été exportés.",
        detail: "Les modifications non exportées seront perdues.",
        buttons: ["Continuer à travailler", "Quitter"],
        defaultId: 0,
        cancelId: 0,
      })
      .then(({ response }) => {
        if (response === 1) {
          allowClose = true;
          window.close();
        }
      })
      .finally(() => {
        closingPrompt = false;
      });
  });
  window.on("closed", () => {
    window = null;
    documentState = { dirty: false, busy: false };
    allowClose = false;
  });
  await window.loadURL(APP_URL);
}
app.setName("Caviard");
app
  .whenReady()
  .then(async () => {
    protocol.handle("caviard", async (request) => {
      if (!["GET", "HEAD"].includes(request.method))
        return new Response("", { status: 405 });
      try {
        const file = assetPath(request.url, dist);
        const bytes = await readFile(file);
        return new Response(request.method === "HEAD" ? null : bytes, {
          headers: {
            "Content-Type":
              mime[path.extname(file)] || "application/octet-stream",
            "Content-Security-Policy": csp,
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    const { autoUpdater } = electronUpdater;
    autoUpdater.logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    const configured = existsSync(
      path.join(process.resourcesPath, "app-update.yml"),
    );
    const metadata = JSON.parse(
      await readFile(path.join(app.getAppPath(), "package.json"), "utf8"),
    );
    const signedMac =
      process.platform !== "darwin" || metadata.macAutoUpdates === true;
    const supported =
      (process.platform !== "linux" || !!process.env.APPIMAGE) && signedMac;
    const enabled = app.isPackaged && configured && supported;
    controller = new UpdateController(autoUpdater, {
      enabled,
      reason: !app.isPackaged
        ? "Les mises à jour sont disponibles dans la version installée."
        : !signedMac
          ? "Version macOS non signée : téléchargez les mises à jour sur GitHub."
          : !supported
            ? "Utilisez la version AppImage pour les mises à jour automatiques."
            : "Les mises à jour ne sont pas configurées pour cette version.",
      canInstall: () => !documentState.dirty && !documentState.busy,
      onInstall: () => {
        allowClose = true;
      },
    });
    controller.on("state", publishState);
    ipcMain.handle("desktop:info", (event) => {
      trusted(event);
      return { version: app.getVersion(), platform: process.platform };
    });
    ipcMain.on("desktop:document-state", (event, state) => {
      trusted(event);
      documentState = { dirty: !!state?.dirty, busy: !!state?.busy };
    });
    ipcMain.handle("desktop:save-pdf", async (event, { filename, data }) => {
      trusted(event);
      const bytes = pdfBuffer(data);
      const name = safePdfName(filename);
      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: "Enregistrer le PDF caviardé",
        defaultPath: path.join(app.getPath("downloads"), name),
        filters: [{ name: "Document PDF", extensions: ["pdf"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      });
      if (canceled || !filePath) return { saved: false };
      const temporary = path.join(
        path.dirname(filePath),
        `.caviard-${randomUUID()}.tmp`,
      );
      try {
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, filePath);
      } finally {
        await unlink(temporary).catch(() => {});
      }
      return { saved: true };
    });
    ipcMain.handle("updates:state", (event) => {
      trusted(event);
      return controller.snapshot();
    });
    ipcMain.handle("updates:check", (event) => {
      trusted(event);
      return controller.check();
    });
    ipcMain.handle("updates:install", (event) => {
      trusted(event);
      return controller.install();
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
        { label: "Fichier", submenu: [{ role: "close", label: "Fermer" }] },
        {
          label: "Édition",
          submenu: [
            { role: "undo", label: "Annuler" },
            { role: "redo", label: "Rétablir" },
            { type: "separator" },
            { role: "cut", label: "Couper" },
            { role: "copy", label: "Copier" },
            { role: "paste", label: "Coller" },
            { role: "selectAll", label: "Tout sélectionner" },
          ],
        },
        {
          label: "Affichage",
          submenu: [
            { role: "resetZoom", label: "Taille réelle" },
            { role: "zoomIn", label: "Agrandir" },
            { role: "zoomOut", label: "Réduire" },
            { role: "togglefullscreen", label: "Plein écran" },
          ],
        },
        {
          label: "Aide",
          submenu: [
            {
              label: "Rechercher une mise à jour",
              click: () => controller.check(),
            },
            {
              label: "À propos de Caviard",
              click: () =>
                dialog.showMessageBox(window, {
                  type: "info",
                  title: "Caviard",
                  message: `Caviard ${app.getVersion()}`,
                  detail:
                    "Caviardage de PDF sur votre appareil. Vos documents ne sont jamais envoyés sur un serveur.",
                }),
            },
          ],
        },
      ]),
    );
    await createWindow();
    controller.start();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    console.error(error);
    app.quit();
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("will-quit", () => controller?.dispose());
