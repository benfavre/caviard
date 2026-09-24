import { TechnicalDetails } from "../lib/technical-details";
import { RedactionDemo, Screencast, PrivacyDiagram } from "../lib/demos";
import release from "../lib/inklura-pdf-release.json";

export const revalidate = 600;
const platforms = [
  { id: "windows", label: "Windows", detail: "PC · processeur Intel ou AMD 64 bits", suffix: "win-x64.exe", format: "Installateur .exe", mark: "⊞" },
  { id: "mac-apple", label: "Mac Apple Silicon", detail: "Mac avec puce Apple M1, M2, M3…", suffix: "mac-arm64.dmg", format: "Image disque .dmg", mark: "⌘" },
  { id: "mac-intel", label: "Mac Intel", detail: "Mac avec processeur Intel", suffix: "mac-x64.dmg", format: "Image disque .dmg", mark: "⌘" },
  { id: "linux", label: "Linux", detail: "PC · processeur Intel ou AMD 64 bits", suffix: "linux-x86_64.AppImage", format: "Application .AppImage", mark: ">_" },
];
function asset(suffix: string) {
  const found = release.assets.find((a) => a.name === suffix || a.name === "Inklura-PDF-" + release.version + "-" + suffix);
  if (!found) throw new Error("Missing release asset: " + suffix);
  return found;
}

