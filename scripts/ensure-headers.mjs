import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function listSiteDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => e.name);
}

const CONTENT = `/*
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=86400

/*.css
  Cache-Control: public, max-age=86400

/*.js
  Cache-Control: public, max-age=86400

/*.webp
  Cache-Control: public, max-age=86400

/*.svg
  Cache-Control: public, max-age=86400
`;

function run() {
  const sites = listSiteDirs();
  for (const siteDir of sites) {
    const abs = path.join(ROOT, siteDir, '_headers');
    fs.writeFileSync(abs, CONTENT, 'utf8');
  }
  // eslint-disable-next-line no-console
  console.log(`[headers] wrote _headers for ${sites.length} sites`);
}

run();

