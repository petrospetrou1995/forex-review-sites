import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SITE_DIRS = [
  { key: 'site1', dir: 'site1-dark-gradient', canonicalBase: 'https://brokerproreviews.com' },
  { key: 'site2', dir: 'site2-minimal-light', canonicalBase: 'https://brokerpro.pages.dev/site2-minimal-light' },
];

function read(abs) {
  return fs.readFileSync(abs, 'utf8');
}

function write(abs, content) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function removeDirIfEmpty(absDir) {
  try {
    const entries = fs.readdirSync(absDir);
    if (entries.length === 0) fs.rmdirSync(absDir);
  } catch {
    // ignore
  }
}

function normalizeText(s) {
  return String(s || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractH1(html) {
  const m = String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? normalizeText(m[1]) : '';
}

function slugify(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return t || 'page';
}

function relDepth(relDir) {
  const clean = relDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean) return 0;
  return clean.split('/').filter(Boolean).length;
}

function prefixForDepth(depth) {
  return depth <= 0 ? '' : '../'.repeat(depth);
}

function rewriteAssets(html, newRelDir) {
  const depth = relDepth(newRelDir);
  const pref = prefixForDepth(depth);

  // Rewrite known shared asset references to correct relative prefix.
  let out = String(html || '');
  out = out.replace(/(<link[^>]+href=")(?:\.\/|\.{2}\/)*styles\.css(")/gi, `$1${pref}styles.css$2`);
  out = out.replace(/(<script[^>]+src=")(?:\.\/|\.{2}\/)*translations\.js(")/gi, `$1${pref}translations.js$2`);
  out = out.replace(/(<script[^>]+src=")(?:\.\/|\.{2}\/)*app\.js(")/gi, `$1${pref}app.js$2`);
  out = out.replace(/(<link[^>]+href=")(?:\.\/|\.{2}\/)*favicon\.ico(")/gi, `$1${pref}favicon.ico$2`);
  out = out.replace(/(<link[^>]+href=")(?:\.\/|\.{2}\/)*apple-touch-icon\.png(")/gi, `$1${pref}apple-touch-icon.png$2`);
  return out;
}

function rewriteInternalLinks(html, linkMap, newRelPath) {
  let out = String(html || '');
  const fromDir = path.posix.dirname(newRelPath.replace(/\\/g, '/'));

  // Replace href targets based on map. We only rewrite relative hrefs (no protocol, no leading slash).
  out = out.replace(/href="([^"]+)"/gi, (full, href) => {
    const h = String(href || '');
    if (!h || h.startsWith('http://') || h.startsWith('https://') || h.startsWith('mailto:') || h.startsWith('tel:')) return full;
    if (h.startsWith('#')) return full;
    // Preserve query/hash.
    const [pathPart, hashPart] = h.split('#');
    const [pathOnly, queryPart] = pathPart.split('?');

    const normalized = path.posix.normalize(path.posix.join(fromDir, pathOnly)).replace(/^\.\//, '');
    const mapped = linkMap.get(normalized);
    if (!mapped) return full;

    let target = path.posix.relative(fromDir, mapped) || '.';

    // Make URLs pretty: directory routes should not include "index.html".
    if (target === 'index.html') target = './';
    if (target.endsWith('/index.html')) target = target.slice(0, -'index.html'.length);

    const rebuilt = `${target}${queryPart ? `?${queryPart}` : ''}${hashPart ? `#${hashPart}` : ''}`;
    return `href="${rebuilt}"`;
  });

  return out;
}

