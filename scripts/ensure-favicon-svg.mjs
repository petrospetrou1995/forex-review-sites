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

function faviconSvg({ label, bg1, bg2 }) {
  const text = String(label || 'BR').slice(0, 2).toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Site icon">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="26" font-weight="800" fill="#0b1220">${text}</text>
</svg>
`;
}

function ensureIconFile(siteDir) {
  const abs = path.join(ROOT, siteDir, 'favicon.svg');
  if (fs.existsSync(abs)) return;
  const label = siteDir.startsWith('site1') ? 'BP' : siteDir.startsWith('site2') ? 'BC' : 'BR';
  const svg = faviconSvg({ label, bg1: '#22d3ee', bg2: '#6366f1' });
  fs.writeFileSync(abs, svg, 'utf8');
}

function rewriteHtmlIcons(html) {
  let next = String(html || '');

  // Remove apple-touch-icon to avoid 404s unless explicitly provided.
  next = next.replace(/^\s*<link[^>]+rel="apple-touch-icon"[^>]*>\s*$/gim, '');

  // Normalize favicon to SVG (avoid missing favicon.ico in repo).
  // Common patterns seen in files:
  // - <link rel="icon" href="/favicon.ico">
  // - <link rel="icon" href="/favicon.ico" type="image/x-icon">
  next = next.replace(
    /<link([^>]+)rel="icon"([^>]+)href="\/favicon\.ico"([^>]*)>/gi,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
  );

  // Also handle cases where favicon.ico is referenced without leading slash.
  next = next.replace(
    /<link([^>]+)rel="icon"([^>]+)href="favicon\.ico"([^>]*)>/gi,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
  );

  // Remove now-empty lines introduced by apple-touch-icon removal.
  next = next.replace(/\n{3,}/g, '\n\n');
  return next;
}

function run() {
  const sites = listSiteDirs();
  let updated = 0;
  let scanned = 0;

  for (const siteDir of sites) {
    ensureIconFile(siteDir);
    const absSite = path.join(ROOT, siteDir);
    const htmlFiles = walkHtml(absSite);
    for (const absPath of htmlFiles) {
      if (shouldSkipHtml(absPath)) continue;
      const html = fs.readFileSync(absPath, 'utf8');
      const next = rewriteHtmlIcons(html);
      scanned += 1;
      if (next !== html) {
        fs.writeFileSync(absPath, next, 'utf8');
        updated += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[icons] updated ${updated}/${scanned} html files across ${sites.length} sites`);
}

run();

