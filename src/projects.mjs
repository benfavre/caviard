const DB = "inklura-projects-v1";
let connection,
  queue = Promise.resolve();
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
async function database() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("documents", { keyPath: "id" });
        open.result.createObjectStore("projects", { keyPath: "id" });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => {
        connection = null;
        reject(open.error);
      };
    });
  return connection;
}
const serial = (fn) => {
  const next = queue.then(fn);
  queue = next.catch(() => {});
  return next;
};
function complete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () =>
      reject(tx.error || new Error("Sauvegarde interrompue."));
  });
}
export async function listProjects() {
  await queue;
  const db = await database();
  return (
    await request(db.transaction("projects").objectStore("projects").getAll())
  )
    .map(({ id, name, updated, documents }) => ({
      id,
      name,
      updated,
      count: documents.length,
    }))
    .sort((a, b) => b.updated - a.updated);
}
export function saveProject(id, name, workspace) {
  // Capture metadata before awaiting PDF bytes; no passwords or account data.
  const { documents, history, reviewed, savedMarks, active, page } = workspace;
  const snapshot = structuredClone({
    id,
    name,
    version: 1,
    updated: Date.now(),
    documents: documents.map(({ id, name, relativePath, sourceKey, size }) => ({
      id,
      name,
      relativePath,
      sourceKey,
      size,
    })),
    history,
    reviewed,
    savedMarks,
    active,
    page,
  });
  return serial(async () => {
    const db = await database();
    const stored = new Set(
      await request(
        db.transaction("documents").objectStore("documents").getAllKeys(),
      ),
    );
    const added = [];
    for (const doc of documents)
      if (!stored.has(doc.id))
        added.push({
          id: doc.id,
          bytes: new Blob([await doc.pdf.getData()], {
            type: "application/pdf",
          }),
        });
    const tx = db.transaction(["projects", "documents"], "readwrite");
    const done = complete(tx);
    for (const doc of added) tx.objectStore("documents").put(doc);
    tx.objectStore("projects").put(snapshot);
    // Garbage collection runs in the same atomic transaction as the snapshot.
    tx.objectStore("projects").getAll().onsuccess = (event) => {
      const used = new Set(
        event.target.result.flatMap((p) => p.documents.map((d) => d.id)),
      );
      tx.objectStore("documents").openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!used.has(cursor.key)) cursor.delete();
          cursor.continue();
        }
      };
    };
    await done;
  });
}
export async function loadProject(id) {
  await queue;
  const db = await database();
  const tx = db.transaction(["projects", "documents"]);
  const project = await request(tx.objectStore("projects").get(id));
  if (!project || project.version !== 1)
    throw new Error("Projet introuvable ou incompatible.");
  const docs = await Promise.all(
    project.documents.map(async (doc) => {
      const source = await request(tx.objectStore("documents").get(doc.id));
      if (!source?.bytes) throw new Error("Un PDF du projet est introuvable.");
      return { ...doc, bytes: source.bytes };
    }),
  );
  return { ...project, documents: docs };
}
export function deleteProject(id) {
  return serial(async () => {
    const db = await database();
    const tx = db.transaction(["projects", "documents"], "readwrite");
    const done = complete(tx);
    tx.objectStore("projects").delete(id);
    tx.objectStore("projects").getAll().onsuccess = (event) => {
      const used = new Set(
        event.target.result.flatMap((p) => p.documents.map((d) => d.id)),
      );
      tx.objectStore("documents").openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!used.has(cursor.key)) cursor.delete();
          cursor.continue();
        }
      };
    };
    await done;
  });
}