export default function Page(): any {
  return <main className="ipdf" id="contenu" tabIndex={-1}>
    <link rel="stylesheet" href="/inklura-pdf/page.css?v=20260924-anonymisation-1" />
    <div className="ipdf-wrap">
      <section className="ipdf-hero" aria-labelledby="ipdf-title">
        <div>
          <div className="ipdf-eyebrow"><span /> INKLURA PDF · ESSAI GRATUIT</div>
          <h1 id="ipdf-title">Partagez l’essentiel.<br /><em>Gardez le reste<br />pour vous.</em></h1>
          <p className="ipdf-lead">Préparez vos PDF avant de les partager avec une IA, un client ou un partenaire. Masquez les données personnelles et les informations confidentielles sur votre ordinateur, à la main ou avec un assistant IA local.</p>
          <div className="ipdf-actions"><a className="ipdf-primary" href="#telecharger">Télécharger Inklura PDF <span aria-hidden="true">↓</span></a><a className="ipdf-textlink" href="#demonstration">Voir la démo <span aria-hidden="true">↗</span></a></div>
          <p className="ipdf-meta">Windows, macOS et Linux · Version {release.version} · 20 PDF d’essai par compte</p>
        </div>
        <RedactionDemo />
      </section>
      <div className="ipdf-trust"><span>◎ <strong>Vos documents restent chez vous</strong></span><span>↶ Modifications annulables</span><span>▤ PDF numériques & scans</span><span>✦ IA locale optionnelle</span></div>

      <section className="ipdf-section ipdf-anonymisation" id="anonymisation" aria-labelledby="anonymisation-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">ANONYMISATION · IA GÉNÉRATIVE · PARTAGE</p><h2 id="anonymisation-title">Une IA a besoin du sujet.<br />Pas forcément des identités.</h2></div><p>Faire résumer un contrat, analyser un dossier ou préparer une synthèse : choisissez les informations utiles avant de transmettre votre PDF à un grand modèle de langage (LLM).</p></div>
        <div className="ipdf-features">
          <article><span className="ipdf-number">01 · PRÉPARER EN LOCAL</span><h3>Retirez ce qui n’est pas nécessaire.</h3><p>Noms, coordonnées, signatures, références client, données de santé ou montants confidentiels : sélectionnez les zones selon votre usage. L’assistant local peut aider au repérage ; vous vérifiez ses propositions.</p></article>
          <article><span className="ipdf-number">02 · RELIRE LE RÉSULTAT</span><h3>Pensez aussi aux indices.</h3><p>Un poste rare, une date précise ou le récit d’un événement peuvent suffire à reconnaître une personne. Relisez toutes les pages et choisissez un nom de fichier qui ne révèle pas son identité.</p></article>
          <article><span className="ipdf-number">03 · PARTAGER LA COPIE</span><h3>Décidez de ce qui sort.</h3><p>Exportez un nouveau PDF sans métadonnées documentaires, puis ouvrez-le pour le contrôler. Inklura PDF ne l’envoie pas à un LLM : vous choisissez ensuite le service et le fichier à transmettre.</p></article>
        </div>
        <div className="ipdf-sharing-guidance"><div><h3>Sécurité : préparer avant d’envoyer.</h3><p>Le traitement local évite de confier votre document original à un service d’IA pour le caviarder. Avant tout partage, vérifiez que vous êtes autorisé à transmettre les informations restantes, ainsi que les conditions de conservation et de réutilisation du service choisi.</p><p className="ipdf-small">La copie exportée est un PDF composé d’images. Le service destinataire doit prendre en charge leur lecture ou l’OCR pour en analyser le contenu.</p><a className="ipdf-textlink" href="https://www.cnil.fr/fr/les-questions-reponses-de-la-cnil-sur-lutilisation-dun-systeme-dia-generative">Les repères de la CNIL sur l’IA générative ↗</a></div><div><h3>RGPD : caviarder aide, anonymiser se vérifie.</h3><p>Le caviardage supprime les zones choisies. L’anonymisation vise à empêcher l’identification d’une personne, y compris par recoupement. Masquer les noms ne garantit donc pas, à lui seul, un document anonyme.</p><p>Des données pseudonymisées restent des données personnelles. Inklura PDF vous aide à réduire les informations divulguées ; il ne certifie ni l’anonymisation ni la conformité RGPD de votre partage.</p><a className="ipdf-textlink" href="https://www.cnil.fr/fr/lanonymisation-des-donnees-un-traitement-cle-pour-lopen-data">Comprendre l’anonymisation avec la CNIL ↗</a></div></div>
      </section>

      <Screencast />

      <section className="ipdf-start" aria-labelledby="start-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">VOTRE PREMIER PDF, EN TROIS ÉTAPES</p><h2 id="start-title">Importez. Vérifiez. Partagez.</h2></div><a className="ipdf-textlink" href="https://github.com/benfavre/caviard/blob/main/GUIDE.fr.md">Lire le guide de démarrage →</a></div>
        <ol><li><strong>Importez vos documents</strong><span>Un PDF ou plusieurs fichiers. Vos documents restent sur votre ordinateur.</span></li><li><strong>Choisissez les zones à masquer</strong><span>Dessinez vos rectangles ou utilisez l’assistant. Relisez chaque page et ajustez vos zones.</span></li><li><strong>Exportez une nouvelle copie</strong><span>Enregistrez le résultat, vérifiez-le puis partagez-le. Votre original reste intact.</span></li></ol>
      </section>

      <section className="ipdf-section" id="assistant" aria-labelledby="assistant-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">MOINS DE REPÉRAGE. PLUS DE CONTRÔLE.</p><h2 id="assistant-title">Un assistant local.<br />Trois façons de vous aider.</h2></div><p>L’assistant prépare les zones. Vous gardez la main sur chaque proposition et vérifiez chaque page avant d’exporter.</p></div>
        <div className="ipdf-features">
          <article><span className="ipdf-number">01</span><h3>Repérer les informations</h3><p>Recherchez les noms, adresses, organisations, e-mails, téléphones, IBAN et cartes bancaires. Sélectionnez les suggestions à ajouter à votre aperçu.</p></article>
          <article><span className="ipdf-number">02</span><h3>Appliquer une politique</h3><p>Choisissez les catégories à masquer pour préparer automatiquement le caviardage d’un document ou d’un lot. Relisez l’aperçu et annulez si nécessaire.</p></article>
          <article><span className="ipdf-number">03</span><h3>Donner une instruction</h3><p>Écrivez « masque les noms et les coordonnées ». L’assistant propose un plan de catégories que vous pouvez ajuster avant de lancer l’analyse.</p></article>
        </div>
        <div className="ipdf-assistant-preview">
          <div><p className="ipdf-eyebrow">DANS L’APPLICATION</p><h3>Du repérage<br />à la vérification.</h3><p>Le document occupe l’espace disponible. L’assistant défile dans son panneau latéral et l’export reste accessible. L’OCR local reconnaît les scans en français et en anglais.</p><p className="ipdf-small">L’IA et l’OCR peuvent manquer des informations ou proposer des zones trop larges. Votre relecture reste indispensable.</p><a className="ipdf-textlink" href="/inklura-pdf/assistant-v1.2.0.png">Voir la capture complète ↗</a></div>
          <a className="ipdf-screenshot" href="/inklura-pdf/assistant-v1.2.0.png" aria-label="Agrandir la capture de l’assistant local"><img src="/inklura-pdf/assistant-v1.2.0.png" alt="Inklura PDF 1.2.0 : espace de travail sur toute la fenêtre, document fictif et suggestions de l’assistant local dans le panneau latéral." width="1200" height="836" loading="lazy" /></a>
        </div>
      </section>

      <section className="ipdf-private" aria-labelledby="privacy-title"><div><p className="ipdf-eyebrow">LA CONFIDENTIALITÉ, EN PRATIQUE</p><h2 id="privacy-title">Votre PDF ne part<br />sur aucun serveur.</h2><PrivacyDiagram /></div><div><p>Le caviardage, l’analyse et l’OCR s’exécutent sur votre ordinateur. Le mode manuel fonctionne sans télécharger de modèles.</p><p>Pour activer l’assistant, l’application télécharge une fois environ <strong>1,18 Go de modèles</strong>. L’analyse fonctionne ensuite hors ligne. Les téléchargements de modèles et les recherches de mises à jour nécessitent Internet.</p><p>À l’export, Inklura PDF crée un <strong>nouveau PDF composé d’images</strong> : le contenu des zones choisies est supprimé, sans conserver le texte PDF, les annotations ou les pièces jointes de l’original. Le texte exporté n’est plus sélectionnable. Votre fichier original reste intact.</p><a className="ipdf-privacy-link" href="#securite">Comprendre l’export et le traitement des métadonnées ↓</a></div></section>

      <TechnicalDetails />

      <section className="ipdf-offers" id="offres" aria-labelledby="offers-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">20 PDF POUR ESSAYER · DES OFFRES POUR CONTINUER</p><h2 id="offers-title">Choisissez selon<br />votre activité.</h2></div><p>Achats ouverts en France métropolitaine. TVA 20 %. Connectez-vous dans l’application, puis ouvrez « Offres et crédits ».</p></div>
        <div className="ipdf-features">
          <article><h3>Essai gratuit</h3><p>20 PDF par compte Inklura, une seule fois. Importez, analysez et préparez vos caviardages librement. Un crédit est consommé après chaque export enregistré.</p><a className="ipdf-textlink" href="#telecharger">Télécharger et essayer →</a></article>
          <article><h3>Volume · 12 mois</h3><p><strong>100 PDF</strong> · 29 € HT / 34,80 € TTC</p><p><strong>500 PDF</strong> · 99 € HT / 118,80 € TTC</p><p><strong>1 000 PDF</strong> · 149 € HT / 178,80 € TTC</p><p>Packs cumulables, valables 12 mois et rattachés à un compte.</p></article>
          <article><h3>Entreprise · par mois</h3><p><strong>20 PDF</strong> · 4,90 € HT / 5,88 € TTC</p><p><strong>100 PDF</strong> · 14,90 € HT / 17,88 € TTC</p><p><strong>500 PDF</strong> · 39,90 € HT / 47,88 € TTC</p><p>Par mois et par compte, sans report. Résiliation pour la prochaine échéance.</p></article>
        </div><p className="ipdf-small">Vos PDF restent locaux. La connexion, les crédits et le paiement nécessitent Internet. Les ventes hors France métropolitaine ne sont pas proposées. <a href="https://www.activ-communication.com/conditions-generales-de-ventes/">Conditions de vente d’ACTIV communication ↗</a></p>
      </section>

      <section className="ipdf-section" id="telecharger" aria-labelledby="download-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">PRÊT À COMMENCER ?</p><h2 id="download-title">Choisissez votre ordinateur.</h2></div><p>Inklura PDF {release.version} · 20 PDF d’essai.<br />Installateurs hébergés sur pdf.inklura.fr.</p></div>
        <div className="ipdf-downloads">{platforms.map((platform) => {
          const file = asset(platform.suffix);
          return <article id={platform.id}><span className="ipdf-os" aria-hidden="true">{platform.mark}</span><h3>{platform.label}</h3><p>{platform.detail}</p><a className="ipdf-primary" href={file.url} download={file.name} aria-label={"Télécharger Inklura PDF pour " + platform.label}>Télécharger <span aria-hidden="true">↓</span></a><small>{platform.format} · {Math.round(file.size / 1000000)} Mo</small></article>;
        })}</div>
        <div className="ipdf-install"><h3>Installation & mises à jour</h3><p><strong>Windows :</strong> ouvrez le fichier .exe et suivez l’installation. <strong>macOS :</strong> ouvrez le .dmg et glissez Inklura PDF dans Applications. <strong>Linux :</strong> autorisez l’exécution de l’AppImage dans les propriétés du fichier, puis ouvrez-la.</p><p>Cette version n’est pas encore signée : Windows ou macOS peut afficher un avertissement ou bloquer l’ouverture. Les mises à jour intégrées sont disponibles sur Windows et Linux. Sur macOS, téléchargez les nouvelles versions depuis cette page.</p><p className="ipdf-small">Pour l’assistant local : prévoyez l’espace pour les modèles (1,18 Go) ; 8 Go de mémoire vive sont conseillés. La durée d’analyse dépend de votre ordinateur et du document.</p></div>
        <div className="ipdf-download-foot"><a href={"/downloads/inklura-pdf/" + release.version + "/SHA256SUMS.txt"}>Vérifier les empreintes SHA-256 ↗</a><a href={release.releaseUrl}>Notes de version ↗</a><a href="https://github.com/benfavre/caviard">Code source ↗</a></div>
      </section>

      <section className="ipdf-examples" id="exemples"><div><p className="ipdf-eyebrow">ESSAYEZ AVEC DES DONNÉES FICTIVES</p><h2>171 PDF pour prendre la main.</h2><p>Des documents synthétiques pour explorer le caviardage, les scans, les rotations et l’assistant local.</p></div><div><a href={asset("example-pdfs.zip").url} download="example-pdfs.zip">159 PDF d’exemple <span>ZIP · 533 Ko ↓</span></a><a href={asset("inklura-ai-example-pdfs.zip").url} download="inklura-ai-example-pdfs.zip">12 exemples IA & OCR <span>ZIP · 360 Ko ↓</span></a></div></section>
      <section className="ipdf-faq" aria-labelledby="faq-title"><h2 id="faq-title">Quelques réponses avant de commencer.</h2>
        <details><summary>Puis-je utiliser l’application sans IA ?</summary><p>Oui. Importez un PDF, dessinez vos rectangles de caviardage, vérifiez les pages et exportez. Le téléchargement des modèles est facultatif.</p></details>
        <details><summary>Les zones noires cachent-elles seulement le texte ?</summary><p>L’export reconstruit les pages en images avec les zones choisies caviardées. Le texte PDF d’origine n’est pas intégré dans le nouveau fichier. Vérifiez néanmoins toutes les pages : une information non sélectionnée restera visible.</p></details>
        <details><summary>Est-ce que cela fonctionne sur les PDF scannés ?</summary><p>Oui, le caviardage manuel fonctionne sur les scans. L’assistant propose aussi un OCR local français et anglais, avec des essais de rotation pour les scans de travers. Sa précision dépend de la lisibilité du document.</p></details>
        <details><summary>Quel fichier choisir pour mon Mac ?</summary><p>Ouvrez le menu Apple, puis « À propos de ce Mac ». Une puce Apple (M1, M2, M3…) correspond au téléchargement Apple Silicon. Un processeur Intel correspond au téléchargement Mac Intel.</p></details>
        <details><summary>Comment obtenir de l’aide ou signaler un problème ?</summary><p>Consultez le <a href="https://github.com/benfavre/caviard/blob/main/GUIDE.fr.md">guide de démarrage</a> ou <a href="https://github.com/benfavre/caviard/issues/new/choose">ouvrez un signalement sur GitHub</a> avec votre système, la version de l’application et les étapes pour reproduire le problème. Utilisez un PDF fictif : les signalements sont publics.</p></details>
        <details><summary>Faut-il un compte Inklura ?</summary><p>Oui, un compte Inklura et une connexion Internet sont nécessaires pour exporter. Le compte inclut 20 PDF d’essai, une seule fois. Vous pouvez ensuite acheter un pack ou un abonnement depuis l’application. Aucun document PDF n’est envoyé au service de facturation.</p></details>
      </section>
    </div>
    <script src="/inklura-pdf/demos.js?v=20260924-editor-1" defer />
  </main>;
}
