import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_DIR = path.join(ROOT, 'site1-dark-gradient');
const MEASUREMENT_ID = 'G-SX1P4XJ6NM';
const NEEDLE = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

function listHtmlFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listHtmlFiles(abs));
      continue;
    }
    if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

function shouldSkip(absPath) {
  const rel = path.relative(SITE_DIR, absPath).replace(/\\/g, '/');
  if (rel === 'google18184e8d02417728.html') return true;
  if (/^google[a-z0-9]+\.html$/i.test(path.basename(rel))) return true;
  return false;
}

function buildSnippet(indent) {
  const i = indent ?? '';
  return [
    `${i}<!-- Google tag (gtag.js) -->`,
    `${i}<script async src="${NEEDLE}"></script>`,
    `${i}<script>`,
    `${i}    window.dataLayer = window.dataLayer || [];`,
    `${i}    function gtag(){dataLayer.push(arguments);}`,
    `${i}    gtag('js', new Date());`,
    `${i}    gtag('config', '${MEASUREMENT_ID}');`,
    `${i}</script>`,
  ].join('\n');
}

function addSnippetToHtml(html) {
  if (html.includes(NEEDLE) || html.includes(`gtag('config', '${MEASUREMENT_ID}')`)) return { html, changed: false };
  const headCloseIdx = html.toLowerCase().lastIndexOf('</head>');
  if (headCloseIdx === -1) return { html, changed: false };

  const before = html.slice(0, headCloseIdx);
  const after = html.slice(headCloseIdx);

  const headCloseLine = before.slice(Math.max(0, before.lastIndexOf('\n') + 1));
  const indent = (headCloseLine.match(/^\s+/) || [''])[0];

  const snippet = buildSnippet(indent);
  const joined = `${before}\n\n${snippet}\n${after}`;
  return { html: joined, changed: true };
}

function run() {
  const files = listHtmlFiles(SITE_DIR);
  let changedCount = 0;
  for (const abs of files) {
    if (shouldSkip(abs)) continue;
    const html = fs.readFileSync(abs, 'utf8');
    const next = addSnippetToHtml(html);
    if (!next.changed) continue;
    fs.writeFileSync(abs, next.html, 'utf8');
    changedCount += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`GA4 snippet ensured for site1. Updated files: ${changedCount}`);
}

run();

