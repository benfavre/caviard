import { WorkspaceBrandIcon } from "../../../shared/inklura-ui/src/WorkspaceBrandIcon";
// Brand kit for outils.inklura.fr — aligned with ecosystem.inklura.fr's
// editorial-tech direction: Inklura electric blue (#2563EB), Bricolage
// Grotesque display headings over an Inter body, an atmospheric layered
// backdrop (blueprint dot-grid + gradient-mesh glows + fine grain), numbered
// section labels, glassy nav, accent-edged tiles, and orchestrated scroll
// motion. Primary buttons match onboarding.inklura.fr: solid blue pill with a
// soft blue glow that deepens on hover (no gradient/shimmer).
//
// Dark mode is BRIDGED: the THEME_SCRIPT sets BOTH html[data-theme=dark]
// (drives the CSS-variable shell + home) AND the Tailwind `.dark` class (drives
// the 46 interior tool pages, still authored in Tailwind via route_css). One
// toggle flips the whole site.

export const INKLURA_FONTS =
  "/fonts/fonts.css";

export const BRAND_CSS = `
  :root{
    --brand:#2563EB;--brand-d:#1D4ED8;--brand-l:#3B82F6;--brand-2:#60A5FA;
    --grad:linear-gradient(135deg,#1D4ED8 0%,#2563EB 48%,#3B82F6 100%);
    --grad-soft:linear-gradient(135deg,rgba(29,78,216,.10),rgba(59,130,246,.10));
    --ink:#0a1019;--ink-2:#36425a;--mut:#697489;--faint:#9aa6ba;
    --line:#e6ebf4;--line-2:#eef2f9;
    --bg:#f5f8fd;--bg-2:#ffffff;--card:#ffffff;--card-2:#fbfcff;
    --soft:#EFF6FF;--soft-2:#DBEAFE;
    --glass:rgba(255,255,255,.72);
    --code-bg:#0a1020;--code-fg:#dbe4ff;
    --dot:rgba(29,78,216,.055);
    --ok:#108043;--ok-bg:#e3f6ea;--soon:#9a6b00;--soon-bg:#fbf0d8;
    --shadow-sm:0 1px 2px rgba(13,32,70,.05),0 3px 8px rgba(13,32,70,.05);
    --shadow:0 14px 34px -14px rgba(37,99,235,.22),0 6px 16px -10px rgba(13,32,70,.14);
    --shadow-lg:0 40px 80px -28px rgba(37,99,235,.40),0 16px 36px -20px rgba(13,32,70,.22);
    --shadow-btn:0 10px 30px rgba(37,99,235,.30);
    --shadow-btn-h:0 18px 45px rgba(37,99,235,.40);
    --r:20px;--r-sm:13px;--r-xs:10px;
    --maxw:1240px;
    color-scheme:light;
  }
  html[data-theme=dark]{
    --ink:#eef2f9;--ink-2:#c2ccde;--mut:#8a96ac;--faint:#5b677d;
    --line:#1d2533;--line-2:#161d2a;
    --bg:#070a11;--bg-2:#0c111b;--card:#0e1421;--card-2:#0c111c;
    --soft:#1E3A8A;--soft-2:#1E40AF;
    --glass:rgba(14,20,33,.62);
    --code-bg:#060a13;--code-fg:#cfe0ff;
    --dot:rgba(59,130,246,.06);
    --ok:#5fd98a;--ok-bg:#10331f;--soon:#e9c46a;--soon-bg:#33290f;
    --shadow-sm:0 1px 2px rgba(0,0,0,.4);
    --shadow:0 18px 40px -16px rgba(0,0,0,.6),0 6px 16px -10px rgba(0,0,0,.5);
    --shadow-lg:0 48px 90px -28px rgba(0,0,0,.75),0 16px 36px -20px rgba(0,0,0,.6);
    --shadow-btn:0 10px 30px rgba(37,99,235,.34);
    --shadow-btn-h:0 18px 45px rgba(37,99,235,.46);
    color-scheme:dark;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  html,body{margin:0;font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  body{min-height:100%;position:relative;overflow-x:hidden}
  /* atmosphere: gradient-mesh glows (fixed) + blueprint dot-grid */
  body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
    background:
      radial-gradient(680px 520px at 86% -8%,rgba(37,99,235,.16),transparent 60%),
      radial-gradient(620px 560px at -6% 12%,rgba(59,130,246,.13),transparent 58%),
      radial-gradient(900px 700px at 50% 118%,rgba(37,99,235,.10),transparent 60%);}
  body::after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
    background-image:radial-gradient(var(--dot) 1px,transparent 1.4px);background-size:26px 26px;
    -webkit-mask-image:linear-gradient(180deg,#000,transparent 88%);mask-image:linear-gradient(180deg,#000,transparent 88%);}
  .grain{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.4;mix-blend-mode:soft-light;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");}
  html[data-theme=dark] .grain{opacity:.22}

  a{color:inherit;text-decoration:none}
  ::selection{background:rgba(37,99,235,.22)}
  :focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:6px}

  h1,h2,h3{margin:0;color:var(--ink);font-family:"Bricolage Grotesque","Inter",system-ui,sans-serif}
  h1{font-size:clamp(40px,6.4vw,72px);font-weight:800;line-height:.98;letter-spacing:-0.045em}
  h2{font-size:clamp(28px,4vw,46px);font-weight:700;letter-spacing:-0.035em;line-height:1.04}
  h3{font-size:18px;font-weight:700;letter-spacing:-0.02em;font-family:"Inter",sans-serif}
  p{margin:0}
  .sub{color:var(--mut);font-size:16px;line-height:1.65}
  .lede{font-size:clamp(17px,1.6vw,20px);color:var(--ink-2);line-height:1.6;max-width:62ch}
  .muted{color:var(--mut);font-size:13px}
  .mono{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;font-size:.92em}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--brand)}

  /* numbered editorial section label */
  .seclabel{display:flex;align-items:center;gap:14px;color:var(--brand);margin-bottom:18px}
  .seclabel .no{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;font-weight:600;letter-spacing:.05em;color:var(--mut)}
  .seclabel .tx{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
  .seclabel .rule{flex:1;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--brand) 40%,transparent),transparent)}

  /* buttons — primary matches onboarding.inklura.fr: solid blue pill + blue glow */
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer;transition:transform .18s cubic-bezier(.2,.7,.2,1),box-shadow .2s ease,background .2s ease,border-color .2s ease;letter-spacing:-0.01em;font-family:inherit;white-space:nowrap}
  .btn:hover{background:var(--soft);border-color:color-mix(in srgb,var(--brand) 26%,var(--line));transform:translateY(-1px)}
  .btn.sm{padding:8px 14px;font-size:13px}
  .btn.lg{padding:0 28px;height:48px;font-size:15px}
  .btn.pri{background:var(--brand);border-color:transparent;color:#fff;box-shadow:var(--shadow-btn)}
  .btn.pri:hover{background:var(--brand-d);transform:translateY(-1px);box-shadow:var(--shadow-btn-h)}
  .btn.ghost{border-color:transparent;background:transparent;color:var(--mut)}
  .btn.ghost:hover{background:var(--soft);color:var(--ink)}
  .btn[disabled]{opacity:.55;cursor:not-allowed;transform:none}

  /* cards + pills */
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:26px;box-shadow:var(--shadow-sm)}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:.01em;border:1px solid transparent}
  .pill.on{background:var(--soft);color:var(--brand-d);border-color:color-mix(in srgb,var(--brand) 18%,transparent)}
  .pill.ok{background:var(--ok-bg);color:var(--ok)}
  .pill.soon{background:var(--soon-bg);color:var(--soon)}
  .pill .pdot{width:7px;height:7px;border-radius:50%;background:currentColor;position:relative}
  .pill.ok .pdot::after{content:"";position:absolute;inset:-3px;border-radius:50%;background:currentColor;opacity:.45;animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite}
  @keyframes ping{0%{transform:scale(1);opacity:.45}70%,100%{transform:scale(2.4);opacity:0}}
  .badge{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--brand-d);background:var(--soft);border:1px solid color-mix(in srgb,var(--brand) 16%,transparent);border-radius:999px;padding:6px 13px}

  /* top nav */
  .nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:18px;height:64px;padding:0 24px;background:color-mix(in srgb,var(--bg) 72%,transparent);backdrop-filter:saturate(1.6) blur(14px);-webkit-backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid transparent;transition:border-color .2s ease,background .2s ease}
  body[data-scrolled=y] .nav{border-bottom-color:var(--line);background:color-mix(in srgb,var(--bg) 86%,transparent)}
  .nav .spacer{flex:1}
  .nav .links{display:flex;align-items:center;gap:2px}
  .nav .links a{position:relative;padding:8px 13px;border-radius:999px;font-size:14px;font-weight:600;color:var(--mut);transition:color .15s,background .15s}
  .nav .links a:hover{color:var(--ink);background:var(--soft)}
  .nav .links a.active{color:var(--brand-d);background:var(--soft)}
  @media(max-width:840px){.nav .links a.hide-sm,.nav a.hide-sm{display:none}}
  @media(max-width:540px){.nav .btn.hide-xs{display:none}}
  .logo{display:flex;align-items:center;gap:11px;font-weight:700;font-size:18px;letter-spacing:-0.03em;font-family:"Bricolage Grotesque",Inter,sans-serif;color:var(--ink)}
  .logo .mk{display:flex;transition:transform .3s cubic-bezier(.2,.7,.2,1)}
  .logo:hover .mk{transform:rotate(-8deg) scale(1.06)}
  .logo .tag{font-weight:500;font-size:12px;color:var(--mut);letter-spacing:0;padding-left:3px;font-family:Inter,sans-serif}
  .iconbtn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--mut);transition:transform .15s,background .15s,color .15s}
  .iconbtn:hover{background:var(--soft);color:var(--ink);transform:translateY(-1px)}

  /* footer */
  .foot{position:relative;border-top:1px solid var(--line);margin-top:90px;padding:40px 0 56px;color:var(--mut)}
  .foot .row{display:flex;flex-wrap:wrap;align-items:center;gap:16px 22px}
  .foot a{color:var(--mut);font-size:14px;transition:color .15s}
  .foot a:hover{color:var(--brand-d)}
  .foot .sp{flex:1}

  /* hero */
  .hero{position:relative;padding:78px 0 30px}
  .hero .tagline{display:inline-flex;gap:9px;align-items:center;font-size:13px;font-weight:600;color:var(--brand-d);background:var(--glass);border:1px solid color-mix(in srgb,var(--brand) 22%,transparent);border-radius:999px;padding:7px 15px;letter-spacing:.005em;box-shadow:var(--shadow-sm);backdrop-filter:blur(6px)}
  .hero h1{margin:22px 0 0;max-width:15ch}
  .hero h1 .g{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;position:relative}
  .hero p.lead{margin:22px 0 0;max-width:54ch;font-size:clamp(17px,1.7vw,20px);color:var(--ink-2);line-height:1.6}
  .hero .cta{display:flex;flex-wrap:wrap;gap:13px;margin-top:30px}
  .hero .inner{position:relative;z-index:1}

  /* trust row */
  .trust{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;margin-top:34px;padding-top:22px;border-top:1px solid var(--line)}
  .trust .t{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--ink-2)}
  .trust .t .ic{width:28px;height:28px;border-radius:9px;background:var(--grad-soft);color:var(--brand);display:flex;align-items:center;justify-content:center;flex:0 0 auto}

  /* feature grid */
  .grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(252px,1fr));gap:18px}
  .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}
  .feature{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:24px;box-shadow:var(--shadow-sm);transition:transform .18s cubic-bezier(.2,.7,.2,1),border-color .18s,box-shadow .18s;overflow:hidden}
  .feature::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--grad);transform:scaleX(0);transform-origin:left;transition:transform .3s ease}
  .feature:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--brand) 24%,var(--line));box-shadow:var(--shadow)}
  .feature:hover::before{transform:scaleX(1)}
  .feature .fi{width:46px;height:46px;border-radius:13px;background:var(--grad-soft);border:1px solid color-mix(in srgb,var(--brand) 14%,transparent);display:flex;align-items:center;justify-content:center;color:var(--brand);margin-bottom:16px}
  .feature h3{font-size:16.5px;margin:0 0 7px}
  .feature p{font-size:14px;color:var(--mut);line-height:1.6}

  /* directory tile (tool) */
  .tile{position:relative;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:24px;box-shadow:var(--shadow-sm);transition:transform .18s cubic-bezier(.2,.7,.2,1),border-color .18s,box-shadow .18s;height:100%;overflow:hidden}
  .tile::before{content:"";position:absolute;inset:0;border-radius:var(--r);padding:1px;background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 50%,transparent),transparent 42%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .25s ease;pointer-events:none}
  .tile:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg)}
  .tile:hover::before{opacity:1}
  .tile .top{display:flex;align-items:flex-start;gap:14px}
  .tile .ti{width:50px;height:50px;flex:0 0 auto;border-radius:14px;background:var(--grad-soft);border:1px solid color-mix(in srgb,var(--brand) 14%,transparent);display:flex;align-items:center;justify-content:center;color:var(--brand);transition:transform .25s ease}
  .tile:hover .ti{transform:scale(1.06) rotate(-4deg)}
  .tile h3{font-size:17px;line-height:1.25}
  .tile p.d{font-size:14px;color:var(--mut);line-height:1.6;margin-top:14px;flex:1}
  .tile .cat{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--brand)}
  .tile .foot2{display:flex;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap}
  .tile .open{margin-left:auto;font-size:13px;font-weight:700;color:var(--brand-d);display:inline-flex;align-items:center;gap:6px}
  .tile .open svg{transition:transform .2s cubic-bezier(.2,.7,.2,1)}
  .tile:hover .open svg{transform:translate(3px,0)}
  .tile.soon{opacity:.62}
  .tile.soon .ti{background:var(--soft);color:var(--mut);border-color:var(--line)}
  .tile.soon:hover{transform:none;box-shadow:var(--shadow-sm)}
  .tile.soon:hover::before{opacity:0}

  /* chips (filter row) */
  .chips{display:flex;flex-wrap:wrap;gap:8px}
  .chip{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--ink-2);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 15px;box-shadow:var(--shadow-sm);cursor:pointer;transition:transform .15s,border-color .15s,background .15s,color .15s}
  .chip:hover{border-color:color-mix(in srgb,var(--brand) 30%,var(--line));background:var(--soft);transform:translateY(-1px)}
  .chip .n{display:inline-flex;align-items:center;justify-content:center;min-width:20px;padding:0 6px;height:20px;border-radius:999px;background:var(--soft);font-size:11px;font-weight:800;color:var(--mut)}
  .chip[data-on="1"]{background:var(--brand);border-color:transparent;color:#fff;box-shadow:var(--shadow-btn)}
  .chip[data-on="1"] .n{background:rgba(255,255,255,.22);color:#fff}
  .chip[data-on="1"]:hover{background:var(--brand-d)}

  /* search field */
  .searchbox{position:relative;max-width:720px;margin:0 auto}
  .searchbox svg{position:absolute;left:18px;top:50%;transform:translateY(-50%);color:var(--mut);pointer-events:none}
  .searchbox input{width:100%;height:56px;border-radius:16px;border:1px solid var(--line);background:var(--card);padding:0 18px 0 50px;font-size:16px;font-weight:500;color:var(--ink);font-family:inherit;box-shadow:var(--shadow-sm);transition:border-color .15s,box-shadow .15s}
  .searchbox input::placeholder{color:var(--faint)}
  .searchbox input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand) 14%,transparent)}

  /* stat band */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);padding:20px 22px;box-shadow:var(--shadow-sm)}
  .stat .num{font-family:"Bricolage Grotesque",Inter,sans-serif;font-size:32px;font-weight:800;letter-spacing:-0.04em;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .stat .lbl{font-size:13px;color:var(--mut);margin-top:4px}

  .section{padding:56px 0}
  .center{text-align:center}
  .stack{display:flex;flex-direction:column}

  /* number inputs: hide spinners for the calculator look (tool pages) */
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  input[type=number]{-moz-appearance:textfield}

  /* motion — load + scroll reveal */
  @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
  .anim{animation:fadeUp .8s cubic-bezier(.2,.7,.2,1) both}
  .reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
  .reveal.in{opacity:1;transform:none}
  @media(prefers-reduced-motion:reduce){.anim,.reveal{animation:none!important;opacity:1!important;transform:none!important;transition:none!important}.btn,.tile,.feature,.chip{transition:none}html{scroll-behavior:auto}}
`;

