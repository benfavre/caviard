export function RedactionDemo(): any {
  return <div className="ipdf-lab">
    <div className="ipdf-lab-top"><span><i /> DÉMO INTERACTIVE</span><span>100 % fictif</span></div>
    <div className="ipdf-lab-heading"><strong>À vous de choisir.</strong><p>Cochez les informations à masquer.</p></div>
    <fieldset className="ipdf-demo-options"><legend className="ipdf-sr">Informations à masquer dans l’illustration</legend>
      <label><input type="checkbox" id="demo-name" checked /> Nom</label>
      <label><input type="checkbox" id="demo-email" checked /> E-mail</label>
      <label><input type="checkbox" id="demo-bank" checked /> IBAN</label>
    </fieldset>
    <svg className="ipdf-document-svg" viewBox="0 0 480 374" role="img" aria-labelledby="demo-svg-title demo-svg-desc">
      <title id="demo-svg-title">Illustration interactive du caviardage</title>
      <desc id="demo-svg-desc">Un contrat fictif. Les cases à cocher masquent le nom, l’e-mail et l’IBAN. Le projet et le montant restent visibles. Cette illustration ne traite aucun PDF.</desc>
      <defs><linearGradient id="demo-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#146bff" stop-opacity="0" /><stop offset="1" stop-color="#146bff" stop-opacity=".12" /></linearGradient></defs>
      <rect x="20" y="10" width="440" height="350" rx="8" fill="white" stroke="#dce5f2" />
      <g font-family="Inter, sans-serif" fill="#172c48">
        <text x="46" y="44" font-size="9" fill="#70839d" letter-spacing="2">ATELIER HORIZON</text><text x="414" y="44" font-size="9" fill="#70839d">01</text>
        <text x="46" y="89" font-size="25" font-weight="700" letter-spacing="-1">Proposition de mission</text>
        <text x="46" y="112" font-size="10" fill="#70839d">DOCUMENT FICTIF · ACCOMPAGNEMENT &amp; CONSEIL</text>
        <path d="M46 134H434M46 285H434" stroke="#e5ebf4" />
        <g font-size="11" fill="#70839d"><text x="46" y="165">Client</text><text x="46" y="199">E-mail</text><text x="46" y="233">IBAN</text><text x="46" y="267">Projet</text></g>
        <g font-size="12"><text x="150" y="165">Camille Martin</text><text x="150" y="199">camille@example.fr</text><text x="150" y="233">FR00 0000 0000 0000 0000 0000 000</text><text x="150" y="267">Accompagnement &amp; conseil</text></g>
        <text x="46" y="320" font-size="11" fill="#70839d">Montant de la mission</text><text x="322" y="320" font-size="19" font-weight="700">1 200 € HT</text>
      </g>
      <g className="ipdf-svg-masks" fill="#172333"><rect className="mask-name" x="146" y="150" width="136" height="20" rx="2" /><rect className="mask-email" x="146" y="184" width="174" height="20" rx="2" /><rect className="mask-bank" x="146" y="218" width="286" height="20" rx="2" /></g>
      <g className="ipdf-scanner" aria-hidden="true"><rect x="21" y="15" width="438" height="62" fill="url(#demo-scan)" /><path d="M21 77H459" stroke="#146bff" stroke-width="1.5" /></g>
    </svg>
    <div className="ipdf-lab-foot"><span>↳ L’essentiel reste lisible.</span><button type="button" className="ipdf-replay" data-demo-replay hidden>Rejouer ↻</button></div>
    <p className="ipdf-demo-caption">Illustration du résultat · aucun fichier importé ou envoyé.</p>
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
