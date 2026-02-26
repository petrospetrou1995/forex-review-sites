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

function updateBetweenMarkers(html, { markerStart, markerEnd, buildNewItem, itemRegex, maxItems, currentKey, replaceExisting = false }) {
  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Markers not found or invalid: ${markerStart} ... ${markerEnd}`);
  }

  const before = html.slice(0, startIdx + markerStart.length);
  const middle = html.slice(startIdx + markerStart.length, endIdx);
  const after = html.slice(endIdx);

  const existingItems = middle.match(itemRegex) || [];
  const nextNew = buildNewItem();
  const hasCurrent = currentKey ? existingItems.some((s) => s.includes(`data-weekly-key="${currentKey}"`)) : false;
  if (hasCurrent && !replaceExisting) return html;
  const nextItems = hasCurrent
    ? existingItems.map((s) => (s.includes(`data-weekly-key="${currentKey}"`) ? nextNew : s)).slice(0, maxItems)
    : [nextNew, ...existingItems].slice(0, maxItems);

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

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function joinHref(base, key) {
  const b = String(base || '').replace(/\/+$/, '');
  if (!b) return `${key}/`;
  return `${b}/${key}/`;
}

function weekKeyToRange(key) {
  const m = String(key || '').match(/^(\d{4})-W(\d{2})$/);
  if (!m) return { startIso: '2026-01-01', endIso: '2026-01-07' };
  const year = Number(m[1]);
  const week = Number(m[2]);
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const start = new Date(simple);
  if (dow <= 4) start.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else start.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  return { startIso, endIso };
}

function weekKeyToDatetime(key) {
  const { startIso } = weekKeyToRange(key);
  return `${startIso}T00:00:00Z`;
}

function extractBetweenMarkers(html, markerStart, markerEnd) {
  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return '';
  return html.slice(startIdx + markerStart.length, endIdx);
}

function replaceBetweenMarkers(html, markerStart, markerEnd, nextInner, indentSpaces = 20) {
  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Markers not found or invalid: ${markerStart} ... ${markerEnd}`);
  }
  const before = html.slice(0, startIdx + markerStart.length);
  const after = html.slice(endIdx);
  const indent = '\n' + ' '.repeat(indentSpaces);
  const inner = nextInner?.trim() ? indent + nextInner.trim() + '\n' + ' '.repeat(indentSpaces) : indent + '\n' + ' '.repeat(indentSpaces);
  return before + inner + after;
}

function buildSite1NewsItem({ week, year, key, hrefBase = 'news/weekly' }) {
  const href = joinHref(hrefBase, key);
  const { startIso, endIso } = weekKeyToRange(key);
  const titleEn = `Weekly Forex Brief (BrokerProReviews) — Week ${week} (${year})`;
  const titleEs = `Resumen Forex Semanal (BrokerProReviews) — Semana ${week} (${year})`;
  const excerptEn = `Week range: ${startIso} → ${endIso}. Macro themes, pairs to watch, LATAM checklist, and risk rules.`;
  const excerptEs = `Rango semanal: ${startIso} → ${endIso}. Temas macro, pares a vigilar, checklist LATAM y reglas de riesgo.`;
  return `
<article class="news-card" data-weekly-news="true" data-weekly-key="${key}">
  <div class="news-image"></div>
  <div class="news-content">
    <span class="news-category" data-en="Weekly Brief" data-es="Resumen semanal">Weekly Brief</span>
    <h3 class="news-title">
      <a class="link-cta" href="${href}" data-en="${escapeAttr(titleEn)}" data-es="${escapeAttr(titleEs)}">${escapeText(titleEn)}</a>
    </h3>
    <p class="news-excerpt" data-en="${escapeAttr(excerptEn)}" data-es="${escapeAttr(excerptEs)}">${escapeText(excerptEn)}</p>
    <time class="news-date" datetime="${weekKeyToDatetime(key)}" data-relative-time="true" data-show-absolute="true">${weekKeyToRange(key).startIso}</time>
  </div>
</article>
`.trim();
}

