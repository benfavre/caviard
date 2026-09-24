export const revalidate = 600;

export default function PricingPage(): any {
  return <main className="ipdf ipdf-pricing-page" id="contenu" tabIndex={-1}>
    <link rel="stylesheet" href="/inklura-pdf/page.css?v=20260924-pricing-1" />
    <div className="ipdf-wrap">
      <a className="ipdf-textlink" href="/">← Découvrir Inklura PDF</a>
      <section className="ipdf-offers" id="offres" aria-labelledby="offers-title">
        <div className="ipdf-section-head"><div><p className="ipdf-eyebrow">20 PDF POUR ESSAYER · DES OFFRES POUR CONTINUER</p><h1 id="offers-title">Choisissez une offre<br />adaptée à votre activité.</h1></div><p>Les offres sont disponibles à l’achat en France métropolitaine. TVA : 20 %. Connectez-vous dans l’application, puis ouvrez « Offres et crédits ».</p></div>
        <div className="ipdf-features">
          <article><h3>Essai gratuit</h3><p>20 PDF par compte Inklura, une seule fois. Importez, analysez et préparez vos caviardages librement. Un crédit est consommé après chaque export enregistré.</p><a className="ipdf-textlink" href="/#telecharger">Télécharger et essayer →</a></article>
          <article><h3>Volume · 12 mois</h3><p><strong>100 PDF</strong> · 29 € HT / 34,80 € TTC</p><p><strong>500 PDF</strong> · 99 € HT / 118,80 € TTC</p><p><strong>1 000 PDF</strong> · 149 € HT / 178,80 € TTC</p><p>Packs cumulables, valables 12 mois et rattachés à un compte.</p></article>
          <article><h3>Entreprise · par mois</h3><p><strong>20 PDF</strong> · 4,90 € HT / 5,88 € TTC</p><p><strong>100 PDF</strong> · 14,90 € HT / 17,88 € TTC</p><p><strong>500 PDF</strong> · 39,90 € HT / 47,88 € TTC</p><p>Par mois et par compte, sans report. Résiliation pour la prochaine échéance.</p></article>
        </div><p className="ipdf-small">Vos PDF restent locaux. La connexion, les crédits et le paiement nécessitent Internet. Les ventes hors France métropolitaine ne sont pas proposées. <a href="https://www.activ-communication.com/conditions-generales-de-ventes/">Conditions de vente d’ACTIV communication ↗</a></p>
      </section>

      <section className="ipdf-faq" aria-labelledby="pricing-faq-title"><h2 id="pricing-faq-title">Comment fonctionnent les crédits ?</h2>
        <details><summary>Quand un crédit est-il consommé ?</summary><p>Un crédit est consommé après chaque export enregistré. Vous pouvez importer vos documents et préparer les zones à masquer avant de les exporter.</p></details>
        <details><summary>Comment acheter un pack ou un abonnement ?</summary><p>Connectez-vous à votre compte dans l’application, puis ouvrez « Offres et crédits ». Les crédits sont rattachés à votre compte Inklura.</p></details>
        <details><summary>Quelle est la durée de validité des crédits ?</summary><p>Les packs Volume sont valables 12 mois et peuvent être cumulés. Les abonnements Entreprise donnent droit à un nombre de PDF par mois, sans report des crédits inutilisés. La résiliation prend effet à la prochaine échéance.</p></details>
      </section>
    </div>
    <script src="/inklura-pdf/demos.js?v=20260924-pricing-1" defer />
  </main>;
}
