import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SITES = [
  { key: 'site1', dir: 'site1-dark-gradient' },
  { key: 'site2', dir: 'site2-minimal-light' },
];

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

function decodeEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…');
}

function shouldSkip(rel) {
  const base = path.basename(rel);
  if (/^google[a-z0-9]+\.html$/i.test(base)) return true;
  return false;
}

function run() {
  const titleMin = 50;
  const titleMax = 60;
  const descMin = 140;
  const descMax = 160;

  const violations = [];

  for (const s of SITES) {
    const absDir = path.join(ROOT, s.dir);
    const files = listHtmlFiles(absDir);
    for (const abs of files) {
      const rel = path.relative(absDir, abs).replace(/\\/g, '/');
      if (shouldSkip(rel)) continue;
      const html = fs.readFileSync(abs, 'utf8');
      const title = decodeEntities(getFirst(html, /<title>([\s\S]*?)<\/title>/i)).trim();
      const desc = decodeEntities(getFirst(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i)).trim();
      const canonical = getFirst(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i).trim();

      const bad = [];
      if (!title || title.length < titleMin || title.length > titleMax) bad.push(`title(${title.length})`);
      if (!desc || desc.length < descMin || desc.length > descMax) bad.push(`desc(${desc.length})`);
      if (!canonical) bad.push('canonical(missing)');
      if (bad.length) violations.push({ site: s.key, rel, bad, title, desc });
    }
  }

  if (!violations.length) {
    // eslint-disable-next-line no-console
    console.log('OK: all pages meet title/description length + canonical requirements.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${violations.length} pages with violations.`);
  for (const v of violations.slice(0, 60)) {
    // eslint-disable-next-line no-console
    console.log(`- [${v.site}] ${v.rel}: ${v.bad.join(', ')}`);
  }
  if (violations.length > 60) {
    // eslint-disable-next-line no-console
    console.log(`... and ${violations.length - 60} more`);
  }
}

run();

