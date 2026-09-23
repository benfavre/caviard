export class LocalAI {
  constructor() {
    this.pending = new Map();
    this.nextId = 0;
  }
  request(type, payload) {
    if (!this.worker) {
      this.worker = new Worker(new URL("./worker.mjs", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = ({ data }) => {
        const task = this.pending.get(data.id);
        if (!task) return;
        clearTimeout(task.timer);
        this.pending.delete(data.id);
        data.error
          ? task.reject(new Error(data.error))
          : task.resolve(data.result);
      };
      this.worker.onerror = () =>
        this.stop(
          new Error(
            "Le moteur local a rencontré une erreur. Relancez l’analyse.",
          ),
        );
    }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.stop(
            new Error(
              "Le modèle a dépassé le temps disponible. Réessayez avec une instruction plus courte.",
            ),
          ),
        180000,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, payload });
    });
  }
  stop(error = new DOMException("Analyse annulée", "AbortError")) {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
}