function buildSite2NewsItem({ week, year, key, hrefBase = 'weekly' }) {
  const href = joinHref(hrefBase, key);
  const { startIso, endIso } = weekKeyToRange(key);
  const titleEn = `Weekly Market Brief (Brokercompare) — Week ${week} (${year})`;
  const titleEs = `Resumen Semanal de Mercado (Brokercompare) — Semana ${week} (${year})`;
  const excerptEn = `Week range: ${startIso} → ${endIso}. A short weekly snapshot (LATAM): what matters, what to watch, and what to double-check.`;
  const excerptEs = `Rango semanal: ${startIso} → ${endIso}. Snapshot semanal (LATAM): qué importa, qué vigilar y qué revisar.`;
  return `
<div class="card card-pad" data-weekly-news="true" data-weekly-key="${key}">
  <h3 class="card-title">
    <a class="btn-link" href="${href}" data-en="${escapeAttr(titleEn)}" data-es="${escapeAttr(titleEs)}">${escapeText(titleEn)}</a>
  </h3>
  <p class="muted mb-1" data-en="${escapeAttr(excerptEn)}" data-es="${escapeAttr(excerptEs)}">${escapeText(excerptEn)}</p>
  <time class="muted small news-date" datetime="${weekKeyToDatetime(key)}" data-relative-time="true" data-show-absolute="true">${weekKeyToRange(key).startIso}</time>
</div>
`.trim();
}

function buildSite1WeeklyPageHtml({ key, week, year, datetime }) {
  const canonical = `https://brokerproreviews.com/news/weekly/${key}/`;
  const { startIso, endIso } = weekKeyToRange(key);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Forex Brief — Week ${week} (${year}) | BrokerProReviews</title>
  <meta name="description" content="Weekly LATAM-focused forex brief: macro themes, what to watch, broker checklist, and risk rules.">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#0b1220">
  <link rel="stylesheet" href="../../../styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <header class="header guide-header">
    <nav class="nav guide-nav">
      <div class="container">
        <div class="nav-content">
          <a class="logo" href="../../../index.html" aria-label="BrokerProReviews home">
            <span class="logo-icon">📊</span>
            <span class="logo-text">BrokerProReviews</span>
          </a>
          <div class="nav-actions">
            <a class="guide-back link-cta" href="../../../index.html#news" data-en="← Back to news" data-es="← Volver a noticias">← Back to news</a>
            <button class="lang-toggle" id="langToggle" type="button">ES</button>
          </div>
        </div>
      </div>
    </nav>
  </header>

  <main class="section-pad section-pad-dark">
    <div class="container">
      <article class="guide-article">
        <h1 class="guide-title"
            data-en="Weekly Forex Brief (LATAM) — Week ${week} (${year})"
            data-es="Resumen Forex Semanal (LATAM) — Semana ${week} (${year})">Weekly Forex Brief (LATAM) — Week ${week} (${year})</h1>
        <p class="guide-lead"
           data-en="A practical weekly plan: what matters, what to watch, and what to double-check before trading (especially for LATAM)."
           data-es="Un plan semanal práctico: qué importa, qué vigilar y qué revisar dos veces antes de operar (especialmente en LATAM).">A practical weekly plan: what matters, what to watch, and what to double-check before trading (especially for LATAM).</p>
        <p class="rating-small" data-en="Week range: ${startIso} → ${endIso}" data-es="Rango semanal: ${startIso} → ${endIso}">Week range: ${startIso} → ${endIso}</p>
        <time class="news-date" datetime="${datetime}" data-relative-time="true" data-show-absolute="true">${datetime.split('T')[0]}</time>

        <div class="card-panel mt-5">
          <h2 class="section-subheading" data-en="1) Macro themes to watch" data-es="1) Temas macro a vigilar">1) Macro themes to watch</h2>
          <ul class="card-list">
            <li data-en="Rate path: watch central bank communication and surprise inflation prints." data-es="Ruta de tasas: vigila comunicación de bancos centrales y sorpresas de inflación.">Rate path: watch central bank communication and surprise inflation prints.</li>
            <li data-en="Risk mood: equities/credit volatility can spill into FX (carry vs safe havens)." data-es="Sentimiento de riesgo: volatilidad en acciones/crédito puede afectar FX (carry vs refugios).">Risk mood: equities/credit volatility can spill into FX (carry vs safe havens).</li>
            <li data-en="Energy + commodities: key for BRL/COP/CLP terms-of-trade sensitivity." data-es="Energía y commodities: clave para sensibilidad de BRL/COP/CLP.">Energy + commodities: key for BRL/COP/CLP terms-of-trade sensitivity.</li>
          </ul>
        </div>

        <div class="card-panel mt-4">
          <h2 class="section-subheading" data-en="2) LATAM trading checklist" data-es="2) Checklist de trading LATAM">2) LATAM trading checklist</h2>
          <ul class="card-list">
            <li data-en="Confirm which regulated entity serves your country (same brand ≠ same license)." data-es="Confirma qué entidad regulada atiende tu país (misma marca ≠ misma licencia).">Confirm which regulated entity serves your country (same brand ≠ same license).</li>
            <li data-en="Test deposits/withdrawals with a small amount (fees, time, bank rails)." data-es="Prueba depósitos/retiros con monto pequeño (comisiones, tiempo, rieles bancarios).">Test deposits/withdrawals with a small amount (fees, time, bank rails).</li>
            <li data-en="Check spreads around local open/close and during US data releases." data-es="Revisa spreads en aperturas/cierres locales y durante datos de EE. UU.">Check spreads around local open/close and during US data releases.</li>
          </ul>
        </div>

        <div class="card-panel mt-4">
          <h2 class="section-subheading" data-en="3) Risk rules for the week" data-es="3) Reglas de riesgo para la semana">3) Risk rules for the week</h2>
          <ul class="card-list">
            <li data-en="Define max daily loss and stop when hit (avoid revenge trading)." data-es="Define pérdida máxima diaria y detente al alcanzarla (evita revancha).">Define max daily loss and stop when hit (avoid revenge trading).</li>
            <li data-en="Predefine invalidation levels; don’t widen stops after entry." data-es="Define niveles de invalidez; no amplíes stops después de entrar.">Predefine invalidation levels; don’t widen stops after entry.</li>
            <li data-en="If volatility spikes, cut size first—then reduce frequency." data-es="Si sube la volatilidad, reduce tamaño primero—luego frecuencia.">If volatility spikes, cut size first—then reduce frequency.</li>
          </ul>
        </div>
      </article>
    </div>
  </main>

  <script src="../../../translations.js"></script>
