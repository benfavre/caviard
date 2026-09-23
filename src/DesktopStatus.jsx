import React, { useEffect, useState } from "react";
export default function DesktopStatus({ dirty, busy }) {
  const desktop = window.caviardDesktop;
  const [info, setInfo] = useState(null),
    [state, setState] = useState(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    desktop.info().then((value) => {
      if (active) setInfo(value);
    });
    desktop.updateState().then((value) => {
      if (active) setState(value);
    });
    const off = desktop.onUpdate((value) => {
      setState(value);
      setMessage("");
    });
    return () => {
      active = false;
      off();
    };
  }, []);
  useEffect(() => {
    desktop?.setDocumentState({ dirty, busy });
  }, [dirty, busy]);
  if (!desktop || !state) return null;
  const labels = {
    idle: "Mises à jour automatiques activées",
    checking: "Recherche de mises à jour…",
    current: "Inklura PDF est à jour",
    downloading: `Téléchargement de la mise à jour : ${Math.round(state.percent)} %`,
    ready: `La version ${state.version} est prête à installer`,
    installing: "Redémarrage…",
    disabled: state.message,
    error: state.message,
  };
  const blocked = dirty || busy;
  return (
    <aside className="desktop-status" aria-label="Version et mises à jour">
      <span className="desktop-version">Inklura PDF {info?.version}</span>
      <span aria-live="polite">{message || labels[state.phase]}</span>
      {state.phase === "ready" ? (
        <button
          className="primary"
          disabled={blocked}
          title={blocked ? "Exportez vos caviardages avant de redémarrer." : ""}
          onClick={async () => {
            const result = await desktop.installUpdate();
            if (!result.ok)
              setMessage(result.message || "La mise à jour n’est pas prête.");
          }}
        >
          Redémarrer et installer
        </button>
      ) : (
        <button
          disabled={[
            "disabled",
            "checking",
            "downloading",
            "installing",
          ].includes(state.phase)}
          onClick={() => desktop.checkUpdates().then(setState)}
        >
          Rechercher une mise à jour
        </button>
      )}
      {state.phase === "ready" && blocked && (
        <small>Exportez vos caviardages avant de redémarrer.</small>
      )}
    </aside>
  );
}
