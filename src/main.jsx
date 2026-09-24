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
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import "@fontsource-variable/inter";
import { droppedFiles, relativeName, fileKey, MAX_DOCUMENTS, MAX_IMPORT_BYTES } from "./imports.mjs";
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
        scale: Math.min(2.5, 4096 / Math.max(natural.width, natural.height)),
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
        width: `${zoom * 100}%`,
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
  const folderInput = useRef(null),
    importLock = useRef(false),
    pendingImport = useRef(true);
  const [importSignal, setImportSignal] = useState(0);
  const bridge = window.caviardDesktop;
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
  useEffect(() => bridge?.onDocuments?.(() => {
    pendingImport.current = true;
    setImportSignal((value) => value + 1);
  }), []);
  useEffect(() => {
    if (!bridge?.takeDocuments || !workerReady || loading || busy || aiBusy ||
      importLock.current || !pendingImport.current) return;
    pendingImport.current = false;
    void importSelection(async () => {
      const selection = await bridge.takeDocuments();
      return { ...selection, files: selection.files.map((file) => ({
        ...file, nativeId: file.id, type: "application/pdf",
        arrayBuffer: () => bridge.readDocument(file.id),
      })) };
    });
  }, [workerReady, loading, busy, aiBusy, importSignal]);
  async function importSelection(selection) {
    if (importLock.current || loading || busy || aiBusy || !workerReady) return;
    importLock.current = true;
    setLoading(true);
    let files = [];
    const added = [], errors = [];
    try {
      const result = await selection();
      files = result.files;
      if (!files.length && !result.messages?.length) return;
      setError("");
      setNotice("");
      const messages = [...(result.messages || [])];
      const existing = new Set(docsRef.current.map((doc) => doc.sourceKey));
      let bytes = docsRef.current.reduce((total, doc) => total + (doc.size || 0), 0);
      let duplicates = 0, ignored = 0;
      const ordered = files.some((file) => relativeName(file).includes("/"))
        ? [...files].sort((a, b) => relativeName(a).localeCompare(relativeName(b), "en", { numeric: true }))
        : files;
      for (const file of ordered) {
        if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
          if (file.relativePath || file.webkitRelativePath) ignored++;
          else errors.push(`${file.name} : choisissez un fichier PDF.`);
          continue;
        }
        const sourceKey = fileKey(file);
        if (existing.has(sourceKey)) { duplicates++; continue; }
        if (docsRef.current.length + added.length >= MAX_DOCUMENTS || bytes + file.size > MAX_IMPORT_BYTES) {
          messages.push("Espace de travail limité à 250 PDF et 512 Mo. Fermez des documents avant de continuer.");
          break;
        }
        let task;
        try {
          setProgress(`Importation ${added.length + 1} / ${files.length} — ${relativeName(file)}`);
          task = pdfjs.getDocument({
            worker: sharedWorker,
            data: new Uint8Array(await file.arrayBuffer()),
            isEvalSupported: false,
          });
          const pdf = await task.promise;
          added.push({ id: crypto.randomUUID(), name: file.name,
            relativePath: relativeName(file), sourceKey, size: file.size, pdf, task });
          existing.add(sourceKey);
          bytes += file.size;
        } catch (e) {
          await task?.destroy();
          errors.push(`${relativeName(file)} : ${e.name === "PasswordException"
            ? "ce PDF est protégé par un mot de passe. Déverrouillez-le avant de l’ouvrir."
            : "ce fichier est endommagé ou ne peut pas être ouvert."}`);
        }
      }
      if (added.length) {
        const previous = docsRef.current;
        docsRef.current = [...previous, ...added];
        setDocuments(docsRef.current);
        setActive(previous.length);
        setPage(1);
      }
      if (duplicates) messages.push(`${duplicates} PDF déjà ouvert(s), ignoré(s).`);
      if (ignored) messages.push(`${ignored} fichier(s) non PDF ignoré(s).`);
      if (!added.length && !errors.length && !messages.length) messages.push("Aucun PDF trouvé dans cette sélection.");
      setError(errors.join(" "));
      setNotice(messages.join(" "));
    } catch (e) {
      setError(e.message || "Impossible d’importer cette sélection.");
    } finally {
      const ids = files.filter((file) => file.nativeId).map((file) => file.nativeId);
      if (ids.length) await bridge.discardDocuments(ids).catch(() => {});
      importLock.current = false;
      setLoading(false);
      setProgress("");
      if (input.current) input.current.value = "";
      if (folderInput.current) folderInput.current.value = "";
    }
  }
  function openFiles(files) {
    if (files?.length) void importSelection(async () => ({ files }));
  }
  function chooseDocuments(folder = false) {
    if (bridge?.chooseDocuments) {
      void bridge.chooseDocuments(folder).catch(() => setError("Impossible d’ouvrir le sélecteur de fichiers."));
    } else (folder ? folderInput : input).current.click();
  }
  function dropDocuments(event) {
    event.preventDefault();
    setDragging(false);
    if (busy || aiBusy || loading || !workerReady) return;
    if (bridge?.importDroppedFiles) {
      void bridge.importDroppedFiles(Array.from(event.dataTransfer.files))
        .catch(() => setError("Impossible d’importer cette sélection."));
    } else {
      const files = droppedFiles(event.dataTransfer);
      void importSelection(async () => {
        const selected = await files;
        return { files: selected, messages: selected.length ? [] : ["Aucun PDF trouvé dans cette sélection."] };
      });
    }
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
    docsRef.current = docsRef.current.filter((doc) => doc.id !== removed.id);
    setDocuments(docsRef.current);
    setSavedMarks((previous) => { const next = { ...previous }; delete next[removed.id]; return next; });
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
    let batch, saved = 0;
    try {
      if (documents.length > 1 && bridge?.beginBatchExport) {
        batch = await bridge.beginBatchExport(documents.map(({ id, name, relativePath }) => ({ id, name, relativePath })));
        if (!batch) {
          setNotice("Enregistrement annulé. Les caviardages restent disponibles.");
          return;
        }
      }
      for (const doc of documents) {
        const bytes = await exportRedacted(doc.pdf, marks[doc.id] || [], {
          onProgress: (done, total) =>
            setProgress(`${saved + 1} / ${documents.length} PDF — ${doc.relativePath || doc.name} — page ${done} / ${total}`),
        });
        const filename = `${doc.name.replace(/\.pdf$/i, "")}-caviarde.pdf`;
        if (window.caviardDesktop) {
          const result = await window.caviardDesktop.savePdf(filename, bytes,
            batch ? { id: batch.id, documentId: doc.id } : undefined);
          if (result.error) {
            setError(`${result.error}${saved ? ` ${saved} PDF déjà enregistré(s).` : ""}`);
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
        saved++;
        setSavedMarks((previous) => ({ ...previous, [doc.id]: marks[doc.id] || [] }));
      }
      setNotice(
        batch
          ? `${saved} PDF enregistrés dans « ${batch.name} ». Les sous-dossiers sont conservés.`
          : window.caviardDesktop
          ? "Votre PDF caviardé a été enregistré. Le contenu des zones sélectionnées a été supprimé."
          : "Votre PDF caviardé a été téléchargé. Le contenu des zones sélectionnées a été supprimé.",
      );
    } catch {
      setError(
        `Le PDF n’a pas pu être exporté. Essayez avec un document plus petit.${saved ? ` ${saved} PDF déjà enregistré(s).` : ""}`,
      );
    } finally {
      if (batch) await bridge.endBatchExport(batch.id).catch(() => {});
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
        <input ref={folderInput} type="file" webkitdirectory="" multiple hidden
          aria-label="Dossier de PDF"
          onChange={(event) => {
            const files = Array.from(event.target.files);
            if (files.length) openFiles(files);
            else setNotice("Aucun PDF trouvé dans ce dossier.");
          }} />
        {loading && progress && <p className="import-progress" role="status">{progress}</p>}
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
              onDrop={dropDocuments}
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
              <p>Des PDF ou un dossier avec ses sous-dossiers. Tout reste sur votre appareil.</p>
              <button
                className="primary choose"
                disabled={loading || !workerReady}
                onClick={() => chooseDocuments()}
              >
                <Icon icon={faPlus} />
                {!workerReady
                  ? "Initialisation…"
                  : loading
                    ? "Chargement…"
                    : "Choisir des fichiers"}
              </button>
              <button className="folder-choose" disabled={loading || !workerReady}
                onClick={() => chooseDocuments(true)}>
                <Icon icon={faFolderOpen} /> Importer un dossier
              </button>
              <span className="file-hint">
                PDF et dossiers · Jusqu’à 250 PDF / 512 Mo · Traitement local
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
          <section className={`editor ${dragging ? "dragging" : ""}`} aria-label="Éditeur de caviardage"
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={dropDocuments}>
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
                      {doc.relativePath || doc.name}
                    </option>
                  ))}
                </select>
                <span>
                  {documents.length > 1
                    ? `${documents.length} documents`
                    : `${current.pdf.numPages} page${current.pdf.numPages > 1 ? "s" : ""}`}
                </span>
              </div>
              <span className={`edit-status ${dirty ? "unsaved" : ""}`}>
                {dirty
                  ? "Modifications à exporter"
                  : count
                    ? "Modifications exportées"
                    : "Prêt à caviarder"}
              </span>
              <div className="actions">
                <button
                  disabled={busy || aiBusy || loading}
                  onClick={() => chooseDocuments()}
                >
                  <Icon icon={faPlus} />
                  <span>Ajouter des fichiers</span>
                </button>
                <button disabled={busy || aiBusy || loading} onClick={() => chooseDocuments(true)}
                  title="Importer un dossier et ses sous-dossiers">
                  <Icon icon={faFolderOpen} /><span>Importer un dossier</span>
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
                  Le PDF exporté sera composé d’images, sans métadonnées
                  documentaires. Son texte ne sera plus sélectionnable.
                  {documents.length > 1 && bridge?.beginBatchExport &&
                    " Choisissez une destination : un nouveau dossier contiendra toutes les copies, avec leurs sous-dossiers."}
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
            des pages. Aucune métadonnée documentaire (auteur, créateur,
            producteur ou date) n’est ajoutée. Le texte caché, les métadonnées
            d’origine, les formulaires, les annotations et les pièces jointes
            sont écartés. Le
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
