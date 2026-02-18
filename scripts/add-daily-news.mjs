import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function isoNowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function keyTodayUtc(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  if (currentKey && middle.includes(`data-daily-key="${currentKey}"`)) {
    return html;
  }

  const existingItems = middle.match(itemRegex) || [];
  const nextItems = [buildNewItem(), ...existingItems].slice(0, maxItems);

  // Keep formatting predictable: one leading newline + 20 spaces like the surrounding HTML.
  const indent = '\n' + ' '.repeat(20);
  const rebuilt = indent + nextItems.map((s) => s.trim()).join(indent) + '\n' + ' '.repeat(20);
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

function buildSite1DailyItem({ key }) {
  return `
<article class="news-card" data-daily-news="true" data-daily-key="${key}">
  <div class="news-image"></div>
  <div class="news-content">
    <span class="news-category" data-en="Daily Brief" data-es="Resumen diario">Daily Brief</span>
    <h3 class="news-title"
        data-en="LATAM Broker + Crypto/FX Brief — ${key}"
        data-es="Resumen LATAM Brokers + Cripto/FX — ${key}">LATAM Broker + Crypto/FX Brief — ${key}</h3>
    <p class="news-excerpt"
       data-en="Today’s checklist (LATAM): confirm the regulated entity for your country, review spreads on USD/MXN &amp; USD/BRL, check deposit/withdrawal rails, and verify whether crypto CFDs/spot are supported and restricted in your region."
       data-es="Checklist de hoy (LATAM): confirma la entidad regulada para tu país, revisa spreads en USD/MXN y USD/BRL, revisa depósitos/retiros y verifica si hay soporte y restricciones para cripto (CFDs/spot) en tu región.">Today’s checklist (LATAM): confirm the regulated entity for your country, review spreads on USD/MXN &amp; USD/BRL, check deposit/withdrawal rails, and verify whether crypto CFDs/spot are supported and restricted in your region.</p>
    <time class="news-date" data-relative-time="true" data-show-absolute="true" data-stamp-on-publish="true">Just now</time>
  </div>
</article>
`.trim();
}

function buildSite2DailyItem({ key }) {
  return `
<div class="card card-pad" data-daily-news="true" data-daily-key="${key}">
  <h3 class="card-title"
      data-en="Daily LATAM Broker &amp; Crypto/FX Brief — ${key}"
      data-es="Resumen diario LATAM (Brokers y Cripto/FX) — ${key}">Daily LATAM Broker &amp; Crypto/FX Brief — ${key}</h3>
  <p class="muted mb-1"
     data-en="Daily focus: LATAM broker conditions (local entity, fees, withdrawals) + forex &amp; crypto catalysts. Open the original headlines below, and always cross-check the regulator register for your jurisdiction."
     data-es="Enfoque diario: condiciones de brokers en LATAM (entidad local, comisiones, retiros) + catalizadores de forex y cripto. Abre los titulares originales abajo y valida siempre en el registro del regulador de tu jurisdicción.">Daily focus: LATAM broker conditions (local entity, fees, withdrawals) + forex &amp; crypto catalysts. Open the original headlines below, and always cross-check the regulator register for your jurisdiction.</p>
  <time class="muted small news-date" data-relative-time="true" data-show-absolute="true" data-stamp-on-publish="true">Just now</time>
</div>
`.trim();
}

function run() {
  const datetime = isoNowUtc();
  const key = keyTodayUtc(new Date());
  const updated = [];

  // site1
  {
    const relPath = 'site1-dark-gradient/index.html';
    const markerStart = '<!-- DAILY_NEWS_START -->';
    const markerEnd = '<!-- DAILY_NEWS_END -->';
    const html = readFileRel(relPath);
    const next = updateBetweenMarkers(html, {
      markerStart,
      markerEnd,
      buildNewItem: () => buildSite1DailyItem({ datetime, key }),
      itemRegex: /<article class="news-card" data-daily-news="true" data-daily-key="[^"]+">[\s\S]*?<\/article>/g,
      maxItems: 31,
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
    const markerStart = '<!-- DAILY_NEWS_START -->';
    const markerEnd = '<!-- DAILY_NEWS_END -->';
    const html = readFileRel(relPath);
    const next = updateBetweenMarkers(html, {
      markerStart,
      markerEnd,
      buildNewItem: () => buildSite2DailyItem({ datetime, key }),
      itemRegex: /<div class="card card-pad" data-daily-news="true" data-daily-key="[^"]+">[\s\S]*?<\/div>/g,
      maxItems: 31,
      currentKey: key,
    });
    if (next !== html) {
      writeFileRel(relPath, next);
      updated.push(relPath);
    }
  }

  // eslint-disable-next-line no-console
  if (updated.length) {
    console.log(`Daily news updated: ${updated.join(', ')} (key=${key} datetime=${datetime})`);
  } else {
    console.log(`Daily news already present (key=${key})`);
  }
}

run();

