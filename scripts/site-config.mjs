import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

export function discoverConfiguredSites() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  const sites = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!/^site\d+-/i.test(e.name)) continue;
    const abs = path.join(ROOT, e.name, 'site-config.json');
    if (!fs.existsSync(abs)) continue;
    const cfg = readJson(abs);
    if (!cfg?.baseUrl || !cfg?.siteName) continue;
    sites.push({
      key: cfg.key || e.name,
      dir: cfg.dir || e.name,
      siteName: cfg.siteName,
      baseUrl: String(cfg.baseUrl).replace(/\/+$/, ''),
      ogImage: cfg.ogImage,
      logoUrl: cfg.logoUrl || cfg.ogImage,
      twitterCard: cfg.twitterCard || 'summary_large_image',
    });
  }

  // Stable ordering (site1, site2, ...)
  sites.sort((a, b) => String(a.dir).localeCompare(String(b.dir), 'en'));
  return sites;
}

