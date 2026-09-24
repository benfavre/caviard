export const pageSignature = (marks, page) =>
  JSON.stringify(marks.filter((m) => m.page === page));
export const isReviewed = (doc, page, marks, reviewed) =>
  reviewed[doc.id]?.[page] === pageSignature(marks[doc.id] || [], page);
export const reviewedCount = (doc, marks, reviewed) =>
  Array.from({ length: doc.pdf.numPages }, (_, i) =>
    isReviewed(doc, i + 1, marks, reviewed),
  ).filter(Boolean).length;
export function documentStatus(doc, marks, reviewed, saved) {
  if (
    Object.hasOwn(saved, doc.id) &&
    JSON.stringify(saved[doc.id]) === JSON.stringify(marks[doc.id] || [])
  )
    return "Exporté";
  if (reviewedCount(doc, marks, reviewed) === doc.pdf.numPages) return "Relu";
  return marks[doc.id]?.length ? "Modifié" : "À traiter";
}
export function folderTree(documents, query = "") {
  const root = { folders: new Map(), documents: [] };
  documents.forEach((doc, index) => {
    const path = doc.relativePath || doc.name;
    if (!path.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return;
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    let node = root;
    for (const part of parts) {
      if (!node.folders.has(part))
        node.folders.set(part, { folders: new Map(), documents: [] });
      node = node.folders.get(part);
    }
    node.documents.push({ doc, index });
  });
  return root;
}