// Theme: set BOTH html[data-theme] (CSS-variable shell + home) AND the Tailwind
// `.dark` class (the 46 interior tool pages, authored in Tailwind). Runs in
// <head> before paint (no flash); seeds from localStorage then system pref.
export const THEME_SCRIPT = `
(function(){
  try{
    var k="inklura-outils-theme";
    var saved=localStorage.getItem(k);
    var sys=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
    var t=saved||(sys?"dark":"light");
    var el=document.documentElement;
    el.setAttribute("data-theme",t);
    el.classList.toggle("dark",t==="dark");
    window.__toggleOutilsTheme=function(){
      var cur=el.getAttribute("data-theme")==="dark"?"light":"dark";
      el.setAttribute("data-theme",cur);
      el.classList.toggle("dark",cur==="dark");
      try{localStorage.setItem(k,cur);}catch(e){}
    };
  }catch(e){}
})();
`;

// Scroll-reveal (stagger via data-delay) + sticky-nav shadow toggle. Vanilla,
// runs once at end of body. Respects reduced-motion by revealing immediately.
export const REVEAL_SCRIPT = `
(function(){
  try{
    var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els=[].slice.call(document.querySelectorAll(".reveal"));
    if(rm||!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});}
    else{
      var io=new IntersectionObserver(function(en){
        en.forEach(function(x){
          if(x.isIntersecting){
            var d=parseInt(x.target.getAttribute("data-delay")||"0",10);
            setTimeout(function(){x.target.classList.add("in")},d);
            io.unobserve(x.target);
          }
        });
      },{rootMargin:"0px 0px -8% 0px",threshold:.12});
      els.forEach(function(e){io.observe(e)});
    }
    var onScroll=function(){document.body.setAttribute("data-scrolled",window.scrollY>8?"y":"n")};
    onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  }catch(e){}
})();
`;

// Inklura person-in-rounded-square mark.
export function LogoMark(props: { size?: number; onGradient?: boolean }): any {
  return <WorkspaceBrandIcon id="outils" size={props.size ?? 30} />;
}

export function Logo(props: { product?: string; onGradient?: boolean }): any {
  return (
    <a className="logo" href="/" style={props.onGradient ? "color:#fff" : ""}>
      <span className="mk"><LogoMark size={30} onGradient={props.onGradient} /></span>
      <span>Inklura<span className="tag">{props.product ?? "Outils"}</span></span>
    </a>
  );
}