</body>
</html>`;
}

function buildSite2WeeklyPageHtml({ key, week, year, datetime }) {
  const canonical = `https://brokercompare.com/news/weekly/${key}/`;
  const { startIso, endIso } = weekKeyToRange(key);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Market Brief — Week ${week} (${year}) | Brokercompare</title>
  <meta name="description" content="Weekly LATAM market brief: broker checklist, forex catalysts, and risk rules.">
  <link rel="canonical" href="${canonical}">
  <link rel="stylesheet" href="../../../styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <header class="header">
    <div class="container">
      <nav class="navbar">
        <a class="logo" href="../../../index.html">Brokercompare</a>
        <ul class="nav-links" id="primaryNav">
          <li><a href="../../../index.html#brokers" data-en="Brokers" data-es="Brokers">Brokers</a></li>
          <li><a href="../../../reviews/" data-en="Reviews" data-es="Reseñas">Reviews</a></li>
          <li><a href="../../../compare/" data-en="Compare" data-es="Comparar">Compare</a></li>
          <li><a href="../../../strategies/" data-en="Strategies" data-es="Estrategias">Strategies</a></li>
          <li><a href="../../../index.html#tools" data-en="Tools" data-es="Herramientas">Tools</a></li>
          <li><a href="../../../learn/" data-en="Learn" data-es="Aprender">Learn</a></li>
          <li><a href="../../" data-en="News" data-es="Noticias">News</a></li>
        </ul>
        <div class="nav-right">
          <button class="menu-btn" id="menuToggle" type="button" aria-controls="primaryNav" aria-expanded="false" data-en="Menu" data-es="Menú">Menu</button>
          <button class="lang-btn" id="langToggle" type="button">ES</button>
        </div>
      </nav>
    </div>
  </header>

  <main>
    <section class="intro">
      <div class="container">
        <h1 class="intro-title"
            data-en="Weekly market brief (LATAM) — Week ${week} (${year})"
            data-es="Resumen semanal (LATAM) — Semana ${week} (${year})">Weekly market brief (LATAM) — Week ${week} (${year})</h1>
        <p class="intro-text"
           data-en="A practical weekly plan for LATAM traders: broker checks, forex catalysts, and risk rules."
           data-es="Plan semanal práctico para traders en LATAM: checklist de brokers, catalizadores de FX y reglas de riesgo.">A practical weekly plan for LATAM traders: broker checks, forex catalysts, and risk rules.</p>
        <p class="muted small" data-en="Week range: ${startIso} → ${endIso}" data-es="Rango semanal: ${startIso} → ${endIso}">Week range: ${startIso} → ${endIso}</p>
        <time class="muted small news-date" datetime="${datetime}" data-relative-time="true" data-show-absolute="true">${datetime.split('T')[0]}</time>
      </div>
    </section>

    <section class="section section--alt">
      <div class="container">
        <div class="card card-pad">
          <h2 class="card-title" data-en="Broker checklist" data-es="Checklist de brokers">Broker checklist</h2>
          <ul class="muted">
            <li data-en="Verify the exact regulated entity for your LATAM country." data-es="Verifica la entidad regulada exacta para tu país en LATAM.">Verify the exact regulated entity for your LATAM country.</li>
            <li data-en="Compare all-in costs (spreads + commission + swaps)." data-es="Compara costos totales (spreads + comisión + swaps).">Compare all-in costs (spreads + commission + swaps).</li>
            <li data-en="Test withdrawals early; track fees and settlement time." data-es="Prueba retiros temprano; registra comisiones y tiempos.">Test withdrawals early; track fees and settlement time.</li>
          </ul>
        </div>

        <div class="card card-pad">
          <h2 class="card-title" data-en="Forex catalysts" data-es="Catalizadores FX">Forex catalysts</h2>
          <ul class="muted">
            <li data-en="Inflation and rate expectations (local + US) drive FX volatility." data-es="Inflación y expectativas de tasas (local + EE. UU.) impulsan volatilidad FX.">Inflation and rate expectations (local + US) drive FX volatility.</li>
            <li data-en="Watch USD/MXN and USD/BRL liquidity windows for spread changes." data-es="Vigila ventanas de liquidez de USD/MXN y USD/BRL por cambios de spread.">Watch USD/MXN and USD/BRL liquidity windows for spread changes.</li>
          </ul>
        </div>

        <div class="card card-pad">
          <h2 class="card-title" data-en="Risk rules" data-es="Reglas de riesgo">Risk rules</h2>
          <ul class="muted">
            <li data-en="Set a daily loss cap and stop when hit." data-es="Define un tope de pérdida diaria y detente al alcanzarlo.">Set a daily loss cap and stop when hit.</li>
            <li data-en="Reduce size first when volatility spikes." data-es="Reduce tamaño primero si sube la volatilidad.">Reduce size first when volatility spikes.</li>
          </ul>
        </div>
      </div>
    </section>
  </main>

  <script src="../../../translations.js"></script>
  <script>
    (function () {
      var btn = document.getElementById('menuToggle');
      var nav = document.getElementById('primaryNav');
      if (!btn || !nav) return;
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        nav.classList.toggle('is-open', !expanded);
      });
    })();
  </script>
