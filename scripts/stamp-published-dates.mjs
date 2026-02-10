import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function isoNowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readFileRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function writeFileRel(relPath, next) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next, 'utf8');
}

function stampTimes(html, nowIso) {
  // Stamps only time elements explicitly marked for stamping.
  // After stamping, removes the marker so it won't change again.
  //
  // Usage in HTML for NEW posts:
  // <time class="news-date" data-relative-time="true" data-stamp-on-publish="true">Just now</time>
  //
  // The workflow will convert to:
  // <time class="news-date" datetime="2026-02-10T09:00:00Z" data-relative-time="true">Just now</time>
  const re = /<time\b([^>]*?)\bdata-stamp-on-publish\s*=\s*"true"([^>]*)>([\s\S]*?)<\/time>/g;

  let changed = false;
  const absDate = nowIso.split('T')[0];
  const next = html.replace(re, (_m, a, b, inner) => {
    const attrs = `${a}${b}`;

    // If datetime already exists, just remove the marker (keep content stable).
    if (/\bdatetime\s*=/.test(attrs)) {
      changed = true;
      const cleaned = attrs.replace(/\s*\bdata-stamp-on-publish\s*=\s*"true"\s*/g, ' ');
      return `<time${cleaned}>${inner}</time>`;
    }

    changed = true;
    const cleaned = attrs.replace(/\s*\bdata-stamp-on-publish\s*=\s*"true"\s*/g, ' ');
    const innerTrim = String(inner).trim();
    const shouldStampInnerDate = /data-show-absolute\s*=\s*"true"/.test(attrs) || innerTrim === 'Just now' || innerTrim === 'Publishing…';
    const nextInner = shouldStampInnerDate ? absDate : inner;
    return `<time${cleaned} datetime="${nowIso}">${nextInner}</time>`;
  });

  return { html: next, changed };
}

function run() {
  const nowIso = isoNowUtc();
  const targets = [
    'site1-dark-gradient/index.html',
    'site2-minimal-light/index.html',
  ];

  const updated = [];
  for (const relPath of targets) {
    const html = readFileRel(relPath);
    const res = stampTimes(html, nowIso);
    if (res.changed && res.html !== html) {
      writeFileRel(relPath, res.html);
      updated.push(relPath);
    }
  }

  // eslint-disable-next-line no-console
  if (updated.length) {
    console.log(`Stamped publish datetimes (${nowIso}) in: ${updated.join(', ')}`);
  } else {
    console.log('No publish datetimes to stamp.');
  }
}

run();

