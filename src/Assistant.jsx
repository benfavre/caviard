import React, { useEffect, useRef, useState } from "react";
import { LocalAI } from "./ai/client.mjs";
import { analyzeDocument } from "./ai/analyze.mjs";
import { CATEGORIES, POLICIES, regionKey } from "./ai/core.mjs";
const categoryName = (c) => CATEGORIES[c] || "Texte demandé";
export default function Assistant({
  doc,
  page,
  marks,
  disabled,
  onBusy,
  onApply,
  onPreview,
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("review");
  const [model, setModel] = useState(null),
    [policy, setPolicy] = useState("contact");
  const [categories, setCategories] = useState(POLICIES.contact.categories),
    [instruction, setInstruction] = useState(""),
    [plan, setPlan] = useState(null);
  const [ocr, setOcr] = useState(true),
    [scope, setScope] = useState("document");
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  const [result, setResult] = useState(null),
    [selected, setSelected] = useState(new Set()),
    [limit, setLimit] = useState(50);
  const ai = useRef(null),
    abort = useRef(null),
    ocrWorker = useRef(null),
    mounted = useRef(true);
  const bridge = window.caviardDesktop;
  useEffect(() => {
    mounted.current = true;
    ai.current = new LocalAI();
    bridge
      ?.models?.()
      .then((s) => {
        if (mounted.current) setModel(s);
      })
      .catch(() => setError("État des modèles indisponible."));
    const off = bridge?.onModels?.(setModel);
    return () => {
      mounted.current = false;
      off?.();
      abort.current?.abort();
      ai.current?.stop();
      ocrWorker.current?.terminate();
      onBusy(false);
    };
  }, []);
  function cancel() {
    abort.current?.abort();
    ai.current.stop();
    ocrWorker.current?.terminate();
  }
  async function task(fn) {
    setError("");
    setRunning(true);
    onBusy(true);
    abort.current = new AbortController();
    try {
      await fn(abort.current.signal);
    } catch (e) {
      if (mounted.current)
        setError(
          abort.current.signal.aborted
            ? "Analyse annulée. Aucune nouvelle zone ajoutée."
            : e.message,
        );
    } finally {
      if (mounted.current) {
        setRunning(false);
        setProgress("");
        onBusy(false);
      }
    }
  }
  function apply(suggestions) {
    const existing = new Set(marks.map(regionKey)),
      regions = [];
    for (const suggestion of suggestions)
      for (const r of suggestion.regions) {
        const key = regionKey(r);
        if (!existing.has(key)) {
          existing.add(key);
          regions.push({ ...r, id: crypto.randomUUID() });
        }
      }
    if (regions.length) {
      onApply(regions);
      onPreview(suggestions[0]?.page, []);
    }
  }
  async function analyze(automatic = false) {
    const chosen =
      mode === "instruction"
        ? plan
        : {
            categories:
              mode === "policy" ? POLICIES[policy].categories : categories,
            literals: [],
            exclude: [],
          };
    if (!chosen) return;
    setResult(null);
    setSelected(new Set());
    onPreview(null, []);
    await task(async (signal) => {
      const result = await analyzeDocument(doc.pdf, chosen, ai.current, {
        signal,
        onProgress: setProgress,
        ocr,
        currentPage: scope === "page" ? page : null,
        onOcrWorker: (w) => {
          ocrWorker.current = w;
        },
      });
      signal.throwIfAborted();
      if (!mounted.current) return;
      setResult(result);
      setLimit(50);
      setSelected(new Set(result.suggestions.map((s) => s.id)));
      if (automatic) apply(result.suggestions);
    });
  }
  const ready = model?.phase === "ready";
  const selectedSuggestions =
    result?.suggestions.filter((s) => selected.has(s.id)) || [];
  const existing = new Set(marks.map(regionKey));
  const remaining = selectedSuggestions.some((s) =>
    s.regions.some((r) => !existing.has(regionKey(r))),
  );
  return (
    <section className="assistant" aria-label="Assistant local">
      <button
        className="assistant-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={running}
      >
        <span className="assistant-spark">✦</span>
        <strong>Assistant local</strong>
        <span>Détecter · Automatiser · Donner une instruction</span>
        <b>{open ? "−" : "+"}</b>
      </button>
      {open && (
        <div className="assistant-content">
          <p className="assistant-intro">
            Préparez les caviardages sur votre appareil. Vérifiez chaque page
            avant d’exporter : le modèle et l’OCR peuvent manquer des
            informations.
          </p>
          {!bridge?.models ? (
            <p className="ai-notice">
              L’assistant est disponible dans l’application de bureau Inklura
              PDF. Le caviardage manuel reste disponible ici.
            </p>
          ) : (
            <>
              {!ready && (
                <div className="model-install">
                  <div>
                    <strong>Activer les modèles locaux</strong>
                    <p>
                      Un téléchargement initial de{" "}
                      {model ? Math.ceil(model.total / 1e6) : 1400} Mo depuis
                      Hugging Face et GitHub. Vos PDF et instructions ne sont
                      jamais envoyés. Ensuite, l’analyse fonctionne hors ligne.
                      Prévoyez 8 Go de mémoire vive.
                    </p>
                  </div>
                  {model?.phase === "downloading" ? (
                    <>
                      <progress max={model.total} value={model.received} />
                      <span>
                        {Math.round((model.received / model.total) * 100)} %
                      </span>
                      <button onClick={() => bridge.cancelModels()}>
                        Annuler le téléchargement
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary"
                      disabled={!model}
                      onClick={() =>
                        bridge
                          .installModels()
                          .catch(() =>
                            setError("Téléchargement indisponible. Réessayez."),
                          )
                      }
                    >
                      Installer les modèles
                    </button>
                  )}
                  {model?.message && <p role="status">{model.message}</p>}
                </div>
              )}
              <div
                className="assistant-tabs"
                role="tablist"
                aria-label="Mode de l’assistant"
              >
                {[
                  ["review", "Suggestions"],
                  ["policy", "Politique automatique"],
                  ["instruction", "Instruction libre"],
                ].map(([id, title]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={mode === id}
                    disabled={running || disabled}
                    onClick={() => {
                      setMode(id);
                      setPlan(null);
                      setError("");
                    }}
                  >
                    {title}
                  </button>
                ))}
              </div>
              <div className="assistant-config">
                {mode === "review" && (
                  <fieldset disabled={running || disabled}>
                    <legend>Informations à rechercher</legend>
                    <div className="category-options">
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
                    </div>
                  </fieldset>
                )}
                {mode === "policy" && (
                  <label className="policy-select">
                    Politique à appliquer
                    <select
                      value={policy}
                      disabled={running || disabled}
                      onChange={(e) => setPolicy(e.target.value)}
                    >
                      {Object.entries(POLICIES).map(([id, p]) => (
                        <option key={id} value={id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <small>
                      {POLICIES[policy].categories
                        .map(categoryName)
                        .join(" · ")}
                      . Les zones seront ajoutées automatiquement à l’aperçu ;
                      l’export reste une action séparée.
                    </small>
                  </label>
                )}
                {mode === "instruction" && (
                  <div className="instruction-input">
                    <label htmlFor="ai-instruction">
                      Que souhaitez-vous masquer ?
                    </label>
                    <textarea
                      id="ai-instruction"
                      value={instruction}
                      maxLength={1000}
                      disabled={running || disabled}
                      placeholder="Masque tous les noms et les adresses e-mail."
                      onChange={(e) => {
                        setInstruction(e.target.value);
                        setPlan(null);
                      }}
                    />
                    <small>
                      Décrivez les catégories à masquer. Pour un texte exact,
                      utilisez « des guillemets » ; pour une exception, écrivez
                      sauf « Inklura ».
                    </small>
                    <button
                      disabled={
                        !ready || running || disabled || !instruction.trim()
                      }
                      onClick={() =>
                        task(async (signal) => {
                          setProgress(
                            "Interprétation de votre instruction sur cet appareil…",
                          );
                          const plan = await ai.current.request("plan", {
                            instruction,
                          });
                          signal.throwIfAborted();
                          setPlan(plan);
                        })
                      }
                    >
                      Préparer le plan
                    </button>
                    {plan && (
                      <div className="instruction-plan">
                        <strong>Plan proposé — à vérifier</strong>
                        <div className="category-options">
                          {Object.entries(CATEGORIES).map(([id, label]) => (
                            <label key={id}>
                              <input
                                type="checkbox"
                                checked={plan.categories.includes(id)}
                                disabled={running}
                                onChange={(e) =>
                                  setPlan({
                                    ...plan,
                                    categories: e.target.checked
                                      ? [...plan.categories, id]
                                      : plan.categories.filter((c) => c !== id),
                                  })
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        {plan.literals.length > 0 && (
                          <p>Textes exacts : {plan.literals.join(", ")}.</p>
                        )}
                        {plan.exclude.length > 0 && (
                          <p>Conserver : {plan.exclude.join(", ")}.</p>
                        )}
                        <small>
                          Ce plan s’applique à toutes les occurrences dans la
                          portée choisie, sans distinguer clients, salariés ou
                          fournisseurs. Reformulez si nécessaire.
                        </small>
                      </div>
                    )}
                  </div>
                )}
                <div className="analysis-options">
                  <label>
                    Portée
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      disabled={running || disabled}
                    >
                      <option value="document">
                        Document courant ({doc.pdf.numPages} pages)
                      </option>
                      <option value="page">Page courante ({page})</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={ocr}
                      disabled={running || disabled}
                      onChange={(e) => setOcr(e.target.checked)}
                    />
                    Analyser aussi les images (OCR français / anglais)
                  </label>
                </div>
                <div className="assistant-actions">
                  <button
                    className="primary"
                    disabled={
                      !ready ||
                      running ||
                      disabled ||
                      (mode === "review" && !categories.length) ||
                      (mode === "instruction" &&
                        (!plan ||
                          (!plan.categories.length && !plan.literals.length)))
                    }
                    onClick={() => analyze(mode === "policy")}
                  >
                    {mode === "policy"
                      ? "Appliquer la politique et prévisualiser"
                      : "Rechercher les informations"}
                  </button>
                  {ready && <small>Modèles installés · traitement local</small>}
                </div>
              </div>
              {running && (
                <div className="ai-progress" role="status">
                  <span>{progress || "Chargement du modèle local…"}</span>
                  <button onClick={cancel}>Annuler l’analyse</button>
                </div>
              )}
              {error && (
                <p className="ai-error" role="alert">
                  {error}
                </p>
              )}
              {result && (
                <div className="assistant-results">
                  <div className="results-heading">
                    <strong>
                      {result.suggestions.length} suggestion
                      {result.suggestions.length > 1 ? "s" : ""} ·{" "}
                      {result.coverage.length} page
                      {result.coverage.length > 1 ? "s" : ""} analysée
                      {result.coverage.length > 1 ? "s" : ""}
                    </strong>
                    <button
                      disabled={!remaining || running || disabled}
                      onClick={() => apply(selectedSuggestions)}
                    >
                      Ajouter la sélection à l’aperçu
                    </button>
                  </div>
                  <p>
                    Les zones bleues sont des propositions ; seules les zones
                    noires seront exportées. Certaines zones couvrent une ligne
                    entière. Vous pouvez annuler l’ajout avec Ctrl/Cmd+Z.
                  </p>
                  {!!result.warnings.length && (
                    <details className="ai-warnings" open>
                      <summary>
                        {result.warnings.length} point
                        {result.warnings.length > 1 ? "s" : ""} à vérifier
                      </summary>
                      <ul>
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {!result.suggestions.length ? (
                    <p>
                      Aucune information reconnue pour ces catégories. Cela ne
                      garantit pas l’absence de données sensibles.
                    </p>
                  ) : (
                    <>
                      <label className="select-all">
                        <input
                          type="checkbox"
                          checked={selected.size === result.suggestions.length}
                          onChange={(e) =>
                            setSelected(
                              new Set(
                                e.target.checked
                                  ? result.suggestions.map((s) => s.id)
                                  : [],
                              ),
                            )
                          }
                        />
                        Tout sélectionner
                      </label>
                      <div className="suggestion-list">
                        {result.suggestions.slice(0, limit).map((s) => (
                          <div className="suggestion" key={s.id}>
                            <input
                              type="checkbox"
                              aria-label={`Sélectionner ${s.text}`}
                              checked={selected.has(s.id)}
                              onChange={(e) =>
                                setSelected((old) => {
                                  const next = new Set(old);
                                  e.target.checked
                                    ? next.add(s.id)
                                    : next.delete(s.id);
                                  return next;
                                })
                              }
                            />
                            <button
                              onClick={() => onPreview(s.page, s.regions)}
                            >
                              <span>{s.text}</span>
                              <small>
                                Page {s.page} · {categoryName(s.category)} ·{" "}
                                {s.source === "model"
                                  ? "Modèle local"
                                  : s.source === "ocr"
                                    ? "OCR"
                                    : s.source === "literal"
                                      ? "Texte demandé"
                                      : "Format reconnu"}
                              </small>
                            </button>
                          </div>
                        ))}
                      </div>
                      {limit < result.suggestions.length && (
                        <button onClick={() => setLimit(limit + 50)}>
                          Afficher les suivantes
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
