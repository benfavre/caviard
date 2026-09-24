/** Illustrations of the workflow, using fictitious data rather than app screenshots. */
export function SharingIllustration(): any {
  return <figure className="ipdf-sharing-art"><svg viewBox="0 0 680 470" role="img" aria-labelledby="sharing-art-title sharing-art-desc">
    <title id="sharing-art-title">Du document original à la copie à partager</title><desc id="sharing-art-desc">Un contrat fictif contient un nom et une adresse. Dans la copie, ces zones sont noires tandis que les clauses restent visibles. La vérification précède le partage.</desc>
    <defs><pattern id="sharing-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#146bff" opacity=".14" /></pattern></defs>
    <rect width="680" height="470" rx="28" fill="#edf4ff"/><rect width="680" height="470" rx="28" fill="url(#sharing-dots)"/>
    <circle cx="490" cy="245" r="170" fill="#dce9ff"/>
    <g transform="translate(42 58) rotate(-7 125 160)"><rect x="5" y="9" width="246" height="320" rx="10" fill="#173458" opacity=".07"/><rect width="246" height="320" rx="10" fill="white" stroke="#cbd9ee"/>
    <text x="24" y="34" fill="#7b8799" font-size="10" letter-spacing="2">ORIGINAL · FICTIF</text><text x="24" y="72" fill="#19324e" font-size="23" font-weight="700">Contrat de mission</text>
    <path d="M24 94H222" stroke="#dbe4ef"/><rect x="18" y="112" width="205" height="30" rx="4" fill="#ffe9dc"/><text x="26" y="132" fill="#9b4b27" font-size="14">Camille Martin</text><rect x="18" y="152" width="205" height="30" rx="4" fill="#ffe9dc"/><text x="26" y="172" fill="#9b4b27" font-size="12">12 rue des Lilas, Lyon</text>
    <text x="24" y="217" fill="#19324e" font-size="12" font-weight="700">Objet de la mission</text><path d="M24 235H218M24 248H205M24 261H216M24 274H174" stroke="#c0cddd" stroke-width="4"/></g>
    <path className="ipdf-transfer-line" d="M270 245C316 245 295 171 343 171" stroke="#146bff" stroke-width="3" stroke-dasharray="7 7" fill="none"/><path d="m334 163 11 8-11 8" fill="none" stroke="#146bff" stroke-width="3"/>
    <g transform="translate(355 78) rotate(5 125 160)"><rect x="5" y="9" width="246" height="320" rx="10" fill="#173458" opacity=".09"/><rect width="246" height="320" rx="10" fill="white" stroke="#a9c7f5"/>
    <text x="24" y="34" fill="#146bff" font-size="10" letter-spacing="2">COPIE CAVIARDÉE</text><text x="24" y="72" fill="#19324e" font-size="23" font-weight="700">Contrat de mission</text><path d="M24 94H222" stroke="#dbe4ef"/>
    <rect x="24" y="116" width="148" height="22" rx="2" fill="#17263b"/><rect x="24" y="156" width="191" height="22" rx="2" fill="#17263b"/>
    <text x="24" y="217" fill="#19324e" font-size="12" font-weight="700">Objet de la mission</text><path d="M24 235H218M24 248H205M24 261H216M24 274H174" stroke="#92acd0" stroke-width="4"/></g>
    <g transform="translate(233 396)"><rect width="221" height="40" rx="20" fill="#146bff"/><path d="m18 20 5 5 10-11" fill="none" stroke="white" stroke-width="2"/><text x="44" y="25" fill="white" font-size="12" font-weight="600">Relire avant de transmettre</text></g>
  </svg><figcaption>Les identités sont masquées. Le contexte restant doit aussi être vérifié.</figcaption></figure>;
}

export function ExportIllustration(): any {
  return <figure className="ipdf-export-art"><svg viewBox="0 0 960 180" role="img" aria-labelledby="export-art-title"><title id="export-art-title">Le fichier source est rendu en pixels, caviardé, puis reconstruit dans un nouveau PDF</title>
    <defs><pattern id="export-pixels" width="12" height="12" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="10" height="10" rx="1" fill="#aecbfa"/></pattern></defs>
    <g transform="translate(42 16)"><rect width="102" height="130" rx="7" fill="#fff" stroke="#a7bddc"/><path d="M19 27H80M19 40H74M19 64H82M19 77H77M19 101H65" stroke="#9bb1cd" stroke-width="5"/><text x="51" y="157" text-anchor="middle" fill="#7691b5" font-size="12">Source</text></g>
    <path d="M174 82H283m-9-7 9 7-9 7M420 82H531m-9-7 9 7-9 7M676 82H784m-9-7 9 7-9 7" fill="none" stroke="#639af0" stroke-width="2"/>
    <g transform="translate(309 16)"><rect width="90" height="130" rx="5" fill="url(#export-pixels)"/><text x="45" y="157" text-anchor="middle" fill="#7691b5" font-size="12">Pixels</text></g>
    <g transform="translate(559 16)"><rect width="90" height="130" rx="5" fill="url(#export-pixels)"/><rect x="0" y="30" width="78" height="24" fill="#15263f"/><rect x="0" y="78" width="90" height="24" fill="#15263f"/><text x="45" y="157" text-anchor="middle" fill="#7691b5" font-size="12">Zones supprimées</text></g>
    <g transform="translate(810 16)"><rect width="102" height="130" rx="7" fill="#fff" stroke="#146bff" stroke-width="2"/><path d="M19 27H80M19 77H77M19 101H65" stroke="#9bb1cd" stroke-width="5"/><path d="M19 45H80M19 62H70" stroke="#15263f" stroke-width="9"/><text x="51" y="157" text-anchor="middle" fill="#7691b5" font-size="12">Nouveau PDF</text></g>
  </svg></figure>;
}
