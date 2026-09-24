import { Icon } from "./icons";

export function RedactionDemo(): any {
  return <div className="ipdf-lab" aria-label="Simulation interactive de l’éditeur Inklura PDF">
    <div className="ipdf-lab-top"><span><i /> DÉMO INTERACTIVE</span><span>Essayez sur un document fictif</span></div>
    <div className="ipdf-app-header"><span className="ipdf-app-logo"><img src="/inklura-pdf/app-icon.svg" width="30" height="30" alt="" /><strong>Inklura<span>.</span></strong></span><span className="ipdf-app-breadcrumb">PDF <span>/</span> Caviardage</span><span className="ipdf-app-local"><i /> Sur votre appareil</span></div>
    <div className="ipdf-app-file"><Icon name="fileText" size={16} /><strong>proposition-fictive.pdf</strong><span>1 page</span><span className="ipdf-demo-edit-state" data-demo-state>Document fictif</span></div>
    <div className="ipdf-app-toolbar"><span className="ipdf-app-pagination">Page <b>1</b> / 1</span><div className="ipdf-demo-history" hidden><button type="button" data-demo-undo disabled title="Annuler la dernière modification"><span aria-hidden="true">↶</span> Annuler</button><button type="button" data-demo-redo disabled title="Rétablir la dernière modification"><span aria-hidden="true">↷</span><span className="ipdf-redo-label"> Rétablir</span></button><button type="button" data-demo-clear><Icon name="trash" size={13} /><span>Tout effacer</span></button></div><button type="button" className="ipdf-replay" data-demo-replay hidden title="Rejouer l’animation de caviardage"><Icon name="rotate" size={13} /><span>Animer</span></button></div>
    <div className="ipdf-app-hint"><Icon name="pen" size={13} /><span>Cliquez sur une coordonnée pour la masquer ou la révéler.</span></div>
    <div className="ipdf-editor-main">
      <aside className="ipdf-demo-pages" aria-label="Pages du document fictif"><span>PAGES <b>1</b></span><div className="ipdf-demo-thumbnail"><Icon name="fileText" size={25} /><strong>Page 1</strong><small data-demo-thumbnail>Fictif</small></div></aside>
      <div className="ipdf-demo-workspace"><div className="ipdf-demo-sheet">
    <svg className="ipdf-document-svg" viewBox="0 0 480 550" role="img" aria-labelledby="demo-svg-title demo-svg-desc">
      <title id="demo-svg-title">Illustration interactive du caviardage</title>
      <desc id="demo-svg-desc">Un contrat fictif. Les cases à cocher masquent le nom, l’e-mail et l’IBAN. Le projet et le montant restent visibles. Les coordonnées peuvent être masquées avec les cases du panneau de sélection. Cette simulation ne traite aucun PDF.</desc>
      <defs><linearGradient id="demo-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#146bff" stop-opacity="0" /><stop offset="1" stop-color="#146bff" stop-opacity=".12" /></linearGradient></defs>
      <rect width="480" height="550" fill="white" />
      <g font-family="Inter, sans-serif" fill="#172c48">
        <text x="46" y="44" font-size="9" fill="#70839d" letter-spacing="2">ATELIER HORIZON</text><text x="414" y="44" font-size="9" fill="#70839d">01</text>
        <text x="46" y="89" font-size="25" font-weight="700" letter-spacing="-1">Proposition de mission</text>
        <text x="46" y="112" font-size="10" fill="#70839d">DOCUMENT FICTIF · ACCOMPAGNEMENT &amp; CONSEIL</text>
        <path d="M46 134H434M46 285H434" stroke="#e5ebf4" />
        <g font-size="11" fill="#70839d"><text x="46" y="165">Client</text><text x="46" y="199">E-mail</text><text x="46" y="233">IBAN</text><text x="46" y="267">Projet</text></g>
        <g font-size="12"><text x="150" y="165">Camille Martin</text><text x="150" y="199">camille@example.fr</text><text x="150" y="233">FR00 0000 0000 0000 0000 0000 000</text><text x="150" y="267">Accompagnement &amp; conseil</text></g>
        <text x="46" y="320" font-size="11" fill="#70839d">Montant de la mission</text><text x="322" y="320" font-size="19" font-weight="700">1 200 € HT</text>
        <text x="46" y="377" font-size="11">Mission de conception et de suivi de projet.</text>
        <path d="M46 404H400M46 422H418M46 440H340" stroke="#edf0f4" stroke-width="4"/>
        <text x="46" y="508" font-size="9" fill="#8591a2">DONNÉES FICTIVES · DOCUMENT DE DÉMONSTRATION</text>
      </g>
      <g className="ipdf-svg-masks" fill="#172333"><rect className="mask-name" x="146" y="150" width="136" height="20" rx="2" /><rect className="mask-email" x="146" y="184" width="174" height="20" rx="2" /><rect className="mask-bank" x="146" y="218" width="286" height="20" rx="2" /></g>
      <g className="ipdf-scanner" aria-hidden="true"><rect x="21" y="15" width="438" height="62" fill="url(#demo-scan)" /><path d="M21 77H459" stroke="#146bff" stroke-width="1.5" /></g>
    </svg>
        <label className="ipdf-doc-hit hit-name" for="demo-name" title="Masquer ou révéler le nom"><span className="ipdf-sr">Nom</span></label>
        <label className="ipdf-doc-hit hit-email" for="demo-email" title="Masquer ou révéler l’e-mail"><span className="ipdf-sr">E-mail</span></label>
        <label className="ipdf-doc-hit hit-bank" for="demo-bank" title="Masquer ou révéler l’IBAN"><span className="ipdf-sr">IBAN</span></label>
      </div></div>
      <details className="ipdf-demo-assistant" open><summary><Icon name="sparkles" size={15} /><span>Sélections</span><Icon name="chevronDown" size={13} /></summary><div className="ipdf-demo-selection"><strong>Informations à masquer</strong><p>Activez ou désactivez les zones de cet exemple.</p><fieldset className="ipdf-demo-options"><legend className="ipdf-sr">Informations à masquer dans l’illustration</legend>
        <label><input type="checkbox" id="demo-name" aria-label="Nom" checked /><span><strong>Camille Martin</strong><small>Nom</small></span></label>
        <label><input type="checkbox" id="demo-email" aria-label="E-mail" checked /><span><strong>camille@example.fr</strong><small>E-mail</small></span></label>
        <label><input type="checkbox" id="demo-bank" aria-label="IBAN" checked /><span><strong>FR00 0000…</strong><small>IBAN</small></span></label>
      </fieldset><p className="ipdf-demo-selection-note"><Icon name="eye" size={14} /> Vous gardez la main sur chaque zone.</p></div></details>
    </div>
    <div className="ipdf-app-export"><div><strong data-demo-count aria-live="polite" aria-atomic="true">Votre sélection · 1 document</strong><span>Simulation de l’interface · aucun fichier envoyé.</span></div><a href="#demonstration"><Icon name="eye" size={14} /> Voir la vidéo</a></div>
    <div className="ipdf-demo-bottom-note"><Icon name="lock" size={12} /><span>Dans l’application : un PDF exporté sans métadonnées documentaires.</span></div>
  </div>;
}