function normalizePrettyHrefs(html) {
  // Convert .../index.html to .../ for internal relative links.
  return String(html || '').replace(/href="([^"]+)"/gi, (full, href) => {
    const h = String(href || '');
    if (!h || h.startsWith('http://') || h.startsWith('https://') || h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('#')) return full;
    const [pathPart, hash] = h.split('#');
    const [p, query] = pathPart.split('?');
    if (!p) return full;
    if (p === 'index.html') return full; // keep local explicit index
    if (!p.endsWith('/index.html')) return full;
    const nextPath = `${p.slice(0, -'index.html'.length)}`;
    const rebuilt = `${nextPath}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
    return `href="${rebuilt}"`;
  });
}

function replaceAllInternalUrlStrings(html, replacements) {
  let out = String(html || '');
  for (const [from, to] of replacements) {
    if (!from) continue;
    out = out.split(from).join(to);
  }
  return out;
}

function buildRedirectStub({ title, toUrl, canonicalUrl }) {
  const safeTitle = String(title || 'Redirect').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeTo = String(toUrl || '').replace(/"/g, '&quot;');
  const safeCanon = String(canonicalUrl || toUrl || '').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="robots" content="noindex,follow">
  <link rel="canonical" href="${safeCanon}">
  <meta http-equiv="refresh" content="0; url=${safeTo}">
  <script>window.location.replace(${JSON.stringify(toUrl)});</script>
</head>
<body>
  <p>This page moved. If you are not redirected, <a href="${safeTo}">open the new URL</a>.</p>
</body>
</html>
`;
}

function isRedirectStub(html) {
  const s = String(html || '');
  return /http-equiv="refresh"/i.test(s) && /This page moved/i.test(s) && /window\.location\.replace/i.test(s);
}

function planMovesForSite(siteAbsDir) {
  const plans = [];

  const brokersDir = path.join(siteAbsDir, 'brokers');
  if (fs.existsSync(brokersDir)) {
    for (const f of fs.readdirSync(brokersDir)) {
      if (!f.toLowerCase().endsWith('.html')) continue;
      const relOld = `brokers/${f}`;
      const absOld = path.join(siteAbsDir, relOld);
      const html = read(absOld);
      const h1 = extractH1(html);
      const baseName = (h1 || f.replace(/\.html$/i, ''))
        .replace(/\(.*?\)/g, '')
        .replace(/\breview\b/gi, '')
        .replace(/\b\d{4}\b/g, '')
        .trim();
      const slug = slugify(baseName);
      const relNew = `brokers/${slug}-review/index.html`;
      plans.push({ kind: 'broker', relOld, relNew });
    }
  }

  const guidesDir = path.join(siteAbsDir, 'guides');
  if (fs.existsSync(guidesDir)) {
    for (const f of fs.readdirSync(guidesDir)) {
      if (!f.toLowerCase().endsWith('.html')) continue;
      if (f.toLowerCase() === 'index.html') continue; // keep hub at /guides/
      const relOld = `guides/${f}`;
      const absOld = path.join(siteAbsDir, relOld);
      const html = read(absOld);
      const h1 = extractH1(html);
      const baseTitle = (h1 || f.replace(/\.html$/i, ''))
        .replace(/\(.*?\)/g, '')
        .replace(/\b\d{4}\b/g, '')
        .trim();
      const relNew = `guides/${slugify(baseTitle)}/index.html`;
      plans.push({ kind: 'guide', relOld, relNew });
    }
  }

  const compareDir = path.join(siteAbsDir, 'compare');
  if (fs.existsSync(compareDir)) {
    for (const f of fs.readdirSync(compareDir)) {
      if (!f.toLowerCase().endsWith('.html')) continue;
      const relOld = `compare/${f}`;
      const stem = f.replace(/\.html$/i, '');
      if (stem === 'index') continue; // keep compare hub page

      // Normalize to {broker1}-vs-{broker2}
      const absOld = path.join(siteAbsDir, relOld);
      const html = read(absOld);
      const h1 = extractH1(html);
      let vsSlug = slugify(stem).replace(/-vs-/g, '-vs-');
      const m = String(h1 || '').match(/^\s*([a-z0-9 .&'-]+)\s+vs\.?\s+([a-z0-9 .&'-]+)\s*$/i);
      if (m?.[1] && m?.[2]) {
        vsSlug = `${slugify(m[1])}-vs-${slugify(m[2])}`;
      }
      const relNew = `compare/${vsSlug}/index.html`;
      plans.push({ kind: 'compare', relOld, relNew });
    }
  }

  return plans;
}

