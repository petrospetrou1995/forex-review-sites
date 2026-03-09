import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function listSiteDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => e.name);
}

const START = '/* MOBILE_RESPONSIVE_PATCH_START */';
const END = '/* MOBILE_RESPONSIVE_PATCH_END */';

const PATCH = `
${START}
@media (max-width: 860px){
  html{font-size:16px}
  body{overflow-x:hidden}
  img,svg{max-width:100%;height:auto}
  .container{padding-left:16px!important;padding-right:16px!important}
  .section,.section-pad,.section-pad-dark{padding:3rem 0!important}
  .hero-title,.section-heading{font-size:clamp(2rem,7vw,3rem)!important;line-height:1.15}
  .section-heading-md,.section-title{font-size:clamp(1.6rem,6vw,2.2rem)!important;line-height:1.2}
  .hero-subtitle,.section-intro,.section-lead,.guide-lead{font-size:1rem!important}
  .brokers-grid,.guide-grid,.grid,.grid-3,.grid-4,.grid-4-tight,.team-grid{grid-template-columns:1fr!important}
  .link-row{flex-wrap:wrap!important;gap:16px!important}

  /* Tap targets */
  .menu-btn,#menuToggle,.lang-toggle,.lang-btn,#langToggle,.btn-review,.btn-inline,.link-cta,button,[role="button"],input,select,textarea{min-height:48px}
  .menu-btn,#menuToggle,.lang-toggle,.lang-btn,#langToggle,.btn-inline,.link-cta,button,[role="button"]{padding:12px 14px}
  .link-cta,.btn-inline{display:inline-flex;align-items:center}
  .btn-more{min-height:48px!important;padding:12px 16px!important;display:inline-flex;align-items:center;justify-content:center}
  a.btn-link,button.btn-link{display:inline-flex;align-items:center;padding:10px 0;min-height:48px}

  /* Navigation: collapse into hamburger menu */
  .nav,.navbar{position:relative}
  #menuToggle,.menu-btn{display:inline-flex!important;align-items:center;justify-content:center}
  #primaryNav,.nav-menu,.nav-links{display:none!important;position:absolute;top:100%;left:0;right:0;z-index:1000;flex-direction:column;gap:8px;padding:12px;border-radius:12px}
  #primaryNav.active,.nav-menu.active,.nav-links.active{display:flex!important}
  #primaryNav a,.nav-menu a,.nav-links a{display:block;padding:12px 10px}

  /* Tables: prevent overflow */
  .table-wrapper,.table-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
  .table-wrapper table,.table-scroll table{min-width:520px}
  table{max-width:100%}
}
@media (max-width: 480px){
  .guide-back{white-space:normal}
}
@media (min-width: 861px){
  .menu-btn,#menuToggle{display:none!important}
  #primaryNav,.nav-menu,.nav-links{display:flex!important;position:static!important;flex-direction:row!important}
}
${END}
`.trimStart();

function hasPatch(css) {
  return String(css || '').includes(START) && String(css || '').includes(END);
}

function upsertPatch(css) {
  const s = String(css || '');
  const a = s.indexOf(START);
  const b = s.indexOf(END);
  if (a !== -1 && b !== -1 && b > a) {
    return s.slice(0, a) + PATCH + s.slice(b + END.length);
  }
  return `${s}\n${PATCH}\n`;
}

function run() {
  const sites = listSiteDirs();
  let updated = 0;
  for (const siteDir of sites) {
    const abs = path.join(ROOT, siteDir, 'styles.css');
    if (!fs.existsSync(abs)) continue;
    const css = fs.readFileSync(abs, 'utf8');
    const next = hasPatch(css) ? upsertPatch(css) : upsertPatch(css);
    if (next !== css) {
      fs.writeFileSync(abs, next, 'utf8');
      updated += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[mobile-css] patched ${updated}/${sites.length} sites`);
}

run();

