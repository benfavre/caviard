import { releases } from "../../lib/changelog";
import currentRelease from "../../lib/inklura-pdf-release.json";

export const revalidate = 600;

export default function ChangelogPage(): any {
  return <main className="ipdf ipdf-changelog" id="contenu" tabIndex={-1}>
    <link rel="stylesheet" href="/inklura-pdf/page.css?v=20260924-pricing-2" />
    <link rel="stylesheet" href="/inklura-pdf/changelog.css?v=20260924-1" />
    <div className="ipdf-wrap">
      <a className="ipdf-textlink" href="/">← Découvrir Inklura PDF</a>
      <header className="ipdf-changelog-intro">
        <p className="ipdf-eyebrow">NOUVEAUTÉS ET CORRECTIONS</p>
        <h1>Chaque version,<br /><em>en détail.</em></h1>
        <p>Retrouvez les évolutions d’Inklura PDF : ce qui change dans votre quotidien, les corrections et les précisions utiles pour mettre à jour l’application.</p>
        <a className="ipdf-textlink" href="/#telecharger">Télécharger la version {currentRelease.version} →</a>
      </header>
      <div className="ipdf-changelog-layout">
        <aside className="ipdf-version-sidebar">
          <nav aria-label="Historique des versions"><p>VERSIONS PUBLIQUES</p><ol>{releases.map(release => <li><a href={`#v${release.version}`}><strong>{release.version}</strong><span>{release.version === currentRelease.version ? "Version actuelle" : release.dateLabel}</span></a></li>)}</ol></nav>
          <p>Les dates correspondent à la publication des versions stables. Les brouillons et préversions ne figurent pas dans cet historique.</p>
        </aside>
        <div className="ipdf-release-list">
          {releases.map(release => <article className="ipdf-release" id={`v${release.version}`} aria-labelledby={`title-${release.version}`}>
            <header><div className="ipdf-release-meta"><a href={`#v${release.version}`} aria-label={`Lien vers la version ${release.version}`}>v{release.version}</a><time dateTime={release.date}>{release.dateLabel}</time>{release.version === currentRelease.version && <span>Version actuelle</span>}</div><h2 id={`title-${release.version}`}>{release.title}</h2><p className="ipdf-release-summary">{release.summary}</p></header>
            {release.groups.map(group => <section><h3>{group.title}</h3><ul>{group.items.map(item => <li>{item}</li>)}</ul></section>)}
            <a className="ipdf-textlink ipdf-release-source" href={`https://github.com/benfavre/caviard/releases/tag/v${release.version}`}>Notes de publication sur GitHub ↗</a>
          </article>)}
        </div>
      </div>
      <section className="ipdf-update-guide" aria-labelledby="update-title"><div><p className="ipdf-eyebrow">PASSER À LA DERNIÈRE VERSION</p><h2 id="update-title">Comment mettre à jour ?</h2></div><div><p><strong>Windows et Linux :</strong> l’application recherche les mises à jour et vous propose de redémarrer pour les installer. Exportez d’abord vos modifications non enregistrées.</p><p><strong>macOS :</strong> téléchargez le nouvel installateur pour votre Mac, Apple Silicon ou Intel. Les mises à jour restent manuelles.</p><p>Les installateurs ne sont pas signés par un certificat d’éditeur ; votre système peut afficher un avertissement à l’ouverture.</p><a className="ipdf-textlink" href="/#telecharger">Choisir mon téléchargement →</a></div></section>
    </div>
    <script src="/inklura-pdf/demos.js?v=20260924-pricing-1" defer />
  </main>;
}
