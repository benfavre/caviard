const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("caviardDesktop", {
  models: () => ipcRenderer.invoke("ai:models"),
  installModels: () => ipcRenderer.invoke("ai:install"),
  cancelModels: () => ipcRenderer.invoke("ai:cancel"),
  onModels: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("ai:models", listener);
    return () => ipcRenderer.removeListener("ai:models", listener);
  },
  info: () => ipcRenderer.invoke("desktop:info"),
  savePdf: (filename, data) =>
    ipcRenderer.invoke("desktop:save-pdf", { filename, data }),
  setDocumentState: (state) =>
    ipcRenderer.send("desktop:document-state", {
      dirty: !!state.dirty,
      busy: !!state.busy,
    }),
  updateState: () => ipcRenderer.invoke("updates:state"),
  checkUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  },
});
