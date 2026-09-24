import { WorkspaceMenu } from "../../../shared/inklura-ui/src/WorkspaceMenu";
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
  const pdfTitle = "Inklura PDF — caviardage et IA locale | Essai gratuit";
  const pdfDescription = "Essayez Inklura PDF sur Windows, macOS et Linux. Caviardage, assistant IA et OCR locaux. 20 PDF d’essai par compte, puis packs ou abonnement. Achats en France métropolitaine.";
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
        <meta property="og:url" content="https://pdf.inklura.fr/" />
        <link rel="canonical" href="https://pdf.inklura.fr/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={INKLURA_FONTS} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style>{BRAND_CSS}</style>
        <style>{ECOSYSTEM_MARKETING_CSS}</style>
        <noscript><style>{`.reveal{opacity:1!important;transform:none!important}.anim{animation:none!important}`}</style></noscript>
      </head>
      <body data-inklura-public="20260906">
        <div className="grain" aria-hidden="true"></div>

        <nav className="nav">
          <Logo product="PDF" />
          <span className="spacer"></span>
          <span className="links">
            <a href="https://outils.inklura.fr/" className="hide-sm">Tous les outils</a>
            <a href="https://ecosystem.inklura.fr/tools" target="_blank" rel="noopener" className="hide-sm">Écosystème</a>
          </span>
          <button className="iconbtn" type="button" aria-label="Changer de thème" onclick="window.__toggleOutilsTheme&&window.__toggleOutilsTheme()">
            <Icon name="moon" size={17} className="dark:hidden" />
            <Icon name="sun" size={17} className="hidden dark:block" />
          </button>
          <a className="btn sm ghost hide-xs" href="https://inklura.fr" target="_blank" rel="noopener">Accéder à Inklura</a>
          <a className="btn pri sm" href="https://onboarding.inklura.fr" target="_blank" rel="noopener">Créer mon espace</a>
          <WorkspaceMenu />
        </nav>

        {props.children}

        <footer className="foot">
          <div className="wrap row">
            <Logo product="PDF" />
            <span className="sp"></span>
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