</body>
</html>`;
}

function run() {
  const datetime = isoNowUtc();
  const { week, year } = getIsoWeekUTC(new Date());
  const key = `${year}-W${pad2(week)}`;
  const updated = [];

  // Weekly pages (write once per week)
  {
    const relPath = `site1-dark-gradient/news/weekly/${key}/index.html`;
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) {
      writeFileRel(relPath, buildSite1WeeklyPageHtml({ key, week, year, datetime }));
      updated.push(relPath);
    }
  }

  {
    const relPath = `site2-minimal-light/news/weekly/${key}/index.html`;
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) {
      writeFileRel(relPath, buildSite2WeeklyPageHtml({ key, week, year, datetime }));
      updated.push(relPath);
    }
  }

  // Update site1 All News page weekly list
  {
    const relPath = 'site1-dark-gradient/news/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    try {
      const html = readFileRel(relPath);
      const middle = extractBetweenMarkers(html, markerStart, markerEnd);
      const keys = Array.from(new Set([key, ...Array.from(middle.matchAll(/data-weekly-key="(\d{4}-W\d{2})"/g)).map(m => m[1])])).slice(0, 24);
      const nextInner = keys.map((k) => {
        const mm = String(k).match(/^(\d{4})-W(\d{2})$/);
        const y = Number(mm?.[1] || year);
        const w = Number(mm?.[2] || week);
        return buildSite1NewsItem({ week: w, year: y, key: k, hrefBase: 'weekly' });
      }).join('\n');
      const next = replaceBetweenMarkers(html, markerStart, markerEnd, nextInner, 20);
      if (next !== html) { writeFileRel(relPath, next); updated.push(relPath); }
    } catch {
      // ignore if page not present
    }
  }

  // Update site1 Weekly briefs category page
  {
    const relPath = 'site1-dark-gradient/news/weekly/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    try {
      const html = readFileRel(relPath);
      const middle = extractBetweenMarkers(html, markerStart, markerEnd);
      const keys = Array.from(new Set([key, ...Array.from(middle.matchAll(/data-weekly-key="(\d{4}-W\d{2})"/g)).map(m => m[1])])).slice(0, 60);
      const nextInner = keys.map((k) => {
        const mm = String(k).match(/^(\d{4})-W(\d{2})$/);
        const y = Number(mm?.[1] || year);
        const w = Number(mm?.[2] || week);
        return buildSite1NewsItem({ week: w, year: y, key: k, hrefBase: '' });
      }).join('\n');
      const next = replaceBetweenMarkers(html, markerStart, markerEnd, nextInner, 20);
      if (next !== html) { writeFileRel(relPath, next); updated.push(relPath); }
    } catch {
      // ignore
    }
  }

  // site1
  {
    const relPath = 'site1-dark-gradient/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    const html = readFileRel(relPath);
    const middle = extractBetweenMarkers(html, markerStart, markerEnd);
    const keys = Array.from(new Set([key, ...Array.from(middle.matchAll(/data-weekly-key="(\d{4}-W\d{2})"/g)).map(m => m[1])])).slice(0, 12);
    const nextInner = keys.map((k) => {
      const mm = String(k).match(/^(\d{4})-W(\d{2})$/);
      const y = Number(mm?.[1] || year);
      const w = Number(mm?.[2] || week);
      return buildSite1NewsItem({ week: w, year: y, key: k, hrefBase: 'news/weekly' });
    }).join('\n');
    const next = replaceBetweenMarkers(html, markerStart, markerEnd, nextInner, 20);
    if (next !== html) { writeFileRel(relPath, next); updated.push(relPath); }
  }

  // site2
  {
    const relPath = 'site2-minimal-light/news/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    const html = readFileRel(relPath);
    const middle = extractBetweenMarkers(html, markerStart, markerEnd);
    const keys = Array.from(new Set([key, ...Array.from(middle.matchAll(/data-weekly-key="(\d{4}-W\d{2})"/g)).map(m => m[1])])).slice(0, 12);
    const nextInner = keys.map((k) => {
      const mm = String(k).match(/^(\d{4})-W(\d{2})$/);
      const y = Number(mm?.[1] || year);
      const w = Number(mm?.[2] || week);
      return buildSite2NewsItem({ week: w, year: y, key: k, hrefBase: 'weekly' });
    }).join('\n');
    const next = replaceBetweenMarkers(html, markerStart, markerEnd, nextInner, 20);
    if (next !== html) { writeFileRel(relPath, next); updated.push(relPath); }
  }

  // site2 Weekly briefs category page
  {
    const relPath = 'site2-minimal-light/news/weekly/index.html';
    const markerStart = '<!-- WEEKLY_NEWS_START -->';
    const markerEnd = '<!-- WEEKLY_NEWS_END -->';
    try {
      const html = readFileRel(relPath);
      const middle = extractBetweenMarkers(html, markerStart, markerEnd);
      const keys = Array.from(new Set([key, ...Array.from(middle.matchAll(/data-weekly-key="(\d{4}-W\d{2})"/g)).map(m => m[1])])).slice(0, 60);
      const nextInner = keys.map((k) => {
        const mm = String(k).match(/^(\d{4})-W(\d{2})$/);
        const y = Number(mm?.[1] || year);
        const w = Number(mm?.[2] || week);
        return buildSite2NewsItem({ week: w, year: y, key: k, hrefBase: '' });
      }).join('\n');
      const next = replaceBetweenMarkers(html, markerStart, markerEnd, nextInner, 20);
      if (next !== html) { writeFileRel(relPath, next); updated.push(relPath); }
    } catch {
      // ignore
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

