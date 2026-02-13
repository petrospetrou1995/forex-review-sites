import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function isoNowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ISO week (UTC) so the label is stable for the automation.
function getIsoWeekUTC(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides the year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: date.getUTCFullYear() };
}

function updateBetweenMarkers(html, { markerStart, markerEnd, buildNewItem, itemRegex, maxItems, currentKey }) {
  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Markers not found or invalid: ${markerStart} ... ${markerEnd}`);
  }

  const before = html.slice(0, startIdx + markerStart.length);
  const middle = html.slice(startIdx + markerStart.length, endIdx);
  const after = html.slice(endIdx);

  if (currentKey && middle.includes(`data-weekly-key="${currentKey}"`)) {
    return html;
  }

  const existingItems = middle.match(itemRegex) || [];
  const nextItems = [buildNewItem(), ...existingItems].slice(0, maxItems);

  // Keep formatting predictable: one leading newline + 20 spaces like the surrounding HTML.
  const indent = '\n' + ' '.repeat(20);
  const rebuilt = indent + nextItems.map(s => s.trim()).join(indent) + '\n' + ' '.repeat(20);

  return before + rebuilt + after;
}

function writeFileRel(relPath, next) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next, 'utf8');
}

function readFileRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function buildSite1NewsItem({ datetime, week, year, key }) {
  return `
<article class="news-card" data-weekly-news="true" data-weekly-key="${key}">
  <div class="news-image"></div>
  <div class="news-content">
    <span class="news-category" data-en="Weekly Brief" data-es="Resumen semanal">Weekly Brief</span>
    <h3 class="news-title"
        data-en="Weekly Forex Brief (BrokerProReviews) — Week ${week} (${year})"
        data-es="Resumen Forex Semanal (BrokerProReviews) — Semana ${week} (${year})">Weekly Forex Brief (BrokerProReviews) — Week ${week} (${year})</h3>
    <p class="news-excerpt"
       data-en="This week’s checklist: key macro dates, major FX themes, and risk-first reminders. Verify regulation, test withdrawals, and compare all-in costs before scaling."
       data-es="Checklist de la semana: fechas macro, temas FX y recordatorios de riesgo. Verifica regulación, prueba retiros y compara costos totales antes de escalar.">This week’s checklist: key macro dates, major FX themes, and risk-first reminders. Verify regulation, test withdrawals, and compare all-in costs before scaling.</p>
    <time class="news-date" data-relative-time="true" data-stamp-on-publish="true">Just now</time>
  </div>
</article>
`.trim();
}

function buildSite2NewsItem({ datetime, week, year, key }) {
  return `
<div class="card card-pad" data-weekly-news="true" data-weekly-key="${key}">
  <h3 class="card-title"
      data-en="Weekly Market Brief (Brokercompare) — Week ${week} (${year})"
      data-es="Resumen Semanal de Mercado (Brokercompare) — Semana ${week} (${year})">Weekly Market Brief (Brokercompare) — Week ${week} (${year})</h3>
  <p class="muted mb-1"
     data-en="A short weekly snapshot: what matters, what to watch, and what to avoid. Compare platforms and regulation, then test deposits/withdrawals with a small amount."
     data-es="Snapshot semanal: qué importa, qué vigilar y qué evitar. Compara plataformas y regulación, y prueba depósitos/retiros con un monto pequeño.">A short weekly snapshot: what matters, what to watch, and what to avoid. Compare platforms and regulation, then test deposits/withdrawals with a small amount.</p>
  <time class="muted small news-date" data-relative-time="true" data-stamp-on-publish="true">Just now</time>
</div>
`.trim();
}

function run() {
  const datetime = isoNowUtc();
  const { week, year } = getIsoWeekUTC(new Date());
  const key = `${year}-W${pad2(week)}`;
  const updated = [];

  // site1
  {
    const relPath = 'site1-dark-gradient/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    const html = readFileRel(relPath);
    const next = updateBetweenMarkers(html, {
      markerStart,
      markerEnd,
      buildNewItem: () => buildSite1NewsItem({ datetime, week, year, key }),
      itemRegex: /<article class="news-card" data-weekly-news="true" data-weekly-key="[^"]+">[\s\S]*?<\/article>/g,
      maxItems: 12,
      currentKey: key,
    });
    if (next !== html) {
      writeFileRel(relPath, next);
      updated.push(relPath);
    }
  }

  // site2
  {
    const relPath = 'site2-minimal-light/news/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    const html = readFileRel(relPath);
    const next = updateBetweenMarkers(html, {
      markerStart,
      markerEnd,
      buildNewItem: () => buildSite2NewsItem({ datetime, week, year, key }),
      itemRegex: /<div class="card card-pad" data-weekly-news="true" data-weekly-key="[^"]+">[\s\S]*?<\/div>/g,
      maxItems: 12,
      currentKey: key,
    });
    if (next !== html) {
      writeFileRel(relPath, next);
      updated.push(relPath);
    }
  }

  // eslint-disable-next-line no-console
  if (updated.length) {
    console.log(`Weekly news updated: ${updated.join(', ')} (key=${key} datetime=${datetime})`);
  } else {
    console.log(`Weekly news already present (key=${key})`);
  }
}

run();

