import React, { useEffect, useRef, useState } from "react";
import { isReviewed, reviewedCount } from "./workspace.mjs";
export default function ExportReview({
  open,
  documents,
  marks,
  reviewed,
  onClose,
  onExport,
  onInspect,
}) {
  const dialog = useRef(null),
    [selected, setSelected] = useState(new Set()),
    [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (open) {
      setSelected(new Set(documents.map((d) => d.id)));
      setAcknowledged(false);
      dialog.current.showModal();
    } else dialog.current.close();
  }, [open]);
  const chosen = documents.filter((d) => selected.has(d.id));
  const unchecked = chosen.reduce(
    (n, d) => n + d.pdf.numPages - reviewedCount(d, marks, reviewed),
    0,
  );
  return (
    <dialog
      ref={dialog}
      className="workspace-dialog export-review"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2>Vérifier avant d’exporter</h2>
      <p>Sélectionnez les PDF à enregistrer. Les originaux restent intacts.</p>
      <div className="dialog-actions">
        <button
          onClick={() => {
            setSelected(new Set(documents.map((d) => d.id)));
            setAcknowledged(false);
          }}
        >
          Tous les documents
        </button>
        <button onClick={() => setSelected(new Set())}>Aucun document</button>
      </div>
      <ul>
        {documents.map((doc) => {
          const count = reviewedCount(doc, marks, reviewed),
            next = Array.from(
              { length: doc.pdf.numPages },
              (_, i) => i + 1,
            ).find((p) => !isReviewed(doc, p, marks, reviewed));
          return (
            <li key={doc.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(doc.id)}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const ids = new Set(prev);
                      e.target.checked ? ids.add(doc.id) : ids.delete(doc.id);
                      return ids;
                    });
                    setAcknowledged(false);
                  }}
                />
                <span>
                  {doc.relativePath || doc.name}
                  <small>
                    {count} / {doc.pdf.numPages} pages relues ·{" "}
                    {marks[doc.id]?.length || 0} zones
                  </small>
                </span>
              </label>
              {next && (
                <button
                  onClick={() => {
                    onClose();
                    onInspect(doc.id, next);
                  }}
                >
                  Relire ce document
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p>
        <strong>
          {chosen.length} PDF ·{" "}
          {window.caviardDesktop
            ? `${chosen.length} crédit(s) si tous les fichiers sont enregistrés`
            : "Téléchargement local"}
        </strong>
      </p>
      {unchecked > 0 && (
        <>
          <p className="review-warning">
            {unchecked} page(s) ne sont pas marquées comme relues. Les
            suggestions automatiques peuvent manquer des informations.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            Je souhaite exporter les pages non relues
          </label>
        </>
      )}
      {chosen.some((d) => !marks[d.id]?.length) && (
        <p>
          Certains documents n’ont aucune zone : leur contenu visible restera
          lisible.
        </p>
      )}
      <p>
        Les copies seront composées d’images, sans texte sélectionnable ni
        métadonnées documentaires.
      </p>
      <div className="dialog-actions">
        <button onClick={onClose}>Revenir au document</button>
        <button
          className="primary"
          disabled={!chosen.length || (unchecked > 0 && !acknowledged)}
          onClick={() => {
            onClose();
            onExport([...selected]);
          }}
        >
          Confirmer l’export
        </button>
      </div>
    </dialog>
  );
}
