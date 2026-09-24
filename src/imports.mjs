export const MAX_DOCUMENTS = 250;
export const MAX_IMPORT_BYTES = 512 * 1024 * 1024;
export const relativeName = (file) => file.relativePath || file.webkitRelativePath || file.name;
export const fileKey = (file) => file.sourceKey ||
  `${relativeName(file)}\0${file.size}\0${file.lastModified}`;

export async function droppedFiles(dataTransfer) {
  // Capture entries during the drop event, before the browser clears its store.
  const entries = Array.from(dataTransfer.items || []).map((item) => item.webkitGetAsEntry?.());
  const fallback = Array.from(dataTransfer.files || []);
  if (!entries.some(Boolean)) return fallback;
  const files = [];
  let visited = 0, limited = false;
  const visit = async (entry, parent = "") => {
    if (!entry || limited) return;
    if (++visited > 20000) { limited = true; return; }
    const relativePath = parent + entry.name;
    if (entry.isFile) {
      if (!/\.pdf$/i.test(entry.name)) return;
      if (files.length >= MAX_DOCUMENTS) { limited = true; return; }
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      files.push({ name: file.name, type: file.type, size: file.size,
        lastModified: file.lastModified, relativePath, arrayBuffer: () => file.arrayBuffer() });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      while (!limited) {
        const children = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!children.length) break;
        for (const child of children) await visit(child, relativePath + "/");
      }
    }
  };
  for (const entry of entries) await visit(entry);
  if (limited)
    throw new Error("Dossier trop volumineux. Sélectionnez un sous-dossier de moins de 250 PDF.");
  return files;
}
