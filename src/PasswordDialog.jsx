import React, { useEffect, useRef, useState } from "react";
export default function PasswordDialog({ request, onAnswer }) {
  const dialog = useRef(null),
    [value, setValue] = useState("");
  useEffect(() => {
    setValue("");
    if (request) dialog.current.showModal();
    else dialog.current.close();
  }, [request]);
  return (
    <dialog
      ref={dialog}
      className="workspace-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(null);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const password = value;
          setValue("");
          onAnswer(password);
        }}
      >
        <h2>Ouvrir un PDF protégé</h2>
        <p>{request?.name}</p>
        {request?.incorrect && (
          <p role="alert">Mot de passe incorrect. Réessayez.</p>
        )}
        <label>
          Mot de passe du PDF
          <input
            autoFocus
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <p>
          Le mot de passe reste en mémoire uniquement pendant l’ouverture. Il
          n’est pas enregistré dans vos projets.
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={() => onAnswer(null)}>
            Ignorer ce PDF
          </button>
          <button className="primary" type="submit">
            Déverrouiller
          </button>
        </div>
      </form>
    </dialog>
  );
}
