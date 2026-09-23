import React, { useEffect, useRef, useState, useReducer } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  faShieldHalved,
  faPenRuler,
  faTriangleExclamation,
  faFilePdf,
  faXmark,
  faChevronLeft,
  faChevronRight,
  faRotateLeft,
  faRotateRight,
  faTrashCan,
  faDownload,
  faPlus,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faCircleQuestion,
  faArrowUpRightFromSquare,
  faCheck,
  faLock,
  faExpand,
} from "@fortawesome/free-solid-svg-icons";
import "@fontsource-variable/inter";
import { emptyHistory, redactionHistory } from "./history.mjs";
import AccountStatus from "./AccountStatus.jsx";
import { exportRedacted, normalizeRect } from "./pdf.mjs";
import "./styles.css";
import DesktopStatus from "./DesktopStatus.jsx";
import Assistant from "./Assistant.jsx";
document.title = "Inklura PDF — Caviardage";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
// Load the worker with the page so local files can also be opened offline.
const sharedWorker = new pdfjs.PDFWorker();
sharedWorker.promise.catch(() => {});
if (import.meta.hot) import.meta.hot.dispose(() => sharedWorker.destroy());
const Icon = ({ icon, className = "" }) => (
  <svg
    aria-hidden="true"
    className={`icon ${className}`}
    viewBox={`0 0 ${icon.icon[0]} ${icon.icon[1]}`}
    fill="currentColor"
  >
    <path d={icon.icon[4]} />
  </svg>
);
function Page({
  pdf,
  number,
  marks,
  preview = [],
  addMark,
  removeMark,
  zoom,
  busy,
  onError,
}) {
  const canvas = useRef(null);
  const start = useRef(null);
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 595, height: 842 });
  useEffect(() => {
    let cancelled = false,
      task;
    setReady(false);
    (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const natural = page.getViewport({ scale: 1 });
      setSize({ width: natural.width, height: natural.height });
      const viewport = page.getViewport({
        scale: Math.min(1.6, 4096 / Math.max(natural.width, natural.height)),
      });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      task = page.render({
        canvasContext: canvas.current.getContext("2d"),
        viewport,
      });
      await task.promise;
      if (!cancelled) setReady(true);
    })().catch((error) => {
      if (!cancelled && error.name !== "RenderingCancelledException")
        onError("Impossible d’afficher cette page du PDF.");
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, number]);
  const point = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };
  const finish = (event) => {
    if (!start.current) return;
    const rect = normalizeRect(start.current, point(event));
    if (rect.width * size.width > 2 && rect.height * size.height > 2)
      addMark({ ...rect, page: number, id: crypto.randomUUID() });
    start.current = null;
    setDraft(null);
  };
  return (
    <div
      className="page-wrap"
      style={{
        width: `calc(min(100%, ${Math.min(size.width, 850)}px) * ${zoom})`,
      }}
    >
      <div
        className="pdf-page"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        <canvas ref={canvas} />
        {!ready && <div className="page-loading">Chargement de la page…</div>}
        {ready && (
          <div
            className={`drawing-layer ${busy ? "disabled" : ""}`}
            aria-label="Dessinez un rectangle sur la page pour caviarder une zone"
            onPointerDown={(event) => {
              if (busy || event.button !== 0 || event.target.closest("button"))
                return;
              event.preventDefault();
              start.current = point(event);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (start.current)
                setDraft(normalizeRect(start.current, point(event)));
            }}
            onPointerUp={finish}
            onPointerCancel={() => {
              start.current = null;
              setDraft(null);
            }}
          >
            {marks
              .filter((mark) => mark.page === number)
              .map((mark) => (
                <div
                  key={mark.id}
                  className="redaction"
                  style={{
                    left: `${mark.x * 100}%`,
                    top: `${mark.y * 100}%`,
                    width: `${mark.width * 100}%`,
                    height: `${mark.height * 100}%`,
                  }}
                >
                  <button
                    disabled={busy}
                    title="Supprimer cette zone"
                    aria-label="Supprimer cette zone"
                    onClick={() => removeMark(mark.id)}
                  >
                    <Icon icon={faXmark} />
                  </button>
                </div>
              ))}
            {preview
              .filter((r) => r.page === number)
              .map((r, i) => (
                <div
                  key={i}
                  className="ai-region"
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.width * 100}%`,
                    height: `${r.height * 100}%`,
                  }}
                />
              ))}
            {draft && (
              <div
                className="redaction draft"
                style={{
                  left: `${draft.x * 100}%`,
                  top: `${draft.y * 100}%`,
                  width: `${draft.width * 100}%`,
                  height: `${draft.height * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function App() {
  const [workerReady, setWorkerReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    sharedWorker.promise.then(
      () => {
        if (mounted) setWorkerReady(true);
      },
      () => {
        if (mounted)
          setError(
            "Le moteur PDF n’a pas pu être chargé. Rechargez la page avec une connexion Internet.",
          );
      },
    );
    return () => {
      mounted = false;
    };
  }, []);
  const [documents, setDocuments] = useState([]),
    [active, setActive] = useState(0),
    [page, setPage] = useState(1);
  const [aiBusy, setAiBusy] = useState(false);
  const [preview, setPreview] = useState([]);
  const [savedMarks, setSavedMarks] = useState({});
  const [history, dispatch] = useReducer(redactionHistory, emptyHistory);
  const marks = history.marks;
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dragging, setDragging] = useState(false);
  const input = useRef(null),
    help = useRef(null),
    privacy = useRef(null),
    discard = useRef(null),
    docsRef = useRef([]);
  const [pendingClose, setPendingClose] = useState(null);
  const current = documents[active];
  useEffect(() => setPreview([]), [current?.id]);
  const currentMarks = current ? marks[current.id] || [] : [];
  const count = documents.reduce(
    (total, doc) => total + (marks[doc.id]?.length || 0),
    0,
  );
  useEffect(() => {
    docsRef.current = documents;
  }, [documents]);
  useEffect(
    () => () => {
      docsRef.current.forEach((doc) => doc.task.destroy());
    },
    [],
  );
  async function openFiles(files) {
    if (loading || busy || aiBusy || !workerReady || !files?.length) return;
    setError("");
    setNotice("");
    setLoading(true);
    const added = [],
      errors = [];
    for (const file of files) {
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
        errors.push(`${file.name} : choisissez un fichier PDF.`);
        continue;
      }
      let task;
      try {
        task = pdfjs.getDocument({
          worker: sharedWorker,
          data: new Uint8Array(await file.arrayBuffer()),
          isEvalSupported: false,
        });
        const pdf = await task.promise;
        added.push({ id: crypto.randomUUID(), name: file.name, pdf, task });
      } catch (e) {
        await task?.destroy();
        errors.push(
          `${file.name} : ${e.name === "PasswordException" ? "ce PDF est protégé par un mot de passe. Déverrouillez-le avant de l’ouvrir." : "ce fichier est endommagé ou ne peut pas être ouvert."}`,
        );
      }
    }
    if (added.length) {
      setDocuments((previous) => [...previous, ...added]);
      setActive(documents.length);
      setPage(1);
    }
    setError(errors.join(" "));
    setLoading(false);
    if (input.current) input.current.value = "";
  }
  const isDirty = (doc) =>
    (marks[doc.id]?.length || 0) > 0 &&
    JSON.stringify(marks[doc.id]) !== JSON.stringify(savedMarks[doc.id] || []);
  const dirty = documents.some(isDirty);
  function edit(type, extra = {}) {
    if (!current || busy || aiBusy || loading) return;
    setNotice("");
    dispatch({ type, id: current.id, ...extra });
  }
  function addMark(mark) {
    edit("add", { mark });
  }
  function removeMark(markId) {
    edit("remove", { markId });
  }
  function removeDocument(removed) {
    setDocuments((previous) => previous.filter((doc) => doc.id !== removed.id));
    dispatch({ type: "close", id: removed.id });
    setActive(0);
    setPage(1);
    setNotice("");
    setPendingClose(null);
    setTimeout(() => removed.task.destroy(), 0);
  }
  function closeDocument() {
    if (isDirty(current)) {
      setPendingClose(current);
      discard.current.showModal();
    } else removeDocument(current);
  }
  useEffect(() => {
    const beforeUnload = (event) => {
      if (dirty || busy || aiBusy || loading) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    if (!window.caviardDesktop)
      window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy, aiBusy, loading]);
  async function download() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (const doc of documents) {
        const bytes = await exportRedacted(doc.pdf, marks[doc.id] || [], {
          onProgress: (done, total) =>
            setProgress(`${doc.name} — ${done} / ${total}`),
        });
        const filename = `${doc.name.replace(/\.pdf$/i, "")}-caviarde.pdf`;
        if (window.caviardDesktop) {
          const result = await window.caviardDesktop.savePdf(filename, bytes);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (!result.saved) {
            setNotice(
              "Enregistrement annulé. Les caviardages restent disponibles.",
            );
            return;
          }
        } else {
          const url = URL.createObjectURL(
            new Blob([bytes], { type: "application/pdf" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      }
      setSavedMarks(marks);
      setNotice(
        window.caviardDesktop
          ? "Votre PDF caviardé a été enregistré. Le contenu des zones sélectionnées a été supprimé."
          : "Votre PDF caviardé a été téléchargé. Le contenu des zones sélectionnées a été supprimé.",
      );
    } catch {
      setError(
        "Le PDF n’a pas pu être exporté. Essayez avec un document plus petit.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  useEffect(() => {
    const shortcut = (event) => {
      if (
        event.target.closest(
          "input, select, textarea, [contenteditable=true]",
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase()) &&
        current &&
        !busy &&
        !aiBusy &&
        !loading
      ) {
        event.preventDefault();
        setNotice("");
        dispatch({
          type:
            event.shiftKey || event.key.toLowerCase() === "y" ? "redo" : "undo",
          id: current.id,
        });
      }
      if (event.key === "F1") {
        event.preventDefault();
        help.current.showModal();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [current, busy, aiBusy, loading]);
  return (
    <>
      <header className="header">
        <a
          href="/"
          className="logo"
          aria-label="Inklura, accueil"
          onClick={(event) => event.preventDefault()}
        >
          <img src="/inklura-icon.svg" alt="" />
          <span>
            Inklura<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="product-label">
          PDF <span>/</span> Caviardage
        </span>
        <nav aria-label="Navigation principale">
          <span className="local-badge">
            <span />
            Sur votre appareil
          </span>
          <button
            className="help-toggle"
            onClick={() => help.current.showModal()}
          >
            <Icon icon={faCircleQuestion} /> Aide
          </button>
        </nav>
      </header>
      <AccountStatus busy={busy || aiBusy || loading} />
      <main className={current ? "app-main editing" : "app-main"}>
        <section className="intro">
          <div>
            <p className="eyebrow">VOS DOCUMENTS, EN CONFIANCE</p>
            <h1>
              Caviarder un PDF<span className="brand-dot">.</span>
            </h1>
            <p className="intro-description">
              Partagez l’essentiel. Gardez les informations sensibles pour vous.
            </p>
          </div>
          {current && (
            <span className={`edit-status ${dirty ? "unsaved" : ""}`}>
              {dirty
                ? "Modifications à exporter"
                : count
                  ? "Modifications exportées"
                  : "Prêt à caviarder"}
            </span>
          )}
        </section>
        <ol className="steps" aria-label="Étapes du caviardage">
          {["Importer", "Caviarder", "Exporter"].map((label, index) => (
            <li
              key={label}
              className={
                index === (current ? (count ? 2 : 1) : 0) ? "current-step" : ""
              }
            >
              <span>
                {current && index === 0 ? (
                  <Icon icon={faCheck} />
                ) : (
                  `0${index + 1}`
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(event) => openFiles(Array.from(event.target.files))}
        />
        {error && (
          <div className="message error" role="alert">
            <span>{error}</span>
            <button aria-label="Fermer le message" onClick={() => setError("")}>
              <Icon icon={faXmark} />
            </button>
          </div>
        )}
        {notice && (
          <div className="message success" role="status">
            <Icon icon={faCheck} />
            <span>{notice}</span>
          </div>
        )}
        {!current ? (
          <>
            <section
              className={`dropzone ${dragging ? "dragging" : ""}`}
              aria-label="Importer des fichiers PDF"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                openFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="upload-art" aria-hidden="true">
                <div className="paper-back" />
                <div className="paper-front">
                  <span>PDF</span>
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
                <span className="upload-lock">
                  <Icon icon={faLock} />
                </span>
              </div>
              <h2>
                {loading
                  ? "Ouverture de vos documents…"
                  : "Déposez vos PDF ici"}
              </h2>
              <p>Un document ou plusieurs. Tout reste sur votre appareil.</p>
              <button
                className="primary choose"
                disabled={loading || !workerReady}
                onClick={() => input.current.click()}
              >
                <Icon icon={faPlus} />
                {!workerReady
                  ? "Initialisation…"
                  : loading
                    ? "Chargement…"
                    : "Choisir des fichiers"}
              </button>
              <span className="file-hint">
                Fichiers PDF · Traitement local · Sans envoi de documents
              </span>
            </section>
            <section
              className="features"
              aria-label="Les avantages du caviardage"
            >
              <article>
                <Icon icon={faShieldHalved} />
                <div>
                  <h3>Confidentiel, par défaut</h3>
                  <p>
                    Vos documents sont traités localement. Ils ne quittent pas
                    votre appareil.
                  </p>
                </div>
              </article>
              <article>
                <Icon icon={faPenRuler} />
                <div>
                  <h3>Quelques gestes suffisent</h3>
                  <p>
                    Dessinez sur les zones sensibles, vérifiez chaque page, puis
                    exportez.
                  </p>
                </div>
              </article>
              <article>
                <Icon icon={faLock} />
                <div>
                  <h3>Un export définitif</h3>
                  <p>
                    Le PDF exporté ne conserve ni texte caché, ni annotations,
                    ni pièces jointes.
                  </p>
                </div>
              </article>
            </section>
          </>
        ) : (
          <section className="editor" aria-label="Éditeur de caviardage">
            <div className="editor-top">
              <div className="file-heading">
                <Icon icon={faFilePdf} />
                <select
                  aria-label="Document actif"
                  disabled={busy || aiBusy || loading}
                  value={active}
                  onChange={(event) => {
                    setActive(Number(event.target.value));
                    setPage(1);
                    setNotice("");
                  }}
                >
                  {documents.map((doc, i) => (
                    <option key={doc.id} value={i}>
                      {doc.name}
                    </option>
                  ))}
                </select>
                <span>
                  {documents.length > 1
                    ? `${documents.length} documents`
                    : `${current.pdf.numPages} page${current.pdf.numPages > 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="actions">
                <button
                  disabled={busy || aiBusy || loading}
                  onClick={() => input.current.click()}
                >
                  <Icon icon={faPlus} />
                  <span>Ajouter des fichiers</span>
                </button>
                <button
                  title="Fermer ce document"
                  aria-label="Fermer ce document"
                  disabled={busy || aiBusy || loading}
                  onClick={closeDocument}
                >
                  <Icon icon={faXmark} />
                </button>
              </div>
            </div>
            <div className="toolbar">
              <div className="actions page-navigation">
                <button
                  aria-label="Page précédente"
                  disabled={page <= 1 || busy || aiBusy || loading}
                  onClick={() => setPage(page - 1)}
                >
                  <Icon icon={faChevronLeft} />
                </button>
                <label>
                  Page{" "}
                  <input
                    key={`${current.id}-${page}`}
                    aria-label="Aller à la page"
                    type="number"
                    min="1"
                    max={current.pdf.numPages}
                    defaultValue={page}
                    disabled={busy || aiBusy || loading}
                    onBlur={(event) => {
                      const number = Math.min(
                        current.pdf.numPages,
                        Math.max(1, Number(event.target.value) || 1),
                      );
                      event.target.value = number;
                      setPage(number);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />{" "}
                  <span>/ {current.pdf.numPages}</span>
                </label>
                <button
                  aria-label="Page suivante"
                  disabled={
                    page >= current.pdf.numPages || busy || aiBusy || loading
                  }
                  onClick={() => setPage(page + 1)}
                >
                  <Icon icon={faChevronRight} />
                </button>
              </div>
              <div className="actions zoom">
                <button
                  aria-label="Réduire le zoom"
                  disabled={zoom <= 0.5 || busy}
                  onClick={() =>
                    setZoom((value) => Math.max(0.5, value - 0.25))
                  }
                >
                  <Icon icon={faMagnifyingGlassMinus} />
                </button>
                <span>{Math.round(zoom * 100)} %</span>
                <button
                  aria-label="Augmenter le zoom"
                  disabled={zoom >= 2 || busy}
                  onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
                >
                  <Icon icon={faMagnifyingGlassPlus} />
                </button>
                <button
                  aria-label="Ajuster à la largeur"
                  title="Ajuster à la largeur"
                  disabled={busy}
                  onClick={() => setZoom(1)}
                >
                  <Icon icon={faExpand} />
                </button>
              </div>
              <div className="actions history-actions">
                <button
                  disabled={
                    !history.undo[current.id]?.length ||
                    busy ||
                    aiBusy ||
                    loading
                  }
                  onClick={() => edit("undo")}
                  title="Annuler (Ctrl/Cmd+Z)"
                >
                  <Icon icon={faRotateLeft} />
                  <span>Annuler</span>
                </button>
                <button
                  disabled={
                    !history.redo[current.id]?.length ||
                    busy ||
                    aiBusy ||
                    loading
                  }
                  onClick={() => edit("redo")}
                  title="Rétablir (Ctrl/Cmd+Maj+Z)"
                >
                  <Icon icon={faRotateRight} />
                  <span>Rétablir</span>
                </button>
                <button
                  disabled={!currentMarks.length || busy || aiBusy || loading}
                  onClick={() => edit("clear")}
                  title="Effacer toutes les zones de ce document"
                >
                  <Icon icon={faTrashCan} />
                  <span>Tout effacer</span>
                </button>
              </div>
            </div>
            <Assistant
              key={current.id}
              doc={current}
              page={page}
              marks={currentMarks}
              disabled={busy || loading}
              onBusy={setAiBusy}
              onApply={(regions) => {
                setNotice(
                  "Zones ajoutées à l’aperçu. Vérifiez chaque page avant d’exporter.",
                );
                dispatch({ type: "batch", id: current.id, marks: regions });
                setPreview([]);
              }}
              onPreview={(number, regions) => {
                if (number) setPage(number);
                setPreview(regions);
              }}
            />
            <div className="editor-instructions">
              <Icon icon={faPenRuler} />
              <span>
                Dessinez un rectangle sur chaque information à masquer.
              </span>
              <span className="mark-count">
                {currentMarks.length} zone{currentMarks.length > 1 ? "s" : ""}{" "}
                dans ce document
              </span>
            </div>
            <div className="editor-body">
              <aside className="page-sidebar" aria-label="Pages du document">
                <div className="sidebar-title">
                  PAGES <span>{current.pdf.numPages}</span>
                </div>
                <div className="page-list">
                  {Array.from({ length: current.pdf.numPages }, (_, index) => {
                    const number = index + 1,
                      regions = currentMarks.filter(
                        (mark) => mark.page === number,
                      ).length;
                    return (
                      <button
                        key={number}
                        disabled={busy || aiBusy || loading}
                        className={number === page ? "selected" : ""}
                        aria-current={number === page ? "page" : undefined}
                        aria-label={`Afficher la page ${number}${regions ? `, ${regions} zone${regions > 1 ? "s" : ""}` : ""}`}
                        onClick={() => setPage(number)}
                      >
                        <span className="page-symbol">
                          <Icon icon={faFilePdf} />
                        </span>
                        <span>
                          Page {number}
                          <small>
                            {regions
                              ? `${regions} zone${regions > 1 ? "s" : ""}`
                              : "Aucune zone"}
                          </small>
                        </span>
                        {regions > 0 && <i />}
                      </button>
                    );
                  })}
                </div>
              </aside>
              <div className="workspace">
                <Page
                  key={`${current.id}-${page}`}
                  pdf={current.pdf}
                  number={page}
                  marks={currentMarks}
                  preview={preview}
                  addMark={addMark}
                  removeMark={removeMark}
                  zoom={zoom}
                  busy={busy || aiBusy || loading}
                  onError={setError}
                />
              </div>
            </div>
            <div className="export-area">
              <div className="export-description">
                <strong>
                  {count
                    ? `${count} zone${count > 1 ? "s" : ""} à caviarder · ${documents.length} document${documents.length > 1 ? "s" : ""}`
                    : "Sélectionnez les zones sensibles"}
                </strong>
                <p>
                  Le PDF exporté sera composé d’images. Son texte ne sera plus
                  sélectionnable.
                </p>
              </div>
              <button
                className="primary download"
                disabled={busy || aiBusy || loading || !count}
                onClick={download}
              >
                <Icon icon={faDownload} />
                {busy
                  ? "Caviardage en cours…"
                  : `Exporter ${documents.length > 1 ? "les PDF" : "le PDF"}`}
              </button>
              {busy && (
                <p className="export-progress" role="status">
                  {progress || "Préparation du PDF…"}
                </p>
              )}
            </div>
          </section>
        )}
        <div className="privacy-note">
          <Icon icon={faShieldHalved} />
          <span>
            Vos originaux restent intacts. Vous exportez une nouvelle copie
            caviardée.
          </span>
          <button onClick={() => privacy.current.showModal()}>
            En savoir plus
          </button>
        </div>
      </main>
      <footer>
        <span>
          Un outil{" "}
          <a href="https://www.inklura.fr/" target="_blank" rel="noreferrer">
            Inklura
            <Icon icon={faArrowUpRightFromSquare} />
          </a>
        </span>
        <div>
          <button onClick={() => privacy.current.showModal()}>
            Confidentialité
          </button>
          <button onClick={() => help.current.showModal()}>
            Guide & raccourcis
          </button>
          <a href="mailto:contact@inklura.fr">Contact</a>
        </div>
      </footer>
      <DesktopStatus dirty={dirty} busy={busy || aiBusy || loading} />
      <dialog
        ref={help}
        className="info-dialog"
        aria-labelledby="help-title"
        onClick={(event) => {
          if (event.target === help.current) help.current.close();
        }}
      >
        <div className="dialog-title">
          <div>
            <p className="eyebrow">PRISE EN MAIN</p>
            <h2 id="help-title">Un PDF prêt à partager.</h2>
          </div>
          <button
            aria-label="Fermer l’aide"
            onClick={() => help.current.close()}
          >
            <Icon icon={faXmark} />
          </button>
        </div>
        <div className="dialog-content">
          <ol className="help-steps">
            <li>
              <strong>Importez vos PDF</strong>
              <p>
                Glissez vos fichiers dans la fenêtre ou utilisez le bouton de
                sélection.
              </p>
            </li>
            <li>
              <strong>Masquez les informations sensibles</strong>
              <p>
                Dessinez des rectangles. La liste des pages vous indique où se
                trouvent vos zones. Vérifiez toutes les pages avant l’export.
              </p>
            </li>
            <li>
              <strong>Exportez une nouvelle copie</strong>
              <p>
                Les zones noires sont intégrées aux images des pages. Le texte
                d’origine, les annotations et les pièces jointes ne sont pas
                conservés.
              </p>
            </li>
          </ol>
          <div className="shortcut-list">
            <span>Annuler</span>
            <kbd>Ctrl / ⌘ + Z</kbd>
            <span>Rétablir</span>
            <kbd>Ctrl / ⌘ + Maj + Z</kbd>
            <span>Aide</span>
            <kbd>F1</kbd>
          </div>
          <p className="dialog-note">
            Le caviardage s’applique à l’export. Vos fichiers originaux restent
            inchangés.
          </p>
        </div>
      </dialog>
      <dialog
        ref={privacy}
        className="info-dialog"
        aria-labelledby="privacy-title"
      >
        <div className="dialog-title">
          <h2 id="privacy-title">Vos documents restent ici.</h2>
          <button
            aria-label="Fermer la confidentialité"
            onClick={() => privacy.current.close()}
          >
            <Icon icon={faXmark} />
          </button>
        </div>
        <div className="dialog-content">
          <p>
            Les PDF sont ouverts et traités sur votre appareil, sans
            téléversement. Les fichiers que vous exportez restent à
            l’emplacement que vous choisissez sur votre ordinateur.
          </p>
          <p>
            Chaque export crée un PDF composé uniquement des images caviardées
            des pages. Le texte caché, les métadonnées d’origine, les
            formulaires, les annotations et les pièces jointes sont écartés. Le
            texte du PDF exporté ne peut plus être sélectionné ni recherché.
          </p>
          <p>
            La version ordinateur contacte GitHub pour rechercher et télécharger
            les mises à jour de l’application. Vos documents ne sont jamais
            inclus dans ces échanges.
          </p>
          <p>
            Dans les versions avec compte Inklura, la connexion, le suivi des
            crédits et le paiement utilisent Internet. Aucun PDF, nom de fichier
            ou contenu du document n’est transmis pour la facturation. Un journal
            local permet de terminer le décompte des exports après une coupure.
          </p>
          <p>
            Vérifiez visuellement votre copie exportée avant de la partager.
          </p>
        </div>
      </dialog>
      <dialog
        ref={discard}
        className="info-dialog discard-dialog"
        aria-labelledby="discard-title"
      >
        <div className="dialog-title">
          <h2 id="discard-title">Fermer sans exporter ?</h2>
        </div>
        <div className="dialog-content">
          <p>
            Les zones sélectionnées dans <strong>{pendingClose?.name}</strong>{" "}
            n’ont pas été exportées. Elles seront perdues si vous fermez ce
            document.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary"
              autoFocus
              onClick={() => {
                discard.current.close();
                setPendingClose(null);
              }}
            >
              Continuer à travailler
            </button>
            <button
              className="danger"
              onClick={() => {
                discard.current.close();
                if (pendingClose) removeDocument(pendingClose);
              }}
            >
              Fermer sans exporter
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
