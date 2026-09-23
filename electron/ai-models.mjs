import { EventEmitter } from "node:events";
import { readFile, mkdir, stat, rename, rm, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
const manifest = JSON.parse(
  await readFile(new URL("./ai-manifest.json", import.meta.url), "utf8"),
);
export { manifest };
export async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export class ModelStore extends EventEmitter {
  constructor(root, { files = manifest.files, fetcher = fetch } = {}) {
    super();
    Object.assign(this, { root, files, fetcher });
    this.state = {
      phase: "missing",
      received: 0,
      total: files.reduce((n, f) => n + f.size, 0),
      message: "",
    };
  }
  snapshot() {
    return { ...this.state };
  }
  update(patch) {
    Object.assign(this.state, patch);
    this.emit("state", this.snapshot());
  }
  file(relative) {
    const entry = this.files.find((f) => f.path === relative);
    return entry ? path.join(this.root, entry.path) : null;
  }
  async status() {
    if (this.running) return this.snapshot();
    const okay = await Promise.all(
      this.files.map(async (f) => {
        try {
          return (await stat(this.file(f.path))).size === f.size;
        } catch {
          return false;
        }
      }),
    );
    this.update({ phase: okay.every(Boolean) ? "ready" : "missing" });
    return this.snapshot();
  }
  cancel() {
    this.abort?.abort();
  }
  install() {
    if (this.running) return this.running;
    this.abort = new AbortController();
    this.running = this.download(this.abort.signal).finally(() => {
      this.running = null;
      this.abort = null;
    });
    return this.running;
  }
  async download(signal) {
    this.update({ phase: "downloading", received: 0, message: "" });
    let completed = 0;
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      for (const entry of this.files) {
        signal.throwIfAborted();
        const file = this.file(entry.path),
          temp = file + ".part";
        await mkdir(path.dirname(file), { recursive: true });
        try {
          if (
            (await stat(file)).size === entry.size &&
            (await hashFile(file)) === entry.sha256
          ) {
            completed += entry.size;
            this.update({ received: completed });
            continue;
          }
        } catch {}
        const response = await this.fetcher(entry.url, { signal });
        if (!response.ok || !response.body)
          throw new Error(
            "Le téléchargement a échoué. Vérifiez votre connexion puis réessayez.",
          );
        let bytes = 0,
          last = 0;
        const hash = createHash("sha256");
        const counter = new Transform({
          transform: (chunk, _encoding, done) => {
            bytes += chunk.length;
            hash.update(chunk);
            if (bytes > entry.size)
              return done(new Error("Taille du modèle inattendue."));
            if (Date.now() - last > 200) {
              last = Date.now();
              this.update({ received: completed + bytes });
            }
            done(null, chunk);
          },
        });
        try {
          await pipeline(
            Readable.fromWeb(response.body),
            counter,
            createWriteStream(temp, { mode: 0o600 }),
            { signal },
          );
          if (bytes !== entry.size || hash.digest("hex") !== entry.sha256)
            throw new Error(
              "Le modèle téléchargé est incomplet ou endommagé. Réessayez.",
            );
          await rename(temp, file);
        } finally {
          await rm(temp, { force: true });
        }
        completed += bytes;
        this.update({ received: completed });
      }
      await writeFile(
        path.join(this.root, "installed.json"),
        JSON.stringify({ version: manifest.version }),
      );
      this.update({ phase: "ready", received: this.state.total });
    } catch (error) {
      this.update({
        phase: signal.aborted ? "missing" : "error",
        message: signal.aborted
          ? "Téléchargement annulé. Les fichiers terminés sont conservés."
          : error.message,
      });
    }
    return this.snapshot();
  }
}