function applySite(site) {
  const siteAbs = path.join(ROOT, site.dir);
  const plans = planMovesForSite(siteAbs);
  const linkMap = new Map();
  for (const p of plans) linkMap.set(p.relOld, p.relNew);

  const canonicalBase = String(site.canonicalBase || '').replace(/\/+$/, '');
  const toPrettyRel = (relNew) => `/${relNew.replace(/\\/g, '/').replace(/index\.html$/i, '')}`;

  const replacements = [];
  for (const p of plans) {
    const fromRel = p.relOld.replace(/\\/g, '/');
    const toRelPretty = toPrettyRel(p.relNew).replace(/^\//, ''); // relative form
    replacements.push([fromRel, toRelPretty]);
    // Also replace absolute URLs that may reference old paths.
    replacements.push([`${canonicalBase}/${fromRel}`, `${canonicalBase}/${toRelPretty}`]);
    // Handle legacy pages.dev base for site1 internal URLs.
    if (site.key === 'site1') {
      replacements.push([`https://brokerproreviews.pages.dev/${fromRel}`, `${canonicalBase}/${toRelPretty}`]);
    }
  }
  // Normalize site1 internal base domain in JSON-LD where present.
  if (site.key === 'site1') {
    replacements.push(['https://brokerproreviews.pages.dev/', `${canonicalBase}/`]);
  }

  // 1) Create new pages, based on old pages content rewritten for new location.
  for (const p of plans) {
    const absOld = path.join(siteAbs, p.relOld);
    const absNew = path.join(siteAbs, p.relNew);
    const oldHtml = read(absOld);

    // Idempotency: never overwrite existing destination pages.
    if (fs.existsSync(absNew)) continue;
    // Never generate a destination page from an already-redirecting source.
    if (isRedirectStub(oldHtml)) continue;

    const newRelDir = path.posix.dirname(p.relNew);
    let next = rewriteAssets(oldHtml, newRelDir);
    next = rewriteInternalLinks(next, linkMap, p.relNew);
    next = replaceAllInternalUrlStrings(next, replacements);

    write(absNew, next);
  }

  // 2) Replace old pages with redirect stubs.
  for (const p of plans) {
    const absOld = path.join(siteAbs, p.relOld);
    const absNew = path.join(siteAbs, p.relNew);
    const newRelUrlPath = toPrettyRel(p.relNew);
    const oldRelUrlPath = `/${p.relOld.replace(/\\/g, '/')}`;

    const title = `Moved: ${p.relOld} → ${newRelUrlPath}`;
    // Keep redirect target relative to site root for portability.
    const toUrl = newRelUrlPath;
    const canonicalUrl = `${canonicalBase}${newRelUrlPath}`;

    const stub = buildRedirectStub({ title, toUrl, canonicalUrl });
    write(absOld, stub);

    // If the old file was in a folder that now only contains redirects, keep as-is; do not delete.
    // If any old directories were removed accidentally, skip.
    void absNew;
    void oldRelUrlPath;
  }

  // 3) Update other pages that reference old URLs.
  // Rewrite all HTML files under the site dir (excluding binaries) with linkMap.
  const allHtml = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) allHtml.push(abs);
    }
  };
  walk(siteAbs);

  for (const abs of allHtml) {
    const rel = path.relative(siteAbs, abs).replace(/\\/g, '/');
    // Skip newly created pages and redirect stubs are ok to keep.
    const html = read(abs);
    if (isRedirectStub(html)) continue;
    let next = rewriteInternalLinks(html, linkMap, rel);
    next = replaceAllInternalUrlStrings(next, replacements);
    next = normalizePrettyHrefs(next);
    if (next !== html) write(abs, next);
  }

  // 4) Cleanup: remove empty directories created by moves (best-effort).
  // (We intentionally keep original folders like brokers/ and guides/).
  removeDirIfEmpty(path.join(siteAbs, 'brokers'));
  removeDirIfEmpty(path.join(siteAbs, 'guides'));

  return { site: site.key, moved: plans.length };
}

function run() {
  const summaries = [];
  for (const s of SITE_DIRS) summaries.push(applySite(s));
  // eslint-disable-next-line no-console
  summaries.forEach((s) => console.log(`[urls] ${s.site}: planned ${s.moved} moves`));
}

run();

