import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

function discoverSites() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => ({ key: e.name, dir: e.name }))
    .sort((a, b) => a.dir.localeCompare(b.dir, 'en'));
}

function listHtmlFiles(absDir) {
  const out = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) out.push(...listHtmlFiles(abs));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

function isRedirectStub(html) {
  const s = String(html || '');
  return /http-equiv="refresh"/i.test(s) && /window\.location\.replace/i.test(s);
}

function extractFirstHeader(html) {
  const s = String(html || '');
  const start = s.search(/<header\b/i);
  if (start === -1) return '';
  const end = s.search(/<\/header>/i);
  if (end === -1 || end < start) return '';
  return s.slice(start, end + '</header>'.length);
}

function replaceFirstHeader(html, nextHeader) {
  const s = String(html || '');
  const start = s.search(/<header\b/i);
  if (start === -1) return s;
  const end = s.search(/<\/header>/i);
  if (end === -1 || end < start) return s;
  return s.slice(0, start) + nextHeader + s.slice(end + '</header>'.length);
}

function prefixForRel(relPath) {
  const posixRel = relPath.replace(/\\/g, '/');
  const dir = path.posix.dirname(posixRel);
  if (!dir || dir === '.') return '';
  const depth = dir.split('/').filter(Boolean).length;
  return '../'.repeat(depth);
}

function shouldKeepHref(href) {
  const h = String(href || '').trim();
  if (!h) return true;
  if (/^(https?:)?\/\//i.test(h)) return true;
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(h)) return true;
  return false;
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteHeaderHrefs(headerHtml, prefix) {
  const p = prefix || '';
  return String(headerHtml || '').replace(/href="([^"]*)"/gi, (m, href) => {
    const h = String(href || '').trim();
    if (shouldKeepHref(h)) return `href="${h}"`;
    if (h.startsWith('#')) return `href="${p}${h}"`;
    if (h.startsWith('/')) return `href="${h}"`;
    return `href="${p}${h}"`;
  });
}

function upsertScriptTag(html, filename, desiredTag) {
  const s = String(html || '');
  const fileRe = new RegExp(`<script\\b[^>]*\\bsrc="[^"]*${escapeRegExp(filename)}"[^>]*>\\s*<\\/script>`, 'i');

  if (fileRe.test(s)) return s.replace(fileRe, desiredTag);

  const closeBody = s.search(/<\/body>/i);
  if (closeBody === -1) return `${s}\n${desiredTag}\n`;

  return `${s.slice(0, closeBody)}\n${desiredTag}\n${s.slice(closeBody)}`;
}

function runSite(site) {
  const absDir = path.join(ROOT, site.dir);
  const indexAbs = path.join(absDir, 'index.html');
  if (!fs.existsSync(indexAbs)) return { site: site.dir, updated: 0, skipped: 0, reason: 'missing index.html' };

  const indexHtml = fs.readFileSync(indexAbs, 'utf8');
  const canonicalHeader = extractFirstHeader(indexHtml);
  if (!canonicalHeader) return { site: site.dir, updated: 0, skipped: 0, reason: 'no <header> found in index.html' };

  const hasNavigationJs = fs.existsSync(path.join(absDir, 'navigation.js'));
  const hasTranslationsJs = fs.existsSync(path.join(absDir, 'translations.js'));

  const htmlFiles = listHtmlFiles(absDir);
  let updated = 0;
  let skipped = 0;

  for (const absHtml of htmlFiles) {
    const rel = path.relative(absDir, absHtml).replace(/\\/g, '/');
    const raw = fs.readFileSync(absHtml, 'utf8');
    if (isRedirectStub(raw)) {
      skipped += 1;
      continue;
    }
    if (!/<header\b/i.test(raw)) {
      skipped += 1;
      continue;
    }

    const prefix = prefixForRel(rel);
    const nextHeader = rewriteHeaderHrefs(canonicalHeader, prefix);
    let next = replaceFirstHeader(raw, nextHeader);

    // If the site uses a shared nav/menu script, ensure it's present on every page.
    if (hasTranslationsJs) {
      next = upsertScriptTag(next, 'translations.js', `<script src="${prefix}translations.js" defer></script>`);
    }
    if (hasNavigationJs) {
      next = upsertScriptTag(next, 'navigation.js', `<script src="${prefix}navigation.js" defer></script>`);
    }

    if (next !== raw) {
      fs.writeFileSync(absHtml, next, 'utf8');
      updated += 1;
    }
  }

  return { site: site.dir, updated, skipped };
}

export function runAll() {
  const sites = discoverSites();
  const results = sites.map(runSite);

  const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);
  const totalSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0);

  // eslint-disable-next-line no-console
  console.log(`[nav] updated ${totalUpdated} pages; skipped ${totalSkipped}`);

  for (const r of results) {
    if (r.reason) {
      // eslint-disable-next-line no-console
      console.log(`[nav] ${r.site}: skipped (${r.reason})`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[nav] ${r.site}: updated ${r.updated}, skipped ${r.skipped}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAll();
}