export function Screencast(): any {
  return <section className="ipdf-section ipdf-cinema" id="demonstration" aria-labelledby="demo-title">
    <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">VOIR AVANT D’INSTALLER</p><h2 id="demo-title">Un PDF. Quelques gestes.<br />Une copie prête à partager.</h2></div><p>Une capture réelle de l’interface de caviardage manuel, avec un document fictif. Lancez la vidéo et suivez chaque étape.</p></div>
    <div className="ipdf-film-layout"><div className="ipdf-film">
      <div className="ipdf-film-bar"><span><i /><i /><i /></span><span>Inklura PDF · caviardage manuel</span><span>CAPTURE RÉELLE</span></div>
      <video id="ipdf-screencast" controls playsInline preload="none" poster="/inklura-pdf/demos/manual-poster.jpg" width="1280" height="900" aria-label="Démonstration du caviardage manuel, sans audio" aria-describedby="screencast-description">
        <source src="/inklura-pdf/demos/manual-workflow.mp4" type="video/mp4" />
        <track kind="captions" src="/inklura-pdf/demos/manual-fr.vtt" srcLang="fr" label="Français" default />
        <p><a href="/inklura-pdf/demos/manual-workflow.mp4">Télécharger la démonstration vidéo</a></p>
      </video>
    </div><div className="ipdf-chapters"><p className="ipdf-eyebrow">LE PARCOURS, PAS À PAS</p>
      <a href="#ipdf-screencast" data-video-time="0"><span>01</span><div><strong>Importer</strong><p>Ouvrir le PDF dans l’espace de travail.</p></div><small>00:00</small></a>
      <a href="#ipdf-screencast" data-video-time="5"><span>02</span><div><strong>Sélectionner</strong><p>Dessiner les rectangles sur les coordonnées.</p></div><small>00:05</small></a>
      <a href="#ipdf-screencast" data-video-time="13"><span>03</span><div><strong>Vérifier</strong><p>Annuler une zone, puis ajuster la sélection.</p></div><small>00:13</small></a>
      <a href="#ipdf-screencast" data-video-time="19"><span>04</span><div><strong>Exporter</strong><p>Créer une nouvelle copie caviardée.</p></div><small>00:19</small></a>
      <p className="ipdf-small" id="screencast-description">Vidéo sans audio, sous-titrée. Capture de l’interface web du projet ; dans l’application de bureau, l’export nécessite un compte et des crédits.</p>
    </div></div>
    <details className="ipdf-transcript"><summary>Lire la description de la démonstration</summary><p>Un document fictif est importé. Trois rectangles sont dessinés sur le nom, l’e-mail et le téléphone. La dernière sélection est annulée, puis redessinée. Le projet et le montant restent visibles. Le bouton « Exporter le PDF » télécharge une nouvelle copie composée d’images avec les zones sélectionnées caviardées.</p></details>
    <div className="ipdf-demo-files"><span>Reproduisez les mêmes gestes.</span><a href="/inklura-pdf/demos/document-fictif.pdf" download>Le PDF fictif ↓</a><a href="/inklura-pdf/demos/document-caviarde.pdf" download>Le résultat caviardé ↓</a></div>
  </section>;
}

