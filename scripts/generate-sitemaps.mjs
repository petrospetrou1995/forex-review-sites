import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

function discoverSites() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => ({ key: e.name, dir: e.name }));
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

function getFirst(html, re) {
  const m = String(html || '').match(re);
  return m ? m[1] : '';
}

function isRedirectStub(html) {
  const s = String(html || '');
  return /http-equiv="refresh"/i.test(s) && /This page moved/i.test(s) && /window\.location\.replace/i.test(s);
}

function shouldSkip(rel) {
  const base = path.basename(rel);
  if (/^google[a-z0-9]+\.html$/i.test(base)) return true;
  return false;
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lastmodFromAbs(abs) {
  try {
    const st = fs.statSync(abs);
    return new Date(st.mtimeMs).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function buildSitemap(entries) {
  const items = entries
    .map(({ loc, lastmod }) => {
      const lm = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : '';
      return `  <url><loc>${escapeXml(loc)}</loc>${lm}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function runSite(site) {
  const absDir = path.join(ROOT, site.dir);
  const htmlFiles = listHtmlFiles(absDir);
  const byLoc = new Map();

  for (const abs of htmlFiles) {
    const rel = path.relative(absDir, abs).replace(/\\/g, '/');
    if (shouldSkip(rel)) continue;
    const html = fs.readFileSync(abs, 'utf8');
    if (isRedirectStub(html)) continue;

    const canonical = getFirst(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i).trim();
    if (!canonical) continue;
    const lastmod = lastmodFromAbs(abs);
    const prev = byLoc.get(canonical);
    if (!prev) {
      byLoc.set(canonical, { loc: canonical, lastmod });
      continue;
    }
    // Keep newest lastmod when multiple files map to same canonical.
    if (lastmod && (!prev.lastmod || lastmod > prev.lastmod)) byLoc.set(canonical, { loc: canonical, lastmod });
  }

  const entries = Array.from(byLoc.values()).sort((a, b) => a.loc.localeCompare(b.loc));
  const xml = buildSitemap(entries);
  fs.writeFileSync(path.join(absDir, 'sitemap.xml'), xml, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[sitemap] ${site.key}: ${entries.length} URLs`);
}

export function runAll() {
  for (const s of discoverSites()) runSite(s);
}

// Only auto-run when executed as a script (not when imported by generators).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAll();
}

