import fs from 'node:fs';
import path from 'node:path';

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

function stripHashAndQuery(u) {
  const s = String(u || '');
  const hash = s.indexOf('#');
  const q = s.indexOf('?');
  const cut = [hash, q].filter((n) => n >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? s : s.slice(0, cut);
}

function isSkippableUrl(u) {
  const s = String(u || '').trim();
  if (!s) return true;
  if (s === '#') return true;
  if (s.startsWith('#')) return true;
  if (/^(https?:)?\/\//i.test(s)) return true;
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(s)) return true;
  return false;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function extractUrls(html) {
  const s = String(html || '');
  const urls = [];

  const pushAll = (re) => {
    let m;
    while ((m = re.exec(s))) urls.push(m[1]);
  };

  // Resource loads
  pushAll(/<link\b[^>]*\bhref="([^"]+)"/gi);
  pushAll(/<script\b[^>]*\bsrc="([^"]+)"/gi);
  pushAll(/<img\b[^>]*\bsrc="([^"]+)"/gi);
  pushAll(/<source\b[^>]*\bsrcset="([^"]+)"/gi);

  // Navigation
  pushAll(/<a\b[^>]*\bhref="([^"]+)"/gi);

  // srcset can contain multiple URLs: "a.webp 1x, b.webp 2x"
  const expanded = [];
  for (const u of urls) {
    if (!u) continue;
    if (u.includes(' ')) {
      const parts = u
        .split(',')
        .map((p) => p.trim().split(/\s+/)[0])
        .filter(Boolean);
      expanded.push(...parts);
    } else {
      expanded.push(u);
    }
  }

  return uniq(expanded.map((u) => String(u).trim()).filter(Boolean));
}

function fileExists(abs) {
  try {
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}

function resolveTarget(absSiteRoot, absHtmlFile, url) {
  const raw = stripHashAndQuery(url);
  if (!raw || isSkippableUrl(raw)) return null;

  const isAbs = raw.startsWith('/');
  const baseDir = path.dirname(absHtmlFile);
  const abs = isAbs ? path.join(absSiteRoot, raw.slice(1)) : path.resolve(baseDir, raw);

  const candidates = [];
  const endsWithSlash = raw.endsWith('/');
  const hasExt = path.posix.basename(raw).includes('.') && !endsWithSlash;

  if (endsWithSlash) {
    candidates.push(path.join(abs, 'index.html'));
  } else if (hasExt) {
    candidates.push(abs);
  } else {
    // Directory route or extensionless file link
    candidates.push(abs);
    candidates.push(`${abs}.html`);
    candidates.push(path.join(abs, 'index.html'));
  }

  return { raw, abs, candidates };
}

function isRedirectStub(html) {
  const s = String(html || '');
  return /http-equiv="refresh"/i.test(s) && /window\.location\.replace/i.test(s);
}

function checkSite(site) {
  const absDir = path.join(ROOT, site.dir);
  const htmlFiles = listHtmlFiles(absDir);

  const errors = [];
  let scanned = 0;

  for (const absHtml of htmlFiles) {
    const relHtml = path.relative(absDir, absHtml).replace(/\\/g, '/');
    const html = fs.readFileSync(absHtml, 'utf8');
    scanned += 1;

    const urls = extractUrls(html)
      // canonical/OG/Twitter are URLs but not filesystem resources
      .filter((u) => !/^\s*https?:\/\//i.test(u))
      .filter((u) => !/^\/\//.test(u));

    for (const u of urls) {
      const target = resolveTarget(absDir, absHtml, u);
      if (!target) continue;

      const ok = target.candidates.some(fileExists);
      if (!ok) {
        errors.push({
          file: relHtml,
          url: u,
          resolved: target.abs.replace(absDir + path.sep, '').replace(/\\/g, '/'),
          candidates: target.candidates.map((c) => c.replace(absDir + path.sep, '').replace(/\\/g, '/')),
          kind: isRedirectStub(html) ? 'redirect-stub' : 'html',
        });
      }
    }
  }

  return { site: site.dir, scanned, errors };
}

function printReport(report) {
  const totalErrors = report.reduce((sum, r) => sum + r.errors.length, 0);
  const totalScanned = report.reduce((sum, r) => sum + r.scanned, 0);

  // eslint-disable-next-line no-console
  console.log(`[integrity] scanned ${totalScanned} HTML files across ${report.length} sites`);
  // eslint-disable-next-line no-console
  console.log(`[integrity] ${totalErrors} missing targets`);

  for (const r of report) {
    if (!r.errors.length) continue;
    // eslint-disable-next-line no-console
    console.log(`\n[${r.site}] ${r.errors.length} issues`);
    for (const e of r.errors.slice(0, 60)) {
      // eslint-disable-next-line no-console
      console.log(`- ${e.file} -> ${e.url} (tried: ${e.candidates.join(', ')})`);
    }
    if (r.errors.length > 60) {
      // eslint-disable-next-line no-console
      console.log(`  ... and ${r.errors.length - 60} more`);
    }
  }
}

function main() {
  const sites = discoverSites();
  const report = sites.map(checkSite);
  printReport(report);

  const totalErrors = report.reduce((sum, r) => sum + r.errors.length, 0);
  process.exitCode = totalErrors ? 1 : 0;
}

main();

