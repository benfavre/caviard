const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("caviardDesktop", {
  chooseDocuments: (folder = false) => ipcRenderer.invoke("documents:choose", folder),
  importDroppedFiles: (files) => ipcRenderer.invoke("documents:drop",
    Array.from(files).map((file) => webUtils.getPathForFile(file)).filter(Boolean)),
  takeDocuments: () => ipcRenderer.invoke("documents:take"),
  readDocument: (id) => ipcRenderer.invoke("documents:read", id),
  discardDocuments: (ids) => ipcRenderer.invoke("documents:discard", ids),
  onDocuments: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("documents:available", listener);
    return () => ipcRenderer.removeListener("documents:available", listener);
  },
  beginBatchExport: (documents) => ipcRenderer.invoke("documents:begin-export", documents),
  endBatchExport: (id) => ipcRenderer.invoke("documents:end-export", id),
  ovhState: () => ipcRenderer.invoke("ai:ovh-state"),
  ownOvhState: () => ipcRenderer.invoke("ai:own-ovh-state"),
  ownOvhConfigure: (config) => ipcRenderer.invoke("ai:own-ovh-configure", config),
  ownOvhClear: () => ipcRenderer.invoke("ai:own-ovh-clear"),
  ownOvhRequest: (type, payload, consent) => ipcRenderer.invoke("ai:own-ovh-request", type, payload, consent),
  ownOvhCancel: () => ipcRenderer.invoke("ai:own-ovh-cancel"),
  ovhRequest: (type, payload, consent) => ipcRenderer.invoke("ai:ovh-request", type, payload, consent),
  ovhCancel: () => ipcRenderer.invoke("ai:ovh-cancel"),
  accountState: () => ipcRenderer.invoke("account:state"),
  signIn: () => ipcRenderer.invoke("account:sign-in"),
  cancelSignIn: () => ipcRenderer.invoke("account:cancel"),
  signOut: () => ipcRenderer.invoke("account:sign-out"),
  deletePdfAccount: (confirmation) => ipcRenderer.invoke("account:delete", confirmation),
  refreshAccount: () => ipcRenderer.invoke("account:refresh"),
  checkout: (planId, billing) => ipcRenderer.invoke("account:checkout", planId, billing),
  billingPortal: () => ipcRenderer.invoke("account:portal"),
  purchaseAppleCredits: (productId) => ipcRenderer.invoke("account:apple-purchase", productId),
  onAccount: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("account:state", listener);
    return () => ipcRenderer.removeListener("account:state", listener);
  },
  models: () => ipcRenderer.invoke("ai:models"),
  installModels: () => ipcRenderer.invoke("ai:install"),
  cancelModels: () => ipcRenderer.invoke("ai:cancel"),
  onModels: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("ai:models", listener);
    return () => ipcRenderer.removeListener("ai:models", listener);
  },
  info: () => ipcRenderer.invoke("desktop:info"),
  savePdf: (filename, data, batch) =>
    ipcRenderer.invoke("desktop:save-pdf", { filename, data, batch }),
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
