import { lstat, readdir, realpath, open } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

export const MAX_DOCUMENTS = 250;
export const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

export function launchPaths(argv, cwd, packaged) {
  return argv.slice(packaged ? 1 : 2)
    .filter((arg) => typeof arg === "string" && arg && !arg.startsWith("-") &&
      !/^[a-z][a-z\d+.-]*:\/\//i.test(arg))
    .map((arg) => path.resolve(cwd, arg));
}

// The renderer receives one-use IDs, never an API for arbitrary filesystem reads.
export class DocumentImports {
  constructor(notify = () => {}) {
    this.notify = notify;
    this.files = new Map();
    this.pending = [];
    this.messages = [];
    this.queue = Promise.resolve();
  }
  enqueue(paths) {
    const next = this.queue.then(() => this.scan(paths));
    this.queue = next.catch(() => {});
    return next;
  }
  async scan(paths) {
    let total = [...this.files.values()].reduce((n, file) => n + file.size, 0);
    let visited = 0, ignored = 0, added = 0, limited = false;
    const seen = new Set([...this.files.values()].map((file) => file.path));
    const visit = async (filePath, relativePath) => {
      if (limited) return;
      if (++visited > 20000 || this.files.size >= MAX_DOCUMENTS) {
        limited = true;
        return;
      }
      try {
        const stat = await lstat(filePath);
        // Do not leave the selected tree through links or traverse link cycles.
        if (stat.isSymbolicLink()) { ignored++; return; }
        if (stat.isDirectory()) {
          const entries = await readdir(filePath, { withFileTypes: true });
          entries.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
          for (const entry of entries) {
            if (entry.name.startsWith(".")) { ignored++; continue; }
            await visit(path.join(filePath, entry.name), `${relativePath}/${entry.name}`);
            if (limited) break;
          }
          return;
        }
        if (!stat.isFile() || !/\.pdf$/i.test(filePath)) { ignored++; return; }
        const canonical = await realpath(filePath);
        if (seen.has(canonical)) return;
        seen.add(canonical);
        if (stat.size > MAX_IMPORT_BYTES || total + stat.size > MAX_IMPORT_BYTES) {
          this.messages.push(`${relativePath} : limite de 512 Mo par import dépassée.`);
          return;
        }
        const id = randomUUID();
        const file = {
          id, path: canonical, name: path.basename(filePath), relativePath,
          size: stat.size,
          sourceKey: createHash("sha256").update(canonical).digest("hex"),
        };
        this.files.set(id, file);
        this.pending.push(id);
        total += stat.size;
        added++;
      } catch {
        this.messages.push(`${relativePath} : lecture impossible.`);
      }
    };
    for (const value of paths.slice(0, MAX_DOCUMENTS)) {
      if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) continue;
      await visit(value, path.basename(value));
    }
    if (paths.length > MAX_DOCUMENTS) limited = true;
    if (limited) this.messages.push("Import limité à 250 PDF ou 20 000 entrées. Sélectionnez un sous-dossier pour continuer.");
    if (!added && !this.messages.length) this.messages.push("Aucun nouveau PDF trouvé dans cette sélection.");
    if (ignored) this.messages.push(`${ignored} élément(s) non PDF, masqué(s) ou lien(s) ignoré(s).`);
    this.notify();
  }
  take() {
    const files = this.pending.splice(0).map((id) => {
      const { path: _path, ...file } = this.files.get(id);
      return file;
    });
    return { files, messages: this.messages.splice(0) };
  }
  async read(id) {
    const file = this.files.get(id);
    if (!file) throw new Error("Sélection de fichier expirée.");
    this.files.delete(id);
    const handle = await open(file.path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== file.size || stat.size > MAX_IMPORT_BYTES)
        throw new Error("Le fichier a changé depuis sa sélection.");
      // A bounded read also protects against a file growing after stat().
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < bytes.length) {
        const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!bytesRead) throw new Error("Le fichier a changé depuis sa sélection.");
        offset += bytesRead;
      }
      return bytes;
    } finally {
      await handle.close();
    }
  }
  discard(ids) {
    for (const id of ids) this.files.delete(id);
  }
  clear() {
    this.files.clear();
    this.pending = [];
    this.messages = [];
  }
}