export function PrivacyDiagram(): any {
  return <div className="ipdf-local-diagram">
    <svg viewBox="0 0 400 190" role="img" aria-labelledby="local-diagram-title">
      <title id="local-diagram-title">Le document, la sélection et la nouvelle copie sont traités sur votre ordinateur.</title>
      <defs><linearGradient id="local-glow"><stop stop-color="#76adff" stop-opacity=".22"/><stop offset="1" stop-color="#76adff" stop-opacity=".02"/></linearGradient></defs>
      <rect x="10" y="12" width="380" height="164" rx="16" fill="url(#local-glow)" stroke="#6380a8" stroke-dasharray="4 5" />
      <g font-family="Inter, sans-serif" font-size="11" fill="#dbeaff" text-anchor="middle"><text x="200" y="40" letter-spacing="2" font-size="9">SUR VOTRE ORDINATEUR</text><text x="78" y="148">Original intact</text><text x="200" y="148">Vos sélections</text><text x="322" y="148">Nouvelle copie</text></g>
      <path className="ipdf-flow-path" d="M105 92H170M230 92H295" fill="none" stroke="#88baff" stroke-width="2" stroke-dasharray="5 7" />
      <g fill="#173656" stroke="#9ac4ff" stroke-width="1.5"><rect x="58" y="65" width="40" height="51" rx="5"/><rect x="180" y="65" width="40" height="51" rx="5"/><rect x="302" y="65" width="40" height="51" rx="5"/></g>
      <path d="M68 79H87M68 88H87M68 97H81M190 79H210M312 79H332" stroke="#d5e7ff" stroke-width="2"/>
      <rect x="188" y="86" width="24" height="16" rx="2" fill="none" stroke="#8bbbff" stroke-dasharray="3 2"/><rect x="310" y="86" width="24" height="16" rx="2" fill="#020e20" />
    </svg>
    <p>Le document reste local, du début à la fin.</p>
  </div>;
}
