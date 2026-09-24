import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { safePdfName } from "./security.mjs";

function folderName(value) {
  const clean = value.replace(/[\x00-\x1f<>:"|?*]/g, "_").replace(/[. ]+$/g, "").slice(0, 80);
  return !clean || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)
    ? `_${clean || "dossier"}` : clean;
}

export class BatchExports {
  constructor() { this.batches = new Map(); }
  async begin(parent, documents) {
    if (!Array.isArray(documents) || !documents.length || documents.length > 250)
      throw new Error("Invalid export batch");
    const ids = new Set(), names = new Set();
    const entries = documents.map(({ id, name, relativePath = name }) => {
      if (typeof id !== "string" || !id || ids.has(id) ||
        typeof relativePath !== "string" || relativePath.length > 4096)
        throw new Error("Invalid export document");
      ids.add(id);
      const parts = relativePath.replace(/\\/g, "/").split("/");
      if (parts.some((part) => part === ".." || part === "." || !part))
        throw new Error("Invalid relative path");
      const folders = parts.slice(0, -1).map(folderName);
      const base = safePdfName(name).replace(/\.pdf$/i, "");
      let filename = `${base}-caviarde.pdf`, suffix = 1;
      while (names.has([...folders, filename].join("/").toLowerCase()))
        filename = `${base}-caviarde-${++suffix}.pdf`;
      names.add([...folders, filename].join("/").toLowerCase());
      return { id, parts: [...folders, filename] };
    });
    // A fresh output tree prevents overwriting originals or previous exports.
    const directory = await mkdtemp(path.join(parent, "Inklura-caviardages-"));
    const id = randomUUID();
    this.batches.set(id, { directory, files: new Map(entries.map((entry) =>
      [entry.id, path.join(directory, ...entry.parts)])) });
    return { id, name: path.basename(directory) };
  }
  async destination(batchId, documentId) {
    const batch = this.batches.get(batchId);
    const destination = batch?.files.get(documentId);
    if (!destination) throw new Error("Export expiré ou déjà enregistré.");
    batch.files.delete(documentId);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    return destination;
  }
  finish(id) { this.batches.delete(id); }
}
