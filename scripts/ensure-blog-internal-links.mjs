import fs from 'node:fs';
import path from 'node:path';
import { BROKERS } from './brokers-data.mjs';

const ROOT = process.cwd();

const SITE_DIRS = ['site1-dark-gradient', 'site2-minimal-light'];

function walk(dirAbs) {
  const out = [];
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function isRedirectStub(html) {
  const s = String(html || '');
  return /http-equiv="refresh"/i.test(s) && /This page moved/i.test(s) && /window\.location\.replace/i.test(s);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function removeBetween(html, start, end) {
  const s = String(html || '');
  const re = new RegExp(`${start}[\\s\\S]*?${end}\\s*`, 'i');
  return s.replace(re, '');
}

function insertBefore(html, needle, insertion) {
  const idx = html.lastIndexOf(needle);
  if (idx === -1) return html;
  return html.slice(0, idx) + insertion + '\n' + html.slice(idx);
}

function isHub(relFromSite) {
  const r = relFromSite.replace(/\\/g, '/');
  if (r === 'guides/index.html') return true;
  if (r === 'news/daily/index.html') return true;
  if (r === 'news/weekly/index.html') return true;
  return false;
}

function isTargetArticle(relFromSite) {
  const r = relFromSite.replace(/\\/g, '/');
  if (!r.endsWith('/index.html') && !r.endsWith('index.html')) return false;
  if (isHub(r)) return false;
  return r.startsWith('guides/') || r.startsWith('news/daily/') || r.startsWith('news/weekly/');
}

function depthPrefix(relFromSiteDir) {
  const relDir = path.posix.dirname(relFromSiteDir.replace(/\\/g, '/'));
  if (!relDir || relDir === '.') return '';
  const segs = relDir.split('/').filter(Boolean);
  return '../'.repeat(segs.length);
}

function detectMentionedBrokers(text) {
  const t = String(text || '');
  const hits = [];
  for (const b of BROKERS) {
    const re = new RegExp(`\\b${String(b.name).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    if (re.test(t)) hits.push(b);
  }
  return hits;
}

function topRatedBrokers(max = 3) {
  return [...BROKERS]
    .filter((b) => Number.isFinite(Number(b.ratingValue)))
    .sort((a, b) => Number(b.ratingValue) - Number(a.ratingValue))
    .slice(0, max);
}

function buildRelatedSection({ siteKey, fromRel, brokers }) {
  const prefix = depthPrefix(fromRel);
  const items = (brokers || []).slice(0, 3);
  if (!items.length) return '';

  const links = items
    .map((b) => {
      const href = `${prefix}brokers/${b.slug}-review/`;
      const en = `Read ${b.name} review (fees, platforms & safety) →`;
      const es = `Leer reseña de ${b.name} (comisiones, plataformas y seguridad) →`;
      const cls = siteKey === 'site1' ? 'link-cta' : 'btn-link';
      const liCls = siteKey === 'site1' ? '' : 'muted';
      return `<li class="${liCls}"><a class="${cls}" href="${escapeAttr(href)}" data-en="${escapeAttr(en)}" data-es="${escapeAttr(es)}">${escapeHtml(en)}</a></li>`;
    })
    .join('');

  if (siteKey === 'site1') {
    return `
<!-- RELATED_BROKER_REVIEWS:START -->
<div class="card-panel">
  <h2 class="subheading-card" data-en="Related broker reviews" data-es="Reseñas de brokers relacionadas">Related broker reviews</h2>
  <p class="rating-small" data-en="If this topic affects your broker choice, these reviews help you compare fees, platforms, and safety checks." data-es="Si este tema afecta tu elección, estas reseñas ayudan a comparar comisiones, plataformas y seguridad.">
    If this topic affects your broker choice, these reviews help you compare fees, platforms, and safety checks.
  </p>
  <ul class="guide-related-list">
    ${links}
  </ul>
</div>
<!-- RELATED_BROKER_REVIEWS:END -->
`.trim();
  }

  return `
<!-- RELATED_BROKER_REVIEWS:START -->
<div class="card card-pad mt-3">
  <h2 class="card-title" data-en="Related broker reviews" data-es="Reseñas de brokers relacionadas">Related broker reviews</h2>
  <p class="muted small" data-en="These reviews can help you compare fees, platforms, and safety checks related to this topic." data-es="Estas reseñas te ayudan a comparar comisiones, plataformas y seguridad relacionadas con este tema.">
    These reviews can help you compare fees, platforms, and safety checks related to this topic.
  </p>
  <ul>
    ${links}
  </ul>
</div>
<!-- RELATED_BROKER_REVIEWS:END -->
`.trim();
}

function ensureForFile({ siteDir, absPath }) {
  const html = fs.readFileSync(absPath, 'utf8');
  if (isRedirectStub(html)) return { changed: false };

  const relFromSite = path.relative(path.join(ROOT, siteDir), absPath).replace(/\\/g, '/');
  if (!isTargetArticle(relFromSite)) return { changed: false };

  const mentioned = detectMentionedBrokers(html);
  const isGuide = relFromSite.startsWith('guides/');
  const isChoosing = relFromSite.startsWith('guides/choosing-broker/');
  const isNews = relFromSite.startsWith('news/daily/') || relFromSite.startsWith('news/weekly/');
  const candidates = mentioned.length
    ? mentioned
    : isGuide
      ? (isChoosing ? topRatedBrokers(3) : topRatedBrokers(2))
      : isNews
        ? topRatedBrokers(2)
        : [];
  const siteKey = siteDir === 'site1-dark-gradient' ? 'site1' : 'site2';
  const section = buildRelatedSection({ siteKey, fromRel: relFromSite, brokers: candidates });
  if (!section) return { changed: false };

  let next = html;
  next = removeBetween(next, '<!-- RELATED_BROKER_REVIEWS:START -->', '<!-- RELATED_BROKER_REVIEWS:END -->');

  // Prefer inserting near the end of the main content.
  if (next.includes('</article>')) next = insertBefore(next, '</article>', `\n${section}\n`);
  else if (next.includes('</main>')) next = insertBefore(next, '</main>', `\n${section}\n`);
  else return { changed: false };

  if (next === html) return { changed: false };
  fs.writeFileSync(absPath, next, 'utf8');
  return { changed: true };
}

function run() {
  let updated = 0;
  let total = 0;

  for (const siteDir of SITE_DIRS) {
    const absSite = path.join(ROOT, siteDir);
    if (!fs.existsSync(absSite)) continue;
    const files = walk(absSite).filter((p) => p.endsWith('.html'));
    for (const absPath of files) {
      total += 1;
      const r = ensureForFile({ siteDir, absPath });
      if (r.changed) updated += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[internal-links] updated ${updated}/${total} html files`);
}

run();

