import React, { useState } from "react";
import { folderTree, documentStatus } from "./workspace.mjs";
export default function DocumentTree({
  documents,
  active,
  marks,
  reviewed,
  savedMarks,
  disabled,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const tree = folderTree(documents, query);
  function branch(node) {
    return (
      <ul>
        {[...node.folders].map(([name, child]) => (
          <li key={`folder-${name}`}>
            <details open>
              <summary>{name}</summary>
              {branch(child)}
            </details>
          </li>
        ))}
        {node.documents.map(({ doc, index }) => (
          <li key={doc.id}>
            <button
              disabled={disabled}
              aria-current={active === index ? "true" : undefined}
              title={doc.relativePath || doc.name}
              onClick={() => onSelect(index)}
            >
              <span>{doc.name}</span>
              <small>{documentStatus(doc, marks, reviewed, savedMarks)}</small>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <nav className="document-tree" aria-label="Dossiers et documents">
      <strong>DOCUMENTS · {documents.length}</strong>
      <label>
        <span className="sr-only">Rechercher un document</span>
        <input
          aria-label="Rechercher un document"
          type="search"
          placeholder="Rechercher un fichier…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {branch(tree)}
      {!tree.folders.size && !tree.documents.length && (
        <p>Aucun document trouvé.</p>
      )}
    </nav>
  );
}
