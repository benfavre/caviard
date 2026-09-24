import { ECOSYSTEM_MARKETING_CSS as SHARED_MARKETING_CSS } from "../../../shared/inklura-ui/src/ecosystem-marketing";
import { workspaceBrandCss, workspaceSurfaceCss, workspaceColor } from "../../../shared/inklura-ui/src/workspace-brand";
const ECOSYSTEM_MARKETING_CSS = workspaceBrandCss(SHARED_MARKETING_CSS, "outils") + workspaceSurfaceCss("outils", "body[data-inklura-public]");
// Product shell for pdf.inklura.fr, using the shared Inklura visual language.
// Adapted from the tools shell used by
// every tool. Glassy sticky top-nav, atmospheric backdrop (dot-grid + glows +
// grain, from BRAND_CSS), a light/dark theme toggle and a footer. Public,
// server-rendered. Dark mode is bridged (data-theme + Tailwind .dark) so the
// interior tool pages stay consistent. Aligned with ecosystem.inklura.fr.
import { BRAND_CSS, INKLURA_FONTS, THEME_SCRIPT, REVEAL_SCRIPT, Logo } from "../lib/brand";
import { Icon } from "../lib/icons";

interface LayoutProps { title?: string; children?: any; route?: { pathname?: string } }

export default function RootLayout(props: LayoutProps): any {
  const isPricing = /^\/tarifs\/?$/.test(props.route?.pathname ?? "/");
  const isChangelog = /^\/changelog\/?$/.test(props.route?.pathname ?? "/");
  const sectionHref = (id: string) => (isPricing || isChangelog ? "/" : "") + "#" + id;
  const canonical = "https://pdf.inklura.fr/" + (isPricing ? "tarifs" : isChangelog ? "changelog" : "");
  const pdfTitle = isPricing ? "Tarifs Inklura PDF — Essai, packs et abonnements" : isChangelog ? "Historique des versions — Inklura PDF" : "Inklura PDF — caviardage, anonymisation et IA locale";
  const pdfDescription = isPricing ? "Découvrez les tarifs d’Inklura PDF : 20 PDF d’essai, packs valables 12 mois et abonnements mensuels. Prix HT et TTC, crédits et conditions." : isChangelog ? "Toutes les nouveautés et corrections des versions publiques d’Inklura PDF : import de dossiers, intégration Windows, macOS et Linux, exports et compte." : "Préparez vos PDF avant de les partager avec une IA ou un partenaire. Caviardage local, aide à l’anonymisation et export sans métadonnées documentaires. 20 PDF d’essai.";
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pdfTitle}</title>
        <meta name="description" content={pdfDescription} />
        <meta name="theme-color" content={workspaceColor("outils")}  />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=20260907palette2" /><link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.svg?v=20260907palette2" data-workspace-favicon="outils" /><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20260907palette2" />
        <meta property="og:title" content={pdfTitle} />
        <meta property="og:description" content={pdfDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <link rel="canonical" href={canonical} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={INKLURA_FONTS} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style>{BRAND_CSS}</style>
        <style>{ECOSYSTEM_MARKETING_CSS}</style>
        <link rel="stylesheet" href="/inklura-pdf/navigation.css?v=20260924-2" />
        <noscript><style>{`.reveal{opacity:1!important;transform:none!important}.anim{animation:none!important}`}</style></noscript>
      </head>
      <body data-inklura-public="20260906">
        <div className="grain" aria-hidden="true"></div>

        <a className="ipdf-skip" href="#contenu">Aller au contenu</a>
        <header className="ipdf-site-header"><nav className="ipdf-product-nav" aria-label="Navigation Inklura PDF">
          <a className="ipdf-product-logo" href="/" aria-label="Inklura PDF — accueil"><span className="ipdf-product-mark"><img src="/inklura-pdf/app-icon.svg" width="32" height="32" alt="" /></span><strong>Inklura<span>.</span></strong><span className="ipdf-product-tag">PDF</span></a>
          <div className="ipdf-product-links"><a href={sectionHref("anonymisation")} data-section-link>Anonymisation</a><a href={sectionHref("demonstration")} data-section-link>Démo</a><a href={sectionHref("assistant")} data-section-link>Assistant</a><a href={sectionHref("securite")} data-section-link>Confidentialité</a><a href="/tarifs" aria-current={isPricing ? "page" : undefined}>Tarifs</a></div>
          <div className="ipdf-nav-actions"><button className="ipdf-theme-toggle" type="button" aria-label="Changer de thème" onclick="window.__toggleOutilsTheme&&window.__toggleOutilsTheme()"><Icon name="moon" size={17} className="ipdf-theme-moon" /><Icon name="sun" size={17} className="ipdf-theme-sun" /></button><a className="ipdf-nav-download" href={sectionHref("telecharger")} data-section-link>Télécharger <Icon name="download" size={15} /></a>
          <details className="ipdf-nav-menu"><summary aria-label="Menu de navigation"><Icon name="menu" size={19} /><span>Menu</span></summary><div className="ipdf-nav-panel"><div className="ipdf-mobile-links"><p>INKLURA PDF</p><a href={sectionHref("anonymisation")} data-section-link>Anonymisation &amp; IA <span>01</span></a><a href={sectionHref("demonstration")} data-section-link>Voir la démo <span>02</span></a><a href={sectionHref("assistant")} data-section-link>Assistant local <span>03</span></a><a href={sectionHref("securite")} data-section-link>Confidentialité &amp; métadonnées <span>04</span></a><a href="/tarifs" aria-current={isPricing ? "page" : undefined}>Tarifs &amp; crédits <span>05</span></a><a href={sectionHref("telecharger")} data-section-link>Télécharger l’application <Icon name="download" size={15} /></a></div><div className="ipdf-nav-ecosystem"><p>VOTRE ESPACE INKLURA</p><a href="https://inklura.fr">Accéder à Inklura <span>↗</span></a><a href="https://onboarding.inklura.fr">Créer mon espace <span>↗</span></a><a href="https://outils.inklura.fr/">Tous les outils <span>↗</span></a></div></div></details></div>
        </nav></header>

        {props.children}

        <footer className="foot">
          <div className="wrap row">
            <Logo product="PDF" />
            <span className="sp"></span>
            <a href="/tarifs">Tarifs</a>
            <a href="/changelog" aria-current={isChangelog ? "page" : undefined}>Historique des versions</a>
            <a href="https://outils.inklura.fr/">Tous les outils</a>
            <a href="https://ecosystem.inklura.fr" target="_blank" rel="noopener">L'écosystème ↗</a>
            <a href="https://onboarding.inklura.fr" target="_blank" rel="noopener">Créer mon espace ↗</a>
            <a href="https://inklura.fr" target="_blank" rel="noopener">Inklura ↗</a>
            <button className="iconbtn" type="button" aria-label="Changer de thème" onclick="window.__toggleOutilsTheme&&window.__toggleOutilsTheme()">
              <Icon name="sun" size={16} />
            </button>
          </div>
          <div className="wrap" style="margin-top:14px;font-size:12.5px;color:var(--mut)">© Inklura · pdf.inklura.fr — 20 PDF d’essai · Packs et abonnements</div>
        </footer>

        <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
      </body>
    </html>
  );
}

// build: inklura-workspace-fleet-20260906g
