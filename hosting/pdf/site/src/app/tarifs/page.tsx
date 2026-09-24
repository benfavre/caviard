import { Icon } from "../../lib/icons";

export const revalidate = 600;
const packs = [
  { count: "100", ht: "29", ttc: "34,80", unit: "0,29" },
  { count: "500", ht: "99", ttc: "118,80", unit: "0,198" },
  { count: "1 000", ht: "149", ttc: "178,80", unit: "0,149" },
];
const subscriptions = [
  { count: "20", ht: "4,90", ttc: "5,88", unit: "0,245" },
  { count: "100", ht: "14,90", ttc: "17,88", unit: "0,149" },
  { count: "500", ht: "39,90", ttc: "47,88", unit: "0,0798" },
];

export default function PricingPage(): any {
  return <main className="ipdf ipdf-pricing-page" id="contenu" tabIndex={-1}>
    <link rel="stylesheet" href="/inklura-pdf/page.css?v=20260924-pricing-2" />
    <link rel="stylesheet" href="/inklura-pdf/pricing.css?v=20260924-1" />
    <div className="ipdf-wrap">
      <a className="ipdf-textlink" href="/">← Découvrir Inklura PDF</a>
      <section id="offres" aria-labelledby="offers-title">
        <div className="ipdf-price-intro"><div><p className="ipdf-eyebrow">TARIFS INKLURA PDF</p><h1 id="offers-title">Commencez avec 20 PDF.<br /><em>Continuez à votre rythme.</em></h1><p className="ipdf-price-lead">Un dossier ponctuel ou des documents à traiter chaque mois ? Choisissez des crédits à utiliser sur 12 mois ou un abonnement mensuel.</p></div><div className="ipdf-credit-visual" aria-label="Un crédit est consommé après chaque export enregistré"><span className="ipdf-credit-sheet" aria-hidden="true"><i /><i /><i /><b>PDF</b></span><div><strong>1 export <span>=</span> 1 crédit</strong><p>Le crédit est consommé lorsque<br />vous enregistrez le PDF exporté.</p></div></div></div>

        <article className="ipdf-free-offer"><div className="ipdf-free-amount"><strong>0 €</strong><span>ESSAI GRATUIT</span></div><div><h2>20 PDF pour essayer l’application</h2><p>Une seule fois par compte Inklura. Importez vos documents, essayez le caviardage et vérifiez vos premiers exports.</p></div><a className="ipdf-primary" href="/#telecharger">Télécharger et essayer <span aria-hidden="true">↓</span></a></article>

        <div className="ipdf-paid-offers">
          <article className="ipdf-price-card" aria-labelledby="pack-title"><div className="ipdf-plan-heading"><span className="ipdf-plan-icon" aria-hidden="true"><Icon name="fileText" size={24} /></span><span>POUR UN BESOIN PONCTUEL</span></div><h2 id="pack-title">Packs Volume</h2><p className="ipdf-plan-description">Un stock de crédits pour vos prochains dossiers.</p><div className="ipdf-plan-terms"><span>Valables 12 mois</span><span>Packs cumulables</span></div>
            <table><caption className="ipdf-sr">Prix des packs Volume, pour un achat</caption><thead><tr><th scope="col">PDF inclus</th><th scope="col">Prix du pack</th></tr></thead><tbody>{packs.map(plan => <tr><th scope="row"><strong>{plan.count}</strong> PDF<span>{plan.unit} € HT / PDF</span></th><td><strong>{plan.ht} € <small>HT</small></strong><span>{plan.ttc} € TTC</span></td></tr>)}</tbody></table>
            <a className="ipdf-plan-action" href="#acheter">Comment acheter un pack <span aria-hidden="true">→</span></a><p className="ipdf-plan-footnote">Les crédits sont rattachés à votre compte.</p>
          </article>
          <article className="ipdf-price-card ipdf-monthly-card" aria-labelledby="subscription-title"><div className="ipdf-plan-heading"><span className="ipdf-plan-icon" aria-hidden="true">↻</span><span>POUR UN USAGE RÉGULIER</span></div><h2 id="subscription-title">Abonnements Entreprise</h2><p className="ipdf-plan-description">Un nombre de PDF disponible chaque mois.</p><div className="ipdf-plan-terms"><span>Facturation mensuelle</span><span>Crédits sans report</span></div>
            <table><caption className="ipdf-sr">Prix des abonnements Entreprise, par mois et par compte</caption><thead><tr><th scope="col">PDF par mois</th><th scope="col">Prix mensuel</th></tr></thead><tbody>{subscriptions.map(plan => <tr><th scope="row"><strong>{plan.count}</strong> PDF<span>{plan.unit} € HT / PDF*</span></th><td><strong>{plan.ht} € <small>HT</small></strong><span>{plan.ttc} € TTC</span></td></tr>)}</tbody></table>
            <a className="ipdf-plan-action" href="#acheter">Comment souscrire <span aria-hidden="true">→</span></a><p className="ipdf-plan-footnote">Par compte. Résiliation à la prochaine échéance.</p>
          </article>
        </div>
        <div className="ipdf-price-notes"><p>* Coût par PDF si tous les crédits du mois sont utilisés.</p><p>Les offres sont disponibles à l’achat en France métropolitaine. TVA : 20 %. <a href="https://www.activ-communication.com/conditions-generales-de-ventes/">Consulter les conditions de vente ↗</a></p></div>
      </section>

      <section className="ipdf-included" aria-labelledby="included-title"><div><p className="ipdf-eyebrow">DANS TOUTES LES OFFRES</p><h2 id="included-title">Les mêmes outils<br />pour vos documents.</h2></div><ul><li><span aria-hidden="true">✓</span>Caviardage manuel et vérification des zones</li><li><span aria-hidden="true">✓</span>Assistant IA et reconnaissance de texte en local</li><li><span aria-hidden="true">✓</span>Export sans métadonnées documentaires</li><li><span aria-hidden="true">✓</span>Application pour Windows, macOS et Linux</li></ul><a className="ipdf-textlink" href="/#demonstration">Voir l’application en action ↗</a></section>

      <section className="ipdf-purchase" id="acheter" aria-labelledby="purchase-title"><div><p className="ipdf-eyebrow">DEPUIS L’APPLICATION</p><h2 id="purchase-title">Comment acheter des crédits ?</h2><p>Les packs et les abonnements se choisissent dans Inklura PDF.</p><a className="ipdf-textlink" href="/#telecharger">Télécharger l’application →</a></div><ol><li><span>01</span><div><h3>Connectez-vous à votre compte</h3><p>Ouvrez Inklura PDF et connectez-vous avec votre compte Inklura.</p></div></li><li><span>02</span><div><h3>Ouvrez « Offres et crédits »</h3><p>Choisissez un pack ou un abonnement selon le nombre de PDF à traiter.</p></div></li><li><span>03</span><div><h3>Procédez au paiement</h3><p>Les crédits achetés sont rattachés à votre compte pour vos prochains exports.</p></div></li></ol></section>

      <section className="ipdf-faq ipdf-pricing-faq" aria-labelledby="pricing-faq-title"><div><p className="ipdf-eyebrow">QUESTIONS FRÉQUENTES</p><h2 id="pricing-faq-title">Quelques précisions<br />sur les crédits.</h2></div><div>
        <details><summary>Quand un crédit est-il consommé ?</summary><p>Un crédit est consommé après chaque export enregistré. Vous pouvez importer vos documents et préparer les zones à masquer avant de les exporter.</p></details>
        <details><summary>Quelle offre choisir ?</summary><p>Un pack permet de répartir vos exports sur 12 mois, selon vos besoins. Un abonnement convient à un usage régulier : les crédits sont disponibles chaque mois et les crédits inutilisés ne sont pas reportés.</p></details>
        <details><summary>Les packs peuvent-ils être cumulés ?</summary><p>Oui. Les packs Volume sont cumulables et valables 12 mois. Les crédits sont rattachés à votre compte Inklura.</p></details>
        <details><summary>Quand la résiliation prend-elle effet ?</summary><p>La résiliation prend effet à la prochaine échéance. Les crédits mensuels inutilisés ne sont pas reportés.</p></details>
        <details><summary>Faut-il une connexion Internet ?</summary><p>La connexion au compte, la gestion des crédits et le paiement nécessitent Internet. Le traitement des PDF reste local : vos documents ne sont pas envoyés au service de facturation. L’assistant nécessite un téléchargement initial de modèles.</p></details>
      </div></section>
    </div>
    <script src="/inklura-pdf/demos.js?v=20260924-pricing-1" defer />
  </main>;
}
