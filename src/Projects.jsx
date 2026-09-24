import React, { useEffect, useRef, useState } from "react";
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
} from "./projects.mjs";
export default function Projects({
  workspace,
  disabled,
  dirty,
  onRestore,
  onWorking,
}) {
  const [items, setItems] = useState([]),
    [name, setName] = useState(""),
    [selected, setSelected] = useState("");
  const [automatic, setAutomatic] = useState(false),
    [pendingRecovery, setPendingRecovery] = useState(false);
  const [message, setMessage] = useState(""),
    [working, setWorking] = useState(false);
  const latest = useRef(workspace),
    saving = useRef(false);
  latest.current = workspace;
  const refresh = () => listProjects().then(setItems);
  useEffect(() => {
    listProjects()
      .then((list) => {
        setItems(list);
        setPendingRecovery(list.some((p) => p.id === "recovery"));
      })
      .catch(() => setMessage("Le stockage local est indisponible."));
  }, []);
  async function run(fn) {
    if (saving.current) return;
    saving.current = true;
    setWorking(true);
    onWorking(true);
    try {
      await fn();
      await refresh();
    } catch (error) {
      setMessage(
        `Sauvegarde locale : ${error.message || "espace disponible insuffisant"}`,
      );
    } finally {
      saving.current = false;
      setWorking(false);
      onWorking(false);
    }
  }
  useEffect(() => {
    if (!automatic || disabled || pendingRecovery) return;
    const timer = setTimeout(() => {
      void run(async () => {
        await saveProject(
          "recovery",
          "Récupération automatique",
          latest.current,
        );
        setMessage("Récupération enregistrée sur cet appareil.");
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    automatic,
    disabled,
    pendingRecovery,
    workspace.documents,
    workspace.history,
    workspace.reviewed,
    workspace.savedMarks,
    workspace.active,
    workspace.page,
  ]);
  async function restore(id) {
    if (
      dirty &&
      !window.confirm(
        "Remplacer les documents ouverts ? Enregistrez d’abord votre projet pour conserver vos modifications.",
      )
    )
      return;
    await run(async () => {
      const project = await loadProject(id);
      await onRestore(project);
      setSelected(id === "recovery" ? "" : id);
      setName(id === "recovery" ? "" : project.name);
      setPendingRecovery(false);
      setMessage("Projet restauré. Vérifiez vos pages avant d’exporter.");
    });
  }
  const blocked = disabled || working;
  return (
    <details className="project-panel">
      <summary>
        Projets et récupération{" "}
        {working
          ? "· Sauvegarde en cours…"
          : pendingRecovery
            ? "· Une récupération est disponible"
            : ""}
      </summary>
      <div className="project-controls">
        <p>
          Enregistrer un projet conserve une copie des PDF originaux, des zones
          et de la relecture sur cet appareil. Ces copies ne sont pas des PDF
          caviardés. Aucun mot de passe n’est enregistré.
        </p>
        {items.some((p) => p.id === "recovery") && (
          <div className="recovery-prompt">
            <strong>Un espace de travail peut être récupéré.</strong>
            <button disabled={blocked} onClick={() => restore("recovery")}>
              Restaurer la récupération
            </button>
            <button
              disabled={blocked}
              onClick={() => {
                setAutomatic(false);
                void run(async () => {
                  await deleteProject("recovery");
                  setPendingRecovery(false);
                  setMessage("Copie de récupération supprimée.");
                });
              }}
            >
              Supprimer la récupération
            </button>
          </div>
        )}
        <label>
          Nom du projet
          <input
            value={name}
            maxLength={100}
            disabled={blocked}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dossier client"
          />
        </label>
        <button
          disabled={blocked || !name.trim() || !workspace.documents.length}
          onClick={() =>
            run(async () => {
              const id = selected || crypto.randomUUID();
              await saveProject(id, name.trim(), latest.current);
              setSelected(id);
              setMessage("Projet enregistré sur cet appareil.");
            })
          }
        >
          Enregistrer le projet
        </button>
        <button
          disabled={blocked}
          onClick={() => {
            setSelected("");
            setName("");
          }}
        >
          Nouveau nom
        </button>
        <label>
          Projets enregistrés
          <select
            value={selected}
            disabled={blocked}
            onChange={(e) => {
              setSelected(e.target.value);
              setName(items.find((p) => p.id === e.target.value)?.name || "");
            }}
          >
            <option value="">Choisir un projet</option>
            {items
              .filter((p) => p.id !== "recovery")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.count} PDF
                </option>
              ))}
          </select>
        </label>
        <button
          disabled={blocked || !selected}
          onClick={() => restore(selected)}
        >
          Ouvrir le projet
        </button>
        <button
          disabled={blocked || !selected}
          onClick={() =>
            run(async () => {
              await deleteProject(selected);
              setSelected("");
              setName("");
              setMessage(
                "Projet et copies inutilisées supprimés de cet appareil.",
              );
            })
          }
        >
          Supprimer le projet
        </button>
        <label className="recovery-option">
          <input
            type="checkbox"
            checked={automatic}
            disabled={blocked || pendingRecovery}
            onChange={(e) => {
              const enabled = e.target.checked;
              setAutomatic(enabled);
              if (!enabled)
                void run(async () => {
                  await deleteProject("recovery");
                  setMessage(
                    "Récupération désactivée et copie automatique supprimée.",
                  );
                });
            }}
          />
          Conserver une récupération automatique pendant cette session
        </label>
        <small>
          Les projets restent jusqu’à leur suppression. La récupération se met à
          jour après une pause de 1,2 seconde ; attendez le message de
          sauvegarde avant de fermer. Effacer les données de l’application ou du
          navigateur supprime aussi ces copies.
        </small>
        {message && (
          <p className="project-message" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
