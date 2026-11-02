import React, { useEffect, useRef, useState } from "react";
import { LocalAI } from "./ai/client.mjs";
import { OvhAI } from "./ai/ovh-client.mjs";
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
  onProviderChange = () => {},
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("review");
  const [provider, setProvider] = useState("local"),
    [ovh, setOvh] = useState(null),
    [consent, setConsent] = useState(false);
  const [ownOvh, setOwnOvh] = useState(null),
    [apiKey, setApiKey] = useState(""),
    [ownModel, setOwnModel] = useState("mistral@latest"),
    [configuring, setConfiguring] = useState(false);
  const cloud = provider !== "local", ownKey = provider === "ovh-own";
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
    onProviderChange(false);
    bridge?.ovhState?.().then((state) => {
      if (mounted.current) setOvh(state);
    }).catch(() => setError("Configuration OVHcloud indisponible."));
    bridge?.ownOvhState?.().then(state => { if (mounted.current) { setOwnOvh(state); setOwnModel(state.model); } }).catch(() => {});
    bridge
      ?.models?.()
      .then((s) => {
        if (mounted.current) setModel(s);
      })
      .catch(() => setError("État des modèles indisponible."));
    const off = bridge?.onModels?.(setModel);
    const offAccount = bridge?.onAccount?.(() => bridge.ovhState().then(state => {
      if (mounted.current) { setOvh(state); if (!state.signedIn) setConsent(false); }
    }).catch(() => {}));
    return () => {
      mounted.current = false;
      off?.();
      offAccount?.();
      abort.current?.abort();
      ai.current?.stop();
      bridge?.ovhCancel?.().catch(() => {});
      bridge?.ownOvhCancel?.().catch(() => {});
      ocrWorker.current?.terminate();
      onBusy(false);
    };
  }, []);
  function cancel() {
    abort.current?.abort();
    ai.current.stop();
    bridge?.ovhCancel?.().catch(() => {});
    bridge?.ownOvhCancel?.().catch(() => {});
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
    if (!ready || running || disabled || (ocr && !localReady)) return;
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
      const engine = cloud ? new OvhAI(bridge, ownKey) : ai.current;
      const result = await analyzeDocument(doc.pdf, chosen, engine, {
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
      if (automatic && provider === "local") apply(result.suggestions);
    });
  }
  const localReady = model?.phase === "ready";
  const ready = provider === "local" ? localReady
    : ownKey ? ownOvh?.configured && consent && !apiKey && ownModel === ownOvh.model && !configuring
    : ovh?.enabled && ovh?.signedIn && ovh.remaining > 0 && consent;
  async function configureOwnKey(clear = false) {
    setConfiguring(true); setError(""); setConsent(false);
    try {
      const state = clear ? await bridge.ownOvhClear()
        : await bridge.ownOvhConfigure({ ...(apiKey ? { apiKey: apiKey.trim() } : {}), model: ownModel.trim() });
      if (mounted.current) { setOwnOvh(state); setOwnModel(state.model); setApiKey(""); }
    } catch { if (mounted.current) setError("Configuration OVHcloud refusée. Vérifiez la clé et le modèle."); }
    finally { if (mounted.current) setConfiguring(false); }
  }
  const selectedSuggestions =
    result?.suggestions.filter((s) => selected.has(s.id)) || [];
  const existing = new Set(marks.map(regionKey));
  const remaining = selectedSuggestions.some((s) =>
    s.regions.some((r) => !existing.has(regionKey(r))),
  );
  return (
    <section className="assistant" aria-label={cloud ? "Assistant OVHcloud" : "Assistant local"}>
      <button
        className="assistant-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={running}
      >
        <span className="assistant-spark">✦</span>
        <strong>{cloud ? "Assistant OVHcloud" : "Assistant local"}</strong>
        <span>Détecter · Automatiser · Donner une instruction</span>
        <b>{open ? "−" : "+"}</b>
      </button>
      {open && (
        <div className="assistant-content">
          <p className="assistant-intro">
            Préparez les caviardages avec le moteur de votre choix. Vérifiez chaque page
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
              {bridge?.ovhState && (
                <div className="ai-provider">
                  <label>
                    Moteur de l’assistant
                    <select value={provider} disabled={running || disabled || configuring}
                      onChange={(event) => {
                        const next = event.target.value;
                        setProvider(next); onProviderChange(next !== "local");
                        setConsent(false); setResult(null); setPlan(null); setError("");
                        setSelected(new Set()); onPreview(null, []);
                        if (next !== "local" && !localReady) setOcr(false);
                      }}>
                      <option value="local">Local · hors ligne</option>
                      <option value="ovh">OVHcloud · crédits IA Inklura</option>
                      <option value="ovh-own">OVHcloud · ma propre clé</option>
                    </select>
                  </label>
                  {cloud && (
                    <div className="ovh-settings">
                      {ownKey ? <>
                        <p>Votre texte et vos instructions sont envoyés directement à OVHcloud avec votre clé. L’usage IA est facturé par OVHcloud sur votre compte ; aucun crédit Inklura pour l’analyse. L’export PDF reste à un crédit.</p>
                        <label>Clé API OVHcloud AI Endpoints<input type="password" value={apiKey} autoComplete="off" spellCheck={false} disabled={running || disabled || configuring} placeholder={ownOvh?.configured ? "Clé chargée pour cette session" : "Votre clé API"} onChange={event => { setApiKey(event.target.value); setConsent(false); }} /></label>
                        <label>Modèle Mistral<input value={ownModel} maxLength={160} spellCheck={false} disabled={running || disabled || configuring} onChange={event => { setOwnModel(event.target.value); setConsent(false); setPlan(null); setResult(null); }} /></label>
                        <small>Clé uniquement en mémoire, effacée à la fermeture. Elle n’est pas transmise à Inklura. Le modèle par défaut suit le catalogue OVHcloud.</small>
                        <div className="ovh-settings-actions">
                          <button disabled={running || disabled || configuring || (!apiKey.trim() && !ownOvh?.configured)} onClick={() => configureOwnKey()}>Utiliser pour cette session</button>
                          {ownOvh?.configured && <button disabled={running || disabled || configuring} onClick={() => configureOwnKey(true)}>Oublier la clé</button>}
                        </div>
                      </> : <>
                      <p>10 analyses IA offertes à votre compte, puis 1 crédit IA par analyse de document terminée. La préparation du plan est incluse. L’export PDF utilise séparément 1 crédit PDF.</p>
                      <p>Le texte extrait dans la portée choisie et vos instructions sont transmis au service Inklura, puis à OVHcloud. Les PDF, images et noms de fichiers restent sur votre appareil.</p>
                      {!ovh?.enabled ? <p role="status">L’assistant OVHcloud n’est pas encore activé sur le service Inklura.</p>
                        : !ovh?.signedIn ? <p>Connectez-vous à Inklura avec le bouton en haut de l’application.</p>
                        : ovh.remaining < 1 ? <p>Votre solde IA est épuisé. Achetez des crédits IA ou choisissez « ma propre clé ». Vos crédits PDF restent disponibles pour l’export.</p>
                        : <small>Modèle : {ovh.model} · {ovh.remaining} crédit(s) IA disponible(s)</small>}
                      <p>100 crédits IA : 5 € HT (6 € TTC), valables 12 mois. Une analyse peut couvrir jusqu’à 60 000 caractères, OCR compris. Les erreurs du service libèrent le crédit réservé.</p>
                      <button disabled={running || disabled} onClick={() => window.dispatchEvent(new CustomEvent("inklura:buy-ai"))}>Acheter des crédits IA · 6 € TTC</button>
                      <small>Usage quotidien limité à {ovh?.dailyCalls || 500} requêtes et {((ovh?.dailyCharacters || 500000) / 1000).toLocaleString("fr-FR")} 000 caractères par compte. Une page peut nécessiter plusieurs requêtes.</small>
                      </>}
                      <label className="ovh-consent">
                        <input type="checkbox" checked={consent} disabled={running || disabled || configuring}
                          onChange={(event) => setConsent(event.target.checked)} />
                        <span>J’autorise l’envoi à {ownKey ? "OVHcloud" : "Inklura et OVHcloud"} du texte de « {doc.name} » dans la portée choisie et de mes instructions, quand je lance une demande.</span>
                      </label>
                      {!localReady && <p>L’analyse du texte fonctionne sans modèles locaux. Pour analyser les scans et images, installez les modèles depuis le mode Local, puis activez l’OCR.</p>}
                    </div>
                  )}
                </div>
              )}
              {provider === "local" && !localReady && (
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
                      . {cloud ? "Relisez les suggestions avant de les ajouter à l’aperçu." : "Les zones seront ajoutées automatiquement à l’aperçu ; l’export reste une action séparée."}
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
                            cloud ? "Interprétation de votre instruction par OVHcloud…" : "Interprétation de votre instruction sur cet appareil…",
                          );
                          const engine = cloud ? new OvhAI(bridge, ownKey) : ai.current;
                          const plan = await engine.request("plan", {
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
                      disabled={running || disabled || (cloud && !localReady)}
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
                      (ocr && !localReady) ||
                      running ||
                      disabled ||
                      (mode === "review" && !categories.length) ||
                      (mode === "instruction" &&
                        (!plan ||
                          (!plan.categories.length && !plan.literals.length)))
                    }
                    onClick={() => analyze(mode === "policy")}
                  >
                    {mode === "policy" && provider === "local"
                      ? "Appliquer la politique et prévisualiser"
                      : "Rechercher les informations"}
                  </button>
                  {ready && <small>{cloud ? "Texte transmis à OVHcloud · suggestions à vérifier" : "Modèles installés · traitement local"}</small>}
                </div>
              </div>
              {running && (
                <div className="ai-progress" role="status">
                  <span>{progress || (cloud ? "Demande à OVHcloud…" : "Chargement du modèle local…")}</span>
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
                                  : s.source === "ovh"
                                    ? "Mistral · OVHcloud"
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
