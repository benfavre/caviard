import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  faUserSecret,
  faLayerGroup,
  faShieldHalved,
  faPenRuler,
  faTriangleExclamation,
  faWifi,
  faFilePdf,
  faGlobe,
  faEnvelope,
  faXmark,
  faChevronLeft,
  faChevronRight,
  faRotateLeft,
  faTrashCan,
  faDownload,
  faPlus,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faFile,
  faScissors,
  faArrowsRotate,
  faLock,
  faImage,
  faSignature,
  faCompress,
} from "@fortawesome/free-solid-svg-icons";
import "@fontsource/roboto/latin-200.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import { exportRedacted, normalizeRect } from "./pdf.mjs";
import "./styles.css";
import DesktopStatus from "./DesktopStatus.jsx";
if (window.caviardDesktop) document.title = "Caviard — Caviarder un PDF";

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
const features = [
  [
    faUserSecret,
    "Caviardage permanent",
    "Le contenu des zones sélectionnées est définitivement supprimé des images des pages, et pas simplement recouvert de rectangles modifiables.",
  ],
  [
    faLayerGroup,
    "Aucun contenu original caché",
    "Le nouveau PDF est créé à partir des images des pages après caviardage. Les textes, images, annotations et calques d’origine ne sont pas conservés en tant qu’éléments séparés.",
  ],
  [
    faShieldHalved,
    "Votre vie privée est respectée",
    "Votre PDF est traité localement dans votre navigateur et n’est jamais envoyé sur un serveur.",
  ],
  [
    faPenRuler,
    "Plusieurs zones de caviardage",
    "Dessinez autant de rectangles de caviardage que nécessaire sur toutes les pages.",
  ],
  [
    faTriangleExclamation,
    "PDF composé uniquement d’images",
    "Pour garantir un caviardage irréversible, le PDF obtenu ne contient que des images : il n’est plus possible de sélectionner du texte ni d’y effectuer des recherches.",
  ],
  [
    faWifi,
    "Fonctionne hors ligne",
    "Une fois chargé, l’outil peut caviarder des PDF sans connexion Internet.",
  ],
];
const tools = [
  ["FUSIONNER", "fusionner-pdf", faLayerGroup],
  ["DIVISER", "diviser-pdf", faScissors],
  ["EXTRAIRE", "extraire-pages-pdf", faFile],
  ["SUPPRIMER", "supprimer-pages-pdf", faTrashCan],
  ["RÉORGANISER", "reorganiser-pages-pdf", faLayerGroup],
  ["INVERSER", "inverser-pages-pdf", faArrowsRotate],
  ["PIVOTER", "faire-pivoter-pages-pdf", faArrowsRotate],
  ["NUMÉROTER", "numeroter-pages-pdf", faFile],
  ["NUMÉROTATION BATES", "numerotation-bates-pdf", faFile],
  ["FILIGRANE", "filigrane-pdf", faFile],
  ["SIGNER", "signer-pdf", faSignature],
  ["SUPPRIMER LE FILIGRANE", "supprimer-filigrane-pdf", faFile],
  ["CAVIARDER", "caviarder-pdf", faUserSecret],
  ["ALTERNER LES PAGES", "entrelacer-pdf", faLayerGroup],
  ["RÉPÉTER", "repeter-pdf", faFile],
  ["INSPECTER", "inspecter-pdf", faFile],
  ["AJOUTER DES PAGES VIERGES", "ajouter-pages-vierges-pdf", faPlus],
  ["CRÉER UNE ARCHIVE ZIP", "zipper-pdf", faFile],
  ["AJOUTER DES PIÈCES JOINTES", "ajouter-pieces-jointes-pdf", faPlus],
  ["COMPRESSER", "compresser-pdf", faCompress],
  ["REDIMENSIONNER", "redimensionner-pages-pdf", faFile],
  ["RECADRER", "recadrer-pdf", faFile],
  ["MULTIPAGE ET LIVRET", "pdf-n-up-livret", faLayerGroup],
  ["METTRE EN MIROIR", "miroir-pages-pdf", faFile],
  ["MODIFIER LES MÉTADONNÉES", "modifier-metadonnees-pdf", faFile],
  ["SUPPRIMER LES MÉTADONNÉES", "supprimer-metadonnees-pdf", faFile],
  ["AJOUTER UN MOT DE PASSE", "ajouter-mot-de-passe-pdf", faLock],
  ["RETIRER LE MOT DE PASSE", "retirer-mot-de-passe-pdf", faLock],
  ["SCANNER", "scanner-pdf", faImage],
  ["PDF EN JPEG", "convertir-pdf-en-jpeg", faImage],
  ["JPEG EN PDF", "convertir-jpeg-en-pdf", faImage],
  ["PDF EN PNG", "convertir-pdf-en-png", faImage],
  ["PNG EN PDF", "convertir-png-en-pdf", faImage],
  ["PDF EN TIFF", "convertir-pdf-en-tiff", faImage],
  ["TIFF EN PDF", "convertir-tiff-en-pdf", faImage],
  ["EXTRAIRE LES IMAGES D’UN PDF", "extraire-images-pdf", faImage],
  ["OCR", "ocr-pdf", faFile],
  ["COMMENTER", "commenter-pdf", faFile],
];
function Page({
  pdf,
  number,
  marks,
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
  const [savedSignature, setSavedSignature] = useState(null);
  const [marks, setMarks] = useState({}),
    [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dragging, setDragging] = useState(false);
  const input = useRef(null),
    drawer = useRef(null),
    languages = useRef(null),
    docsRef = useRef([]);
  const current = documents[active];
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
    if (loading || busy || !workerReady || !files?.length) return;
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
  function addMark(mark) {
    setNotice("");
    setMarks((previous) => ({
      ...previous,
      [current.id]: [...(previous[current.id] || []), mark],
    }));
  }
  function removeMark(id) {
    setNotice("");
    setMarks((previous) => ({
      ...previous,
      [current.id]: previous[current.id].filter((mark) => mark.id !== id),
    }));
  }
  function closeDocument() {
    const removed = current;
    setDocuments((previous) => previous.filter((doc) => doc.id !== removed.id));
    setMarks((previous) => {
      const next = { ...previous };
      delete next[removed.id];
      return next;
    });
    setActive(0);
    setPage(1);
    setNotice("");
    // Wait for React to unmount the page and cancel any active render.
    setTimeout(() => removed.task.destroy(), 0);
  }
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
          if (!result.saved) { setNotice("Enregistrement annulé. Les caviardages restent disponibles."); return; }
        } else {
          const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
          const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      }
      setSavedSignature(JSON.stringify(marks));
      setNotice(window.caviardDesktop
        ? "Votre PDF caviardé a été enregistré. Le contenu des zones sélectionnées a été supprimé."
        : "Votre PDF caviardé a été téléchargé. Le contenu des zones sélectionnées a été supprimé.");
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
    const undo = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        current &&
        !busy
      ) {
        event.preventDefault();
        setNotice("");
        setMarks((previous) => ({
          ...previous,
          [current.id]: (previous[current.id] || []).slice(0, -1),
        }));
      }
    };
    window.addEventListener("keydown", undo);
    return () => window.removeEventListener("keydown", undo);
  }, [current, busy]);
  return (
    <>
      <header className="header">
        <a href="/" className="logo" aria-label={window.caviardDesktop ? "Caviard, accueil" : "pdfux, accueil"} onClick={event => { if (window.caviardDesktop) event.preventDefault(); }}>
          <img src={window.caviardDesktop ? "/caviard-icon.png" : "/logo-header.png"} alt="" />
          {window.caviardDesktop ? <span>Caviard</span> : <span>pdf<span className="logo-blue">ux</span></span>}
        </a>
        <nav>
          <a
            className="support"
            href="https://buymeacoffee.com/pdfux"
            target="_blank"
            rel="noreferrer"
          >
            Soutenez pdfux
          </a>
          <button
            className="tools-toggle"
            onClick={() => drawer.current.showModal()}
          >
            TOUS LES OUTILS PDF
          </button>
        </nav>
      </header>
      <main>
        <DesktopStatus dirty={count > 0 && savedSignature !== JSON.stringify(marks)} busy={busy || loading} />
        <section className="intro">
          <h1>
            <Icon icon={faUserSecret} /> Caviarder un PDF
          </h1>
          <h2>Supprimez définitivement le contenu sensible d’un PDF</h2>
        </section>
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
            {notice}
          </div>
        )}
        {!current ? (
          <section
            className={`dropzone ${dragging ? "dragging" : ""}`}
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
            aria-label="Importer des fichiers PDF"
          >
            <Icon icon={faFilePdf} className="upload-icon" />
            <p>
              {loading
                ? "Ouverture de vos fichiers PDF…"
                : "Déposez vos fichiers PDF ici ou"}
            </p>
            <button
              className="primary choose"
              disabled={loading || !workerReady}
              onClick={() => input.current.click()}
            >
              {!workerReady
                ? "Initialisation…"
                : loading
                  ? "Chargement…"
                  : "Choisir des fichiers"}
            </button>
            <Privacy />
          </section>
        ) : (
          <section className="editor" aria-label="Éditeur de caviardage">
            <div className="editor-top">
              <div className="file-heading">
                <Icon icon={faFilePdf} />
                <select
                  aria-label="Document actif"
                  disabled={busy || loading}
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
                  {current.pdf.numPages} page
                  {current.pdf.numPages > 1 ? "s" : ""}
                </span>
              </div>
              <div className="actions">
                <button
                  disabled={busy || loading}
                  onClick={() => input.current.click()}
                >
                  <Icon icon={faPlus} /> Ajouter des fichiers
                </button>
                <button
                  title="Fermer ce document"
                  aria-label="Fermer ce document"
                  disabled={busy || loading}
                  onClick={closeDocument}
                >
                  <Icon icon={faXmark} />
                </button>
              </div>
            </div>
            <div className="editor-instructions">
              <Icon icon={faPenRuler} />
              <span>Dessinez des rectangles sur les zones à caviarder.</span>
              <span className="mark-count">
                {count} zone{count > 1 ? "s" : ""} sélectionnée
                {count > 1 ? "s" : ""}
              </span>
            </div>
            <div className="toolbar">
              <div className="actions">
                <button
                  aria-label="Page précédente"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage(page - 1)}
                >
                  <Icon icon={faChevronLeft} />
                </button>
                <span>
                  Page <strong>{page}</strong> / {current.pdf.numPages}
                </span>
                <button
                  aria-label="Page suivante"
                  disabled={page >= current.pdf.numPages || busy}
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
              </div>
              <div className="actions">
                <button
                  disabled={!currentMarks.length || busy}
                  onClick={() => {
                    setNotice("");
                    setMarks((previous) => ({
                      ...previous,
                      [current.id]: currentMarks.slice(0, -1),
                    }));
                  }}
                  title="Annuler (Ctrl+Z)"
                >
                  <Icon icon={faRotateLeft} />
                  <span>Annuler</span>
                </button>
                <button
                  disabled={!currentMarks.length || busy}
                  onClick={() => {
                    setNotice("");
                    setMarks((previous) => ({ ...previous, [current.id]: [] }));
                  }}
                >
                  <Icon icon={faTrashCan} />
                  <span>Tout effacer</span>
                </button>
              </div>
            </div>
            <div className="workspace">
              <Page
                key={`${current.id}-${page}`}
                pdf={current.pdf}
                number={page}
                marks={currentMarks}
                addMark={addMark}
                removeMark={removeMark}
                zoom={zoom}
                busy={busy}
                onError={setError}
              />
            </div>
            <div className="export-area">
              <p>
                <Icon icon={faTriangleExclamation} /> Le PDF obtenu contiendra
                uniquement des images. Le texte ne sera plus sélectionnable.
              </p>
              <button
                className="primary download"
                disabled={busy || loading || !count}
                onClick={download}
              >
                <Icon icon={faDownload} />
                {busy
                  ? "Caviardage en cours…"
                  : `Appliquer et télécharger ${documents.length > 1 ? "les PDF" : "le PDF"}`}
              </button>
              {busy && <p role="status">{progress || "Préparation du PDF…"}</p>}
              <Privacy />
            </div>
          </section>
        )}
        <section className="features" aria-label="Les avantages du caviardage">
          {features.map(([icon, title, text]) => (
            <article key={title}>
              <h3>
                <Icon icon={icon} /> {title}
              </h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer>
        <div className="footer-links">
          <button onClick={() => languages.current.showModal()}>
            <Icon icon={faGlobe} /> Français
          </button>
          <a href="https://pdfux.com/blog" target="_blank" rel="noreferrer">
            Blog
          </a>
          <a
            href="https://pdfux.com/privacy-policy/"
            target="_blank"
            rel="noreferrer"
          >
            Confidentialité
          </a>
          <a
            href="https://buymeacoffee.com/pdfux"
            target="_blank"
            rel="noreferrer"
          >
            Café
          </a>
        </div>
        <span className="version">v1.0.0</span>
        <div className="social">
          <a
            href="https://reddit.com/r/pdfux"
            target="_blank"
            rel="noreferrer"
            aria-label="Reddit"
          >
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12a12 12 0 1 0-24 0 12 12 0 0 0 24 0ZM19 11c1.8 0 2.4 2.4.8 3.2.4 3-3.2 5.2-7.8 5.2s-8.2-2.2-7.8-5.2C2.6 13.4 3.2 11 5 11c.6 0 1.1.2 1.4.6 1.3-.7 3-1.2 4.9-1.2l1.1-5.1 3.6.8a1.6 1.6 0 1 1-.2 1l-2.6-.6-.9 3.9c2 0 3.9.5 5.3 1.2.3-.4.8-.6 1.4-.6ZM8 13a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 8 13Zm8 0a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 16 13Zm-7 4c1.8 1.2 4.2 1.2 6 0l-.5-.7c-1.5 1-3.5 1-5 0Z" />
            </svg>
          </a>
          <a
            href="https://youtube.com/@pdfux"
            aria-label="YouTube"
            target="_blank"
            rel="noreferrer"
          >
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23 7s-.2-2-1-2.8C21 3.3 20 3.3 19.5 3.2 16 3 12 3 12 3s-4 0-7.5.2C4 3.3 3 3.3 2 4.2 1.2 5 1 7 1 7s-.3 2.3-.3 4.5v1C.7 14.7 1 17 1 17s.2 2 1 2.8c1 .9 2.2.9 2.8 1C7 21 12 21 12 21s4 0 7.5-.2c.5-.1 1.5-.1 2.5-1 .8-.8 1-2.8 1-2.8s.3-2.3.3-4.5v-1C23.3 9.3 23 7 23 7Zm-13.5 9V8l7 4Z" />
            </svg>
          </a>
          <a href="mailto:contact@pdfux.com" aria-label="Contact pdfux">
            <Icon icon={faEnvelope} />
          </a>
        </div>
      </footer>
      <dialog
        ref={drawer}
        className="tool-drawer"
        onClick={(event) => {
          if (event.target === drawer.current) drawer.current.close();
        }}
      >
        <div className="drawer-title">
          <h2>TOUS LES OUTILS PDF</h2>
          <button
            aria-label="Fermer les outils"
            onClick={() => drawer.current.close()}
          >
            <Icon icon={faXmark} />
          </button>
        </div>
        <div className="tool-list">
          {tools.map(([label, path, icon]) =>
            path === "caviarder-pdf" ? (
              <button
                className="active-tool"
                key={path}
                onClick={() => drawer.current.close()}
              >
                <Icon icon={icon} />
                {label}
              </button>
            ) : (
              <a
                key={path}
                href={`https://pdfux.com/fr/${path}/`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon icon={icon} />
                {label}
                <span className="external">↗</span>
              </a>
            ),
          )}
        </div>
      </dialog>
      <dialog ref={languages} className="language-dialog">
        <div className="drawer-title">
          <h2>Choisir une langue</h2>
          <button
            aria-label="Fermer les langues"
            onClick={() => languages.current.close()}
          >
            <Icon icon={faXmark} />
          </button>
        </div>
        <p>Les autres langues sont disponibles sur pdfux.</p>
        {[
          ["Français", null],
          ["English", "https://pdfux.com/redact-pdf/"],
          ["Deutsch", "https://pdfux.com/de/"],
          ["Español", "https://pdfux.com/es/"],
          ["Italiano", "https://pdfux.com/it/"],
          ["Português", "https://pdfux.com/pt/"],
        ].map(([label, url]) =>
          url ? (
            <a key={label} href={url} target="_blank" rel="noreferrer">
              {label} ↗
            </a>
          ) : (
            <button key={label} onClick={() => languages.current.close()}>
              {label} ✓
            </button>
          ),
        )}
      </dialog>
    </>
  );
}
function Privacy() {
  return (
    <div className="privacy">
      <Icon icon={faShieldHalved} /> Les fichiers sont traités sur votre
      appareil. Aucun fichier n’est envoyé sur un serveur.
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
