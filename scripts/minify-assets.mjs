import fs from 'node:fs';
import path from 'node:path';
import CleanCSS from 'clean-css';
import { minify as terserMinify } from 'terser';

const ROOT = process.cwd();

function listSiteDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => e.name);
}

function walk(absDir) {
  const out = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function isMinifyTarget(absPath) {
  const p = absPath.replace(/\\/g, '/');
  if (p.includes('/node_modules/')) return false;
  if (p.includes('/scripts/')) return false;
  if (p.endsWith('.min.js') || p.endsWith('.min.css')) return false;
  if (p.endsWith('.js') || p.endsWith('.css')) return true;
  return false;
}

async function minifyJs(absPath) {
  const code = fs.readFileSync(absPath, 'utf8');
  const result = await terserMinify(code, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) return false;
  if (result.code === code) return false;
  fs.writeFileSync(absPath, result.code, 'utf8');
  return true;
}

function minifyCss(absPath) {
  const css = fs.readFileSync(absPath, 'utf8');
  const out = new CleanCSS({ level: 2 }).minify(css);
  if (!out.styles) return false;
  if (out.styles === css) return false;
  fs.writeFileSync(absPath, out.styles, 'utf8');
  return true;
}

async function run() {
  const sites = listSiteDirs();
  const roots = [...sites.map((s) => path.join(ROOT, s)), path.join(ROOT, 'shared')].filter((p) => fs.existsSync(p));

  const targets = [];
  for (const r of roots) {
    for (const f of walk(r)) {
      if (isMinifyTarget(f)) targets.push(f);
    }
  }

  let updated = 0;
  let jsUpdated = 0;
  let cssUpdated = 0;

  for (const absPath of targets) {
    if (absPath.endsWith('.css')) {
      if (minifyCss(absPath)) {
        updated += 1;
        cssUpdated += 1;
      }
    } else if (absPath.endsWith('.js')) {
      // eslint-disable-next-line no-await-in-loop
      if (await minifyJs(absPath)) {
        updated += 1;
        jsUpdated += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[minify] updated=${updated} (css=${cssUpdated}, js=${jsUpdated}) targets=${targets.length}`);
}

await run();

