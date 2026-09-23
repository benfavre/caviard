import release from "../../lib/inklura-pdf-release.json";

export const revalidate = 600;
const previewVersion = "1.2.0-beta.1";
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
  return <main className="ipdf">
    <link rel="stylesheet" href="/inklura-pdf/page.css?v=1.1.0-3" />
    <div className="ipdf-wrap">
      <a className="ipdf-back" href="/">← Tous les outils Inklura</a>
      <section className="ipdf-hero" aria-labelledby="ipdf-title">
        <div>
          <div className="ipdf-eyebrow"><span /> INKLURA PDF · ESSAI GRATUIT</div>
          <h1 id="ipdf-title">Partagez l’essentiel.<br /><em>Gardez le reste<br />pour vous.</em></h1>
          <p className="ipdf-lead">Caviardez vos PDF sur votre ordinateur. Masquez les informations sensibles à la main, ou préparez vos caviardages avec une IA qui travaille en local.</p>
          <div className="ipdf-actions"><a className="ipdf-primary" href="#telecharger">Télécharger Inklura PDF <span aria-hidden="true">↓</span></a><a className="ipdf-textlink" href="#assistant">Découvrir l’assistant →</a></div>
          <p className="ipdf-meta">Windows, macOS et Linux · Version d’évaluation {release.version}</p>
        </div>
        <div className="ipdf-demo" aria-label="Illustration du caviardage d’un document fictif">
          <div className="ipdf-demo-bar"><span className="ipdf-demo-dot" /> contrat-client.pdf <span>Sur votre appareil</span></div>
          <div className="ipdf-paper">
            <div className="ipdf-paper-top">DOCUMENT DE DÉMONSTRATION <span>01 / 01</span></div>
            <h2>Un document prêt<br />à être partagé.</h2>
            <div className="ipdf-line">Client <span className="ipdf-redacted" aria-label="Nom masqué" /></div>
            <div className="ipdf-line">E-mail <span className="ipdf-redacted ipdf-long" aria-label="E-mail masqué" /></div>
            <div className="ipdf-line">Projet <span>Accompagnement & conseil</span></div>
            <div className="ipdf-line">IBAN <span className="ipdf-redacted ipdf-long" aria-label="IBAN masqué" /></div>
            <div className="ipdf-rule" /><p>Les informations utiles restent visibles.<br />Les zones choisies sont caviardées à l’export.</p>
            <div className="ipdf-paper-stamp">✓ Une nouvelle copie. L’original intact.</div>
          </div>
          <div className="ipdf-demo-bottom"><span>3 zones sélectionnées</span><strong>Exporter le PDF ↗</strong></div>
        </div>
      </section>
      <div className="ipdf-trust"><span>◎ <strong>Vos documents restent chez vous</strong></span><span>↶ Modifications annulables</span><span>▤ PDF numériques & scans</span><span>✦ IA locale optionnelle</span></div>

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
          <div><p className="ipdf-eyebrow">DANS L’APPLICATION</p><h3>Du repérage<br />à la vérification.</h3><p>L’OCR local reconnaît le texte des scans en français et en anglais. Les suggestions restent visibles avant leur ajout aux zones de caviardage.</p><p className="ipdf-small">L’IA et l’OCR peuvent manquer des informations ou proposer des zones trop larges. Votre relecture reste indispensable.</p><a className="ipdf-textlink" href="/inklura-pdf/assistant-v1.1.0.png">Voir la capture complète ↗</a></div>
          <a className="ipdf-screenshot" href="/inklura-pdf/assistant-v1.1.0.png" aria-label="Agrandir la capture de l’assistant local"><img src="/inklura-pdf/assistant-v1.1.0.png" alt="Inklura PDF : choix des catégories, OCR français et anglais et liste des informations suggérées dans un document fictif." width="1185" height="1932" loading="lazy" /></a>
        </div>
      </section>

      <section className="ipdf-private" aria-labelledby="privacy-title"><div><p className="ipdf-eyebrow">LA CONFIDENTIALITÉ, EN PRATIQUE</p><h2 id="privacy-title">Votre PDF ne part<br />sur aucun serveur.</h2></div><div><p>Le caviardage, l’analyse et l’OCR s’exécutent sur votre ordinateur. Le mode manuel fonctionne sans télécharger de modèles.</p><p>Pour activer l’assistant, l’application télécharge une fois environ <strong>1,18 Go de modèles</strong>. L’analyse fonctionne ensuite hors ligne. Les téléchargements de modèles et les recherches de mises à jour nécessitent Internet.</p><p>À l’export, Inklura PDF crée un <strong>nouveau PDF composé d’images</strong> : le contenu des zones choisies est supprimé, sans conserver le texte PDF, les annotations ou les pièces jointes de l’original. Le texte exporté n’est plus sélectionnable. Votre fichier original reste intact.</p></div></section>

      <section className="ipdf-offers" id="offres" aria-labelledby="offers-title"><div className="ipdf-section-head"><div><p className="ipdf-eyebrow">ESSAYER AUJOURD’HUI · CHOISIR SON OFFRE DEMAIN</p><h2 id="offers-title">Un essai pour découvrir.<br />Des offres pour votre activité.</h2></div><p>Les offres professionnelles Inklura sont en préparation. Aucun achat n’est proposé pour le moment.</p></div><div className="ipdf-features"><article><h3>Essai gratuit</h3><p>Découvrez le caviardage et l’assistant local avec la version d’évaluation disponible ci-dessous.</p></article><article><h3>Offre Volume · à venir</h3><p>100 PDF : 29 € HT · 500 PDF : 99 € HT · 1 000 PDF : 149 € HT. Packs valables 12 mois, cumulables et rattachés à un compte Inklura.</p></article><article><h3>Offre Entreprise · à venir</h3><p>20 PDF : 4,90 € HT/mois · 100 PDF : 14,90 € HT/mois · 500 PDF : 39,90 € HT/mois. Par compte, sans report des crédits mensuels, résiliable pour la prochaine échéance.</p></article></div><p className="ipdf-small">La version stable {release.version} reste une évaluation sans quota. La préversion {previewVersion} inclut 20 PDF d’essai par compte, avec un crédit consommé par export réussi. Ces tarifs HT sont validés ; les taxes applicables seront précisées lors de l’ouverture des achats. Les PDF resteront locaux et le suivi des crédits nécessitera Internet.</p></section>

      <section className="ipdf-section" id="telecharger" aria-labelledby="download-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">PRÊT À COMMENCER ?</p><h2 id="download-title">Choisissez votre ordinateur.</h2></div><p>Inklura PDF {release.version} · Essai gratuit.<br />Installateurs hébergés sur outils.inklura.fr.</p></div>
        <div className="ipdf-downloads">{platforms.map((platform) => {
          const file = asset(platform.suffix);
          return <article id={platform.id}><span className="ipdf-os" aria-hidden="true">{platform.mark}</span><h3>{platform.label}</h3><p>{platform.detail}</p><a className="ipdf-primary" href={file.url} download={file.name} aria-label={"Télécharger Inklura PDF pour " + platform.label}>Télécharger <span aria-hidden="true">↓</span></a><small>{platform.format} · {Math.round(file.size / 1000000)} Mo</small></article>;
        })}</div>
        <div className="ipdf-install"><h3>Installation & mises à jour</h3><p><strong>Windows :</strong> ouvrez le fichier .exe et suivez l’installation. <strong>macOS :</strong> ouvrez le .dmg et glissez Inklura PDF dans Applications. <strong>Linux :</strong> autorisez l’exécution de l’AppImage dans les propriétés du fichier, puis ouvrez-la.</p><p>Cette version n’est pas encore signée : Windows ou macOS peut afficher un avertissement ou bloquer l’ouverture. Les mises à jour intégrées sont disponibles sur Windows et Linux. Sur macOS, téléchargez les nouvelles versions depuis cette page.</p><p className="ipdf-small">Pour l’assistant local : prévoyez l’espace pour les modèles (1,18 Go) ; 8 Go de mémoire vive sont conseillés. La durée d’analyse dépend de votre ordinateur et du document.</p></div>
        <div className="ipdf-download-foot"><a href={"/downloads/inklura-pdf/" + release.version + "/SHA256SUMS.txt"}>Vérifier les empreintes SHA-256 ↗</a><a href={release.releaseUrl}>Notes de version ↗</a><a href="https://github.com/benfavre/caviard">Code source ↗</a></div>
      </section>

      <section className="ipdf-section" id="preversion" aria-labelledby="preview-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">POUR TESTER LA PROCHAINE VERSION</p><h2 id="preview-title">Un compte Inklura.<br />20 PDF d’essai.</h2></div><p>Préversion {previewVersion} · Connexion et suivi des crédits par Internet. Vos PDF restent sur votre ordinateur.</p></div>
        <p>Cette préversion demande une connexion Inklura pour exporter. Vous disposez de 20 PDF d’essai par compte, une seule fois ; un crédit est consommé après enregistrement réussi. Les achats restent fermés : à quota épuisé, les nouveaux exports sont bloqués mais votre travail reste ouvert.</p>
        <div className="ipdf-downloads">{platforms.map((platform) => {
          const name = "Inklura-PDF-" + previewVersion + "-" + platform.suffix;
          return <article><h3>{platform.label}</h3><p>{platform.detail}</p><a className="ipdf-primary" href={"/downloads/inklura-pdf/" + previewVersion + "/" + name} download={name} aria-label={"Télécharger la préversion pour " + platform.label}>Tester la préversion ↓</a></article>;
        })}</div>
        <p className="ipdf-small">Cette préversion n’est pas installée automatiquement sur la version stable. Une nouvelle connexion est nécessaire après fermeture de l’application. Les restrictions de signature ci-dessus s’appliquent également.</p>
        <div className="ipdf-download-foot"><a href={"/downloads/inklura-pdf/" + previewVersion + "/SHA256SUMS.txt"}>Empreintes de la préversion ↗</a><a href={"https://github.com/benfavre/caviard/releases/tag/v" + previewVersion}>Notes de la préversion ↗</a></div>
      </section>
      <section className="ipdf-examples" id="exemples"><div><p className="ipdf-eyebrow">ESSAYEZ AVEC DES DONNÉES FICTIVES</p><h2>171 PDF pour prendre la main.</h2><p>Des documents synthétiques pour explorer le caviardage, les scans, les rotations et l’assistant local.</p></div><div><a href={asset("example-pdfs.zip").url} download="example-pdfs.zip">159 PDF d’exemple <span>ZIP · 533 Ko ↓</span></a><a href={asset("inklura-ai-example-pdfs.zip").url} download="inklura-ai-example-pdfs.zip">12 exemples IA & OCR <span>ZIP · 360 Ko ↓</span></a></div></section>
      <section className="ipdf-faq" aria-labelledby="faq-title"><h2 id="faq-title">Quelques réponses avant de commencer.</h2>
        <details><summary>Puis-je utiliser l’application sans IA ?</summary><p>Oui. Importez un PDF, dessinez vos rectangles de caviardage, vérifiez les pages et exportez. Le téléchargement des modèles est facultatif.</p></details>
        <details><summary>Les zones noires cachent-elles seulement le texte ?</summary><p>L’export reconstruit les pages en images avec les zones choisies caviardées. Le texte PDF d’origine n’est pas intégré dans le nouveau fichier. Vérifiez néanmoins toutes les pages : une information non sélectionnée restera visible.</p></details>
        <details><summary>Est-ce que cela fonctionne sur les PDF scannés ?</summary><p>Oui, le caviardage manuel fonctionne sur les scans. L’assistant propose aussi un OCR local français et anglais, avec des essais de rotation pour les scans de travers. Sa précision dépend de la lisibilité du document.</p></details>
        <details><summary>Quel fichier choisir pour mon Mac ?</summary><p>Ouvrez le menu Apple, puis « À propos de ce Mac ». Une puce Apple (M1, M2, M3…) correspond au téléchargement Apple Silicon. Un processeur Intel correspond au téléchargement Mac Intel.</p></details>
        <details><summary>Comment obtenir de l’aide ou signaler un problème ?</summary><p>Consultez le <a href="https://github.com/benfavre/caviard/blob/main/GUIDE.fr.md">guide de démarrage</a> ou <a href="https://github.com/benfavre/caviard/issues/new/choose">ouvrez un signalement sur GitHub</a> avec votre système, la version de l’application et les étapes pour reproduire le problème. Utilisez un PDF fictif : les signalements sont publics.</p></details>
        <details><summary>Faut-il créer un compte Inklura ?</summary><p>La version stable d’évaluation {release.version} peut être essayée sans compte. La préversion {previewVersion} demande un compte Inklura pour exporter et inclut 20 PDF d’essai par compte. Les achats de packs et les abonnements sont encore fermés.</p></details>
      </section>
    </div>
  </main>;
}
