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
import { existsSync, createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { ModelStore } from "./ai-models.mjs";
import { AccountController } from "./account.mjs";
import { AccountExports } from "./account-export.mjs";
import { DocumentImports, launchPaths } from "./document-imports.mjs";
import { BatchExports } from "./batch-exports.mjs";
import { installDesktopEntry, removeDesktopEntry } from "./linux-integration.mjs";
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
app.setName("Inklura PDF");
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
  modelStore,
  accountController,
  accountExports,
  allowClose = false,
  closingPrompt = false;
let documentState = { dirty: false, busy: false };
let initialized = false;
const imports = new DocumentImports(() => {
  if (window && !window.isDestroyed()) window.webContents.send("documents:available");
});
const batchExports = new BatchExports();
function receivePaths(paths) {
  if (paths.length) void imports.enqueue(paths).catch(() => {});
  if (window && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore();
    window.focus();
  } else if (initialized) void createWindow();
}
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  receivePaths([filePath]);
});
const initialPaths = launchPaths(process.argv, process.cwd(), app.isPackaged);
// Chromium can reorder second-instance argv. Forward our already-parsed paths
// explicitly so runtime flags cannot turn the application directory into input.
const primary = app.requestSingleInstanceLock({ paths: initialPaths });
if (!primary) app.quit();
else {
  if (initialPaths.length) receivePaths(initialPaths);
  app.on("second-instance", (_event, _argv, _cwd, data) => {
    receivePaths(Array.isArray(data?.paths) ? data.paths : []);
  });
}
const csp =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
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
    title: "Inklura PDF",
    icon: path.join(dist, "inklura-icon.png"),
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
        title: "Fermer Inklura PDF ?",
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
if (primary) app
  .whenReady()
  .then(async () => {
    modelStore = new ModelStore(
      (!app.isPackaged && process.env.INKLURA_AI_MODELS) ||
        path.join(app.getPath("userData"), "ai-models", "v1"),
    );
    modelStore.on("state", (state) => {
      if (window && !window.isDestroyed())
        window.webContents.send("ai:models", state);
    });
    protocol.handle("caviard", async (request) => {
      if (!["GET", "HEAD"].includes(request.method))
        return new Response("", { status: 405 });
      try {
        const url = new URL(request.url);
        if (isAppUrl(request.url) && url.pathname.startsWith("/ai-models/")) {
          const file = modelStore.file(
            decodeURIComponent(url.pathname.slice("/ai-models/".length)),
          );
          if (!file || !existsSync(file))
            return new Response("Not found", { status: 404 });
          return new Response(
            request.method === "HEAD"
              ? null
              : Readable.toWeb(createReadStream(file)),
            {
              headers: {
                "Content-Type": file.endsWith(".json")
                  ? "application/json"
                  : "application/octet-stream",
                "Content-Security-Policy": csp,
              },
            },
          );
        }
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
    accountController = new AccountController({
      apiUrl: (!app.isPackaged && process.env.INKLURA_PDF_ACCOUNT_API) || metadata.accountApi,
      development: !app.isPackaged,
      openExternal: (url) => shell.openExternal(url),
      onSignedIn: () => accountExports.reconcile(),
    });
    accountExports = new AccountExports({ directory: path.join(app.getPath("userData"), "account-exports"), account: accountController });
    accountController.on("state", (state) => {
      if (window && !window.isDestroyed()) window.webContents.send("account:state", state);
    });
    ipcMain.handle("account:state", (event) => { trusted(event); return accountController.snapshot(); });
    ipcMain.handle("account:sign-in", (event) => { trusted(event); return accountController.signIn(); });
    ipcMain.handle("account:cancel", (event) => { trusted(event); return accountController.cancel(); });
    ipcMain.handle("account:sign-out", (event) => {
      trusted(event);
      if (documentState.busy) throw new Error("Attendez la fin de l’export pour vous déconnecter.");
      return accountController.logout();
    });
    ipcMain.handle("account:refresh", async (event) => {
      trusted(event);
      await accountController.refresh();
      await accountExports.reconcile();
      return accountController.refresh();
    });
    ipcMain.handle("account:checkout", (event, planId, billing) => { trusted(event); return accountController.checkout(planId, billing); });
    ipcMain.handle("account:portal", (event) => { trusted(event); return accountController.portal(); });
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
    ipcMain.handle("ai:models", (event) => {
      trusted(event);
      return modelStore.status();
    });
    ipcMain.handle("ai:install", (event) => {
      trusted(event);
      return modelStore.install();
    });
    ipcMain.handle("ai:cancel", (event) => {
      trusted(event);
      modelStore.cancel();
    });
    ipcMain.handle("desktop:info", (event) => {
      trusted(event);
      return { version: app.getVersion(), platform: process.platform };
    });
    ipcMain.on("desktop:document-state", (event, state) => {
      trusted(event);
      documentState = { dirty: !!state?.dirty, busy: !!state?.busy };
    });
    async function pickDocuments(folder = false) {
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        title: folder ? "Importer un dossier de PDF" : "Ouvrir des PDF",
        properties: folder ? ["openDirectory"] : ["openFile", "multiSelections"],
        ...(folder ? {} : { filters: [{ name: "Documents PDF", extensions: ["pdf"] }] }),
      });
      if (!canceled) await imports.enqueue(filePaths);
    }
    ipcMain.handle("documents:choose", async (event, folder) => {
      trusted(event);
      await pickDocuments(folder === true);
    });
    ipcMain.handle("documents:drop", async (event, paths) => {
      trusted(event);
      if (!Array.isArray(paths) || paths.length > 250) throw new Error("Invalid selection");
      await imports.enqueue(paths);
    });
    ipcMain.handle("documents:take", (event) => { trusted(event); return imports.take(); });
    ipcMain.handle("documents:read", (event, id) => { trusted(event); return imports.read(id); });
    ipcMain.handle("documents:discard", (event, ids) => {
      trusted(event);
      if (Array.isArray(ids)) imports.discard(ids);
    });
    ipcMain.handle("documents:begin-export", async (event, documents) => {
      trusted(event);
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        title: "Choisir le dossier de destination",
        properties: ["openDirectory", "createDirectory"],
      });
      if (canceled || !filePaths[0]) return null;
      return batchExports.begin(filePaths[0], documents);
    });
    ipcMain.handle("documents:end-export", (event, id) => {
      trusted(event);
      batchExports.finish(id);
    });
    async function saveBytes(filePath, bytes) {
      if (accountController.apiUrl) {
        try { return await accountExports.save(filePath, bytes); }
        catch (error) { return { saved: false, error: error.message || "Le compte Inklura est temporairement indisponible." }; }
      }
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
    }
    ipcMain.handle("desktop:save-pdf", async (event, { filename, data, batch }) => {
      trusted(event);
      const bytes = pdfBuffer(data);
      if (batch) {
        const filePath = await batchExports.destination(batch.id, batch.documentId);
        return saveBytes(filePath, bytes);
      }
      const name = safePdfName(filename);
      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: "Enregistrer le PDF caviardé",
        defaultPath: path.join(app.getPath("downloads"), name),
        filters: [{ name: "Document PDF", extensions: ["pdf"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      });
      if (canceled || !filePath) return { saved: false };
      return saveBytes(filePath, bytes);
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
        { label: "Fichier", submenu: [
          { label: "Ouvrir des PDF…", accelerator: "CmdOrCtrl+O", click: () => void pickDocuments() },
          { label: "Importer un dossier…", accelerator: "CmdOrCtrl+Shift+O", click: () => void pickDocuments(true) },
          ...(process.platform === "linux" ? [
            { type: "separator" },
            { label: "Ajouter au menu Ouvrir avec…", enabled: app.isPackaged,
              click: async () => {
                try {
                  await installDesktopEntry({
                    dataHome: process.env.XDG_DATA_HOME || path.join(app.getPath("home"), ".local/share"),
                    executable: process.env.APPIMAGE || process.execPath,
                    icon: path.join(dist, "inklura-icon.png"),
                  });
                  await dialog.showMessageBox(window, { type: "info", message: "Inklura PDF a été ajouté au menu Ouvrir avec des PDF et dossiers." });
                } catch {
                  await dialog.showMessageBox(window, { type: "error", message: "Impossible d’ajouter l’intégration au bureau." });
                }
              } },
            { label: "Retirer du menu Ouvrir avec", enabled: app.isPackaged,
              click: async () => {
                try {
                  await removeDesktopEntry(process.env.XDG_DATA_HOME || path.join(app.getPath("home"), ".local/share"));
                  await dialog.showMessageBox(window, { type: "info", message: "L’intégration au bureau a été retirée." });
                } catch {
                  await dialog.showMessageBox(window, { type: "error", message: "Impossible de retirer l’intégration au bureau." });
                }
              } },
          ] : []),
          { type: "separator" },
          { role: "close", label: "Fermer" },
        ] },
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
              label: "À propos d’Inklura PDF",
              click: () =>
                dialog.showMessageBox(window, {
                  type: "info",
                  title: "Inklura PDF",
                  message: `Inklura PDF ${app.getVersion()}`,
                  detail:
                    "Caviardage de PDF sur votre appareil. Vos documents ne sont jamais envoyés sur un serveur.",
                }),
            },
          ],
        },
      ]),
    );
    initialized = true;
    await createWindow();
    controller.start();
    void accountController.initialize();
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
app.on("will-quit", () => { controller?.dispose(); accountController?.dispose(); });
