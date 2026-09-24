import React, { useEffect, useRef, useState } from "react";
import { analyzeDocument } from "./ai/analyze.mjs";
import { LocalAI } from "./ai/client.mjs";
import { CATEGORIES, POLICIES, regionKey } from "./ai/core.mjs";
import { readProfiles, writeProfiles, validateProfile } from "./profiles.mjs";
export default function WorkspaceTools({
  documents,
  current,
  disabled,
  marks,
  onBusy,
  onPreview,
  onApply,
}) {
  const modal = useRef(null),
    controller = useRef(null),
    ai = useRef(null);
  const [tab, setTab] = useState("find"),
    [query, setQuery] = useState(""),
    [scope, setScope] = useState("all");
  const [profiles, setProfiles] = useState([]),
    [profileId, setProfileId] = useState("");
  const [name, setName] = useState(""),
    [categories, setCategories] = useState([]),
    [literals, setLiterals] = useState(""),
    [exclude, setExclude] = useState("");
  const [ocr, setOcr] = useState(false),
    [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false),
    [message, setMessage] = useState(""),
    [results, setResults] = useState([]),
    [selected, setSelected] = useState(new Set()),
    [limit, setLimit] = useState(100);
  useEffect(() => {
    try {
      setProfiles(readProfiles());
    } catch {
      setMessage("Les profils enregistrés n’ont pas pu être chargés.");
    }
    window.caviardDesktop
      ?.models?.()
      .then((s) => setReady(s.phase === "ready"))
      .catch(() => {});
    const off = window.caviardDesktop?.onModels?.((s) =>
      setReady(s.phase === "ready"),
    );
    return () => {
      off?.();
      controller.current?.abort();
      ai.current?.stop();
    };
  }, []);
  const lines = (text) =>
    text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  function choose(id) {
    setProfileId(id.startsWith("builtin:") ? "" : id);
    const p = id.startsWith("builtin:")
      ? { ...POLICIES[id.slice(8)], literals: [], exclude: [] }
      : profiles.find((p) => p.id === id);
    if (p) {
      setName(p.name);
      setCategories(p.categories);
      setLiterals(p.literals.join("\n"));
      setExclude(p.exclude.join("\n"));
    }
  }
  async function search() {
    let plan;
    try {
      plan =
        tab === "find"
          ? { categories: [], literals: [query.trim()], exclude: [] }
          : validateProfile({
              name: name || "Recherche",
              categories,
              literals: lines(literals),
              exclude: lines(exclude),
            });
    } catch (e) {
      setMessage(e.message);
      return;
    }
    if (!plan.literals.length && !plan.categories.length) return;
    const needsModels =
      ocr ||
      plan.categories.some((c) =>
        ["person", "address", "organization"].includes(c),
      );
    if (needsModels && !ready) {
      setMessage(
        "Installez les modèles depuis l’assistant local pour ces catégories ou l’OCR.",
      );
      return;
    }
    const targets =
      scope === "all"
        ? documents
        : documents.filter((d) => d.id === current.id);
    setRunning(true);
    onBusy(true);
    setResults([]);
    setSelected(new Set());
    controller.current = new AbortController();
    ai.current = new LocalAI();
    const found = [],
      warnings = [];
    try {
      for (const doc of targets) {
        const result = await analyzeDocument(doc.pdf, plan, ai.current, {
          signal: controller.current.signal,
          ocr,
          onProgress: (text) =>
            setMessage(`${doc.relativePath || doc.name} — ${text}`),
        });
        found.push(
          ...result.suggestions.map((s) => ({
            ...s,
            docId: doc.id,
            filename: doc.relativePath || doc.name,
          })),
        );
        warnings.push(...result.warnings.map((w) => `${doc.name} : ${w}`));
        if (found.length > 5000)
          throw new Error(
            "Plus de 5 000 résultats. Limitez la recherche au document courant.",
          );
      }
      controller.current.signal.throwIfAborted();
      setResults(found);
      setSelected(new Set(found.map((s) => s.id)));
      setLimit(100);
      setMessage(
        `${found.length} résultat(s). ${warnings.length ? `${warnings.length} avertissement(s) : ${warnings.slice(0, 3).join(" ")}` : "Vérifiez chaque zone avant de l’ajouter."}`,
      );
    } catch (e) {
      setMessage(
        controller.current.signal.aborted
          ? "Recherche annulée. Aucune zone ajoutée."
          : e.message,
      );
    } finally {
      ai.current.stop();
      setRunning(false);
      onBusy(false);
    }
  }
  function apply() {
    const groups = {},
      seen = new Map(
        documents.map((d) => [
          d.id,
          new Set((marks[d.id] || []).map(regionKey)),
        ]),
      );
    for (const result of results)
      if (selected.has(result.id) && seen.has(result.docId))
        for (const region of result.regions) {
          const key = regionKey(region);
          if (!seen.get(result.docId).has(key)) {
            seen.get(result.docId).add(key);
            (groups[result.docId] ||= []).push({
              ...region,
              id: crypto.randomUUID(),
            });
          }
        }
    onApply(groups);
    modal.current.close();
  }
  const locked = running || disabled;
  return (
    <>
      <button disabled={disabled} onClick={() => modal.current.showModal()}>
        Rechercher et profils
      </button>
      <dialog
        ref={modal}
        className="workspace-dialog search-dialog"
        onCancel={(e) => {
          if (running) e.preventDefault();
        }}
      >
        <h2>Rechercher et caviarder</h2>
        <div className="dialog-actions">
          <button
            disabled={running}
            onClick={() => setTab("find")}
            aria-pressed={tab === "find"}
          >
            Texte exact
          </button>
          <button
            disabled={running}
            onClick={() => setTab("profiles")}
            aria-pressed={tab === "profiles"}
          >
            Profils réutilisables
          </button>
          <button disabled={running} onClick={() => modal.current.close()}>
            Fermer
          </button>
        </div>
        {tab === "find" ? (
          <label>
            Texte à masquer
            <input
              type="search"
              maxLength={160}
              value={query}
              disabled={locked}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        ) : (
          <div className="profile-editor">
            <label>
              Charger un profil
              <select
                disabled={locked}
                value={profileId}
                onChange={(e) => choose(e.target.value)}
              >
                <option value="">Nouveau profil</option>
                {Object.entries(POLICIES).map(([id, p]) => (
                  <option key={id} value={`builtin:${id}`}>
                    {p.name} (prédéfini)
                  </option>
                ))}
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nom du profil
              <input
                value={name}
                maxLength={100}
                disabled={locked}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <fieldset disabled={locked}>
              <legend>Catégories à masquer</legend>
              {Object.entries(CATEGORIES).map(([id, label]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={categories.includes(id)}
                    onChange={(e) =>
                      setCategories(
                        e.target.checked
                          ? [...categories, id]
                          : categories.filter((c) => c !== id),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              Expressions à masquer (une par ligne)
              <textarea
                value={literals}
                disabled={locked}
                onChange={(e) => setLiterals(e.target.value)}
                maxLength={3400}
              />
            </label>
            <label>
              Expressions à conserver (une par ligne)
              <textarea
                value={exclude}
                disabled={locked}
                onChange={(e) => setExclude(e.target.value)}
                maxLength={3400}
              />
            </label>
            <p>
              Les profils sont conservés sur cet appareil. Les exceptions qui
              partagent une zone avec un résultat peuvent nécessiter une
              vérification manuelle.
            </p>
            <button
              disabled={locked}
              onClick={() => {
                try {
                  const p = validateProfile({
                    id: profileId || crypto.randomUUID(),
                    name,
                    categories,
                    literals: lines(literals),
                    exclude: lines(exclude),
                  });
                  const next = [...profiles.filter((x) => x.id !== p.id), p];
                  writeProfiles(next);
                  setProfiles(next);
                  setProfileId(p.id);
                  setMessage("Profil enregistré.");
                } catch (e) {
                  setMessage(e.message);
                }
              }}
            >
              Enregistrer le profil
            </button>
            <button
              disabled={locked || !profileId}
              onClick={() => {
                try {
                  const next = profiles.filter((p) => p.id !== profileId);
                  writeProfiles(next);
                  setProfiles(next);
                  setProfileId("");
                  setMessage("Profil supprimé.");
                } catch (e) {
                  setMessage(e.message);
                }
              }}
            >
              Supprimer le profil
            </button>
          </div>
        )}
        <label>
          Portée de la recherche
          <select
            value={scope}
            disabled={locked}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">Tous les documents ({documents.length})</option>
            <option value="current">Document courant</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={ocr}
            disabled={locked}
            onChange={(e) => setOcr(e.target.checked)}
          />
          Inclure les scans et images (OCR local)
        </label>
        <p>
          La recherche de texte ignore la casse. Sans OCR, les images ne sont
          pas analysées. Une zone peut couvrir une ligne entière : prévisualisez
          les résultats.
        </p>
        <button
          className="primary"
          disabled={locked || (tab === "find" && !query.trim())}
          onClick={search}
        >
          Lancer la recherche
        </button>
        {running && (
          <button
            onClick={() => {
              controller.current.abort();
              ai.current.stop();
            }}
          >
            Annuler la recherche
          </button>
        )}
        {message && <p aria-live="polite">{message}</p>}
        {!!results.length && (
          <>
            <div className="dialog-actions">
              <button
                disabled={locked}
                onClick={() => setSelected(new Set(results.map((s) => s.id)))}
              >
                Tout sélectionner
              </button>
              <button disabled={locked} onClick={() => setSelected(new Set())}>
                Tout désélectionner
              </button>
              <button
                className="primary"
                disabled={locked || !selected.size}
                onClick={apply}
              >
                Ajouter {selected.size} résultat(s) aux zones
              </button>
            </div>
            <ul className="search-results">
              {results.slice(0, limit).map((s) => (
                <li key={s.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      disabled={locked}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(s.id) : next.delete(s.id);
                          return next;
                        })
                      }
                    />
                    <span>
                      {s.text}
                      <small>
                        {s.filename} · page {s.page}
                      </small>
                    </span>
                  </label>
                  <button
                    disabled={locked}
                    onClick={() => {
                      onPreview(s.docId, s.page, s.regions);
                      modal.current.close();
                    }}
                  >
                    Voir la zone
                  </button>
                </li>
              ))}
            </ul>
            {limit < results.length && (
              <button onClick={() => setLimit(limit + 100)}>
                Afficher 100 résultats supplémentaires
              </button>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
