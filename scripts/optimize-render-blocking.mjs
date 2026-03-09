import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function listSiteDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => e.name);
}

function walkHtml(absDir) {
  const out = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) out.push(...walkHtml(abs));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

function shouldSkipHtml(absPath) {
  const base = path.basename(absPath);
  return /^google[a-z0-9]+\.html$/i.test(base);
}

function buildPreloadStylesheetTag(href) {
  const h = String(href || '').replace(/"/g, '&quot;');
  return [
    `<link rel="preload" href="${h}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
    `<noscript><link rel="stylesheet" href="${h}"></noscript>`,
  ].join('\n');
}

function rewriteHead(html) {
  let next = String(html || '');

  // Convert blocking stylesheets to preload+noscript (styles.css + Google Fonts stylesheet).
  // Keep other stylesheets as-is.
  const styleHrefRe = /<link\s+[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi;
  next = next.replace(styleHrefRe, (full, href) => {
    const h = String(href || '');
    const isLocalCss = /styles\.css(\?.*)?$/i.test(h);
    const isGoogleFontsCss = /^https:\/\/fonts\.googleapis\.com\/css2\?/i.test(h);
    const alreadyPreload = /rel="preload"/i.test(full);
    if (alreadyPreload) return full;
    if (isLocalCss || isGoogleFontsCss) return buildPreloadStylesheetTag(h);
    return full;
  });

  // Defer local scripts (reduce render-blocking). Keep async scripts as-is.
  // - Do not touch inline scripts (no src)
  // - Do not touch scripts that already have async/defer
  // - Do not touch external scripts (keep current behavior)
  const scriptSrcRe = /<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)><\/script>/gi;
  next = next.replace(scriptSrcRe, (full, pre, src, post) => {
    const attrs = `${pre || ''}${post || ''}`;
    if (/\basync\b/i.test(attrs) || /\bdefer\b/i.test(attrs)) return full;
    const s = String(src || '');
    if (/^https?:\/\//i.test(s)) return full;
    // Local script: add defer.
    return `<script${pre || ''} src="${s}" defer${post || ''}></script>`;
  });

  // Normalize excessive blank lines.
  next = next.replace(/\n{3,}/g, '\n\n');
  return next;
}

function run() {
  const sites = listSiteDirs();
  let updated = 0;
  let scanned = 0;

  for (const siteDir of sites) {
    const absSite = path.join(ROOT, siteDir);
    const htmlFiles = walkHtml(absSite);
    for (const absPath of htmlFiles) {
      if (shouldSkipHtml(absPath)) continue;
      const html = fs.readFileSync(absPath, 'utf8');
      const next = rewriteHead(html);
      scanned += 1;
      if (next !== html) {
        fs.writeFileSync(absPath, next, 'utf8');
        updated += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[render-blocking] updated ${updated}/${scanned} html files across ${sites.length} sites`);
}

run();

