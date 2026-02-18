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

function decodeEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&#160;/g, ' ');
}

function stripCdata(str) {
  const s = String(str || '').trim();
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : s;
}

function textFromTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(xml || '').match(re);
  if (!m) return '';
  return decodeEntities(stripCdata(m[1]).trim());
}

function safeUrl(url) {
  try {
    return new URL(String(url || '').trim()).toString();
  } catch {
    return '';
  }
}

function domainLabel(link) {
  try {
    const u = new URL(link);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

function truncate(s, n) {
  const str = String(s || '').trim();
  if (str.length <= n) return str;
  return str.slice(0, Math.max(0, n - 1)).trimEnd() + '…';
}

function attrFromTag(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"[^>]*\\/?>`, 'i');
  const m = String(xml || '').match(re);
  return m ? decodeEntities(m[1]).trim() : '';
}

function parseFeedItems(xml) {
  const items = [];
  const input = String(xml || '');

  // RSS items
  const rssBlocks = input.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of rssBlocks) {
    const title = textFromTag(block, 'title');
    const link = safeUrl(textFromTag(block, 'link')) || safeUrl(textFromTag(block, 'guid'));
    const pubDateRaw =
      textFromTag(block, 'pubDate') ||
      textFromTag(block, 'dc:date') ||
      textFromTag(block, 'dcterms:issued') ||
      textFromTag(block, 'dcterms:created') ||
      textFromTag(block, 'published') ||
      textFromTag(block, 'updated');
    const pubMs = Date.parse(pubDateRaw);
    const pubIso = Number.isFinite(pubMs) ? new Date(pubMs).toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
    if (!title || !link || !pubIso) continue;
    items.push({ title, link, pubIso });
  }

  // Atom entries
  const atomBlocks = input.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of atomBlocks) {
    const title = textFromTag(block, 'title');
    const link = safeUrl(attrFromTag(block, 'link', 'href')) || safeUrl(textFromTag(block, 'link')) || safeUrl(textFromTag(block, 'id'));
    const pubDateRaw = textFromTag(block, 'updated') || textFromTag(block, 'published');
    const pubMs = Date.parse(pubDateRaw);
    const pubIso = Number.isFinite(pubMs) ? new Date(pubMs).toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
    if (!title || !link || !pubIso) continue;
    items.push({ title, link, pubIso });
  }

  return items;
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'BrokerDailyBriefBot/1.0 (+https://example.invalid)',
        'accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, text/html;q=0.7, */*;q=0.5',
      }
    });
    if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function metaContent(html, names) {
  const s = String(html || '');
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const m1 = s.match(re1);
    if (m1?.[1]) return decodeEntities(m1[1]).trim();
    const re2 = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const m2 = s.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1]).trim();
  }
  return '';
}

async function fetchSourceSnapshot(url) {
  try {
    const html = await fetchText(url, 12000);
    const desc = metaContent(html, ['og:description', 'description']);
    return truncate(desc, 180);
  } catch {
    return '';
  }
}

function buildLatamMatcher() {
  const keywords = [
    'latam',
    'latin america',
    'américa latina',
    'america latina',
    'mexico',
    'méxico',
    'brazil',
    'brasil',
    'argentina',
    'chile',
    'colombia',
    'peru',
    'perú',
    'uruguay',
    'paraguay',
    'ecuador',
    'bolivia',
    'venezuela',
    'costa rica',
    'panama',
    'panamá',
    'guatemala',
    'honduras',
    'nicaragua',
    'el salvador',
    'dominican',
    'república dominicana',
    'caribbean',
    'caribe',
    // FX currency codes
    'mxn',
    'brl',
    'ars',
    'clp',
    'cop',
    'pen',
    'uyu',
    'crc',
    'dop',
    'ves',
    'bob',
    'pyg',
    'gtq',
    'hnl',
    'nio',
    'pab',
  ];

  const re = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|')})\\b`, 'i');
  return (it) => re.test(String(it?.title || ''));
}

function isFresh(pubIso, maxAgeDays) {
  const ms = Date.parse(pubIso);
  if (!Number.isFinite(ms)) return false;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return ms >= cutoff;
}

async function buildItemsFromFeeds(feedUrls, limit) {
  const all = [];
  for (const url of feedUrls) {
    try {
      const xml = await fetchText(url, 12000);
      all.push(...parseFeedItems(xml));
    } catch {
      // ignore
    }
  }
  const dedup = new Map();
  for (const it of all) {
    if (!dedup.has(it.link)) dedup.set(it.link, it);
  }
  return Array.from(dedup.values())
    .filter((it) => isFresh(it.pubIso, 45))
    .sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso))
    .slice(0, limit);
}

function pickLatamFirst(items, limit) {
  const isLatam = buildLatamMatcher();
  const latam = items.filter(isLatam);
  const rest = items.filter((it) => !isLatam(it));
  return latam.concat(rest).slice(0, limit);
}

function matchesAny(title, needles) {
  const t = String(title || '').toLowerCase();
  return needles.some((n) => t.includes(n));
}

function isBrokerIndustry(title) {
  return matchesAny(title, [
    'broker',
    'brokers',
    'forex',
    'fx',
    'cfd',
    'trading',
    'platform',
    'metatrader',
    'mt4',
    'mt5',
    'copy trading',
    'prop',
    'regulated',
    'regulation',
    'license',
    'licence',
    'withdraw',
    'deposit'
  ]);
}

function isForexMacro(title) {
  return matchesAny(title, [
    'forex',
    'fx',
    'usd',
    'eur',
    'mxn',
    'brl',
    'cop',
    'clp',
    'ars',
    'pen',
    'central bank',
    'rates',
    'inflation',
    'minutes',
    'fomc',
    'ecb',
    'banxico',
    'copom'
  ]);
}

function isCrypto(title) {
  return matchesAny(title, [
    'crypto',
    'bitcoin',
    'btc',
    'ethereum',
    'eth',
    'stablecoin',
    'blockchain',
    'token',
    'exchange',
    'defi',
    'web3'
  ]);
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
  const hasCurrent = currentKey ? existingItems.some((s) => s.includes(`data-daily-key="${currentKey}"`)) : false;
  if (hasCurrent && !replaceExisting) return html;
  const nextItems = hasCurrent
    ? existingItems.map((s) => (s.includes(`data-daily-key="${currentKey}"`) ? nextNew : s)).slice(0, maxItems)
    : [nextNew, ...existingItems].slice(0, maxItems);

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
  const href = `news/daily/${key}/`;
  const titleEn = `LATAM Broker + Crypto/FX Brief — ${key}`;
  const titleEs = `Resumen LATAM Brokers + Cripto/FX — ${key}`;
  return `
<article class="news-card" data-daily-news="true" data-daily-key="${key}">
  <div class="news-image"></div>
  <div class="news-content">
    <span class="news-category" data-en="Daily Brief" data-es="Resumen diario">Daily Brief</span>
    <h3 class="news-title">
      <a class="link-cta" href="${href}" data-en="${titleEn.replace(/"/g, '&quot;')}" data-es="${titleEs.replace(/"/g, '&quot;')}">${titleEn}</a>
    </h3>
    <p class="news-excerpt"
       data-en="Today’s checklist (LATAM): confirm the regulated entity for your country, review spreads on USD/MXN &amp; USD/BRL, check deposit/withdrawal rails, and verify whether crypto CFDs/spot are supported and restricted in your region."
       data-es="Checklist de hoy (LATAM): confirma la entidad regulada para tu país, revisa spreads en USD/MXN y USD/BRL, revisa depósitos/retiros y verifica si hay soporte y restricciones para cripto (CFDs/spot) en tu región.">Today’s checklist (LATAM): confirm the regulated entity for your country, review spreads on USD/MXN &amp; USD/BRL, check deposit/withdrawal rails, and verify whether crypto CFDs/spot are supported and restricted in your region.</p>
    <time class="news-date" datetime="${isoNowUtc()}" data-relative-time="true" data-show-absolute="true">${key}</time>
  </div>
</article>
`.trim();
}

function buildSite2DailyItem({ key }) {
  const href = `daily/${key}/`;
  const titleEn = `Daily LATAM Broker & Crypto/FX Brief — ${key}`;
  const titleEs = `Resumen diario LATAM (Brokers y Cripto/FX) — ${key}`;
  const titleEnHtml = titleEn.replace(/&/g, '&amp;');
  const titleEsHtml = titleEs.replace(/&/g, '&amp;');
  return `
<div class="card card-pad" data-daily-news="true" data-daily-key="${key}">
  <h3 class="card-title">
    <a class="btn-link" href="${href}" data-en="${titleEnHtml.replace(/"/g, '&quot;')}" data-es="${titleEsHtml.replace(/"/g, '&quot;')}">${titleEnHtml}</a>
  </h3>
  <p class="muted mb-1"
     data-en="Daily focus: LATAM broker conditions (local entity, fees, withdrawals) + forex &amp; crypto catalysts. Open the original headlines below, and always cross-check the regulator register for your jurisdiction."
     data-es="Enfoque diario: condiciones de brokers en LATAM (entidad local, comisiones, retiros) + catalizadores de forex y cripto. Abre los titulares originales abajo y valida siempre en el registro del regulador de tu jurisdicción.">Daily focus: LATAM broker conditions (local entity, fees, withdrawals) + forex &amp; crypto catalysts. Open the original headlines below, and always cross-check the regulator register for your jurisdiction.</p>
  <time class="muted small news-date" datetime="${isoNowUtc()}" data-relative-time="true" data-show-absolute="true">${key}</time>
</div>
`.trim();
}

function renderSourceListSite1(items) {
  return items.map((it) => {
    const src = domainLabel(it.link);
    const t = truncate(it.title, 120).replace(/"/g, '&quot;');
    const abs = it.pubIso.split('T')[0];
    const snapshot = (it.snapshot || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `
<div class="card-panel">
  <h3 class="subheading-card"><a class="link-cta" href="${it.link}" target="_blank" rel="noopener noreferrer">${decodeEntities(t)}</a></h3>
  <p class="rating-small" data-en="Source: ${src}. Open original →" data-es="Fuente: ${src}. Abrir original →">Source: ${src}. Open original →</p>
  <time class="news-date" datetime="${it.pubIso}" data-relative-time="true" data-show-absolute="true">${abs}</time>
  ${snapshot ? `<p class="section-intro section-intro-narrow" data-en="Source snapshot: ${snapshot}" data-es="Resumen de la fuente: ${snapshot}">Source snapshot: ${snapshot}</p>` : ''}
  <p class="section-intro section-intro-narrow" data-en="Our note: Keep it practical for LATAM. Verify the exact regulated entity, fees, and withdrawal terms for your country before acting." data-es="Nuestra nota: Manténlo práctico para LATAM. Verifica la entidad regulada exacta, comisiones y retiros para tu país antes de actuar.">Our note: Keep it practical for LATAM. Verify the exact regulated entity, fees, and withdrawal terms for your country before acting.</p>
</div>
`.trim();
  }).join('\n');
}

function renderSourceListSite2(items) {
  return items.map((it) => {
    const src = domainLabel(it.link);
    const t = truncate(it.title, 110).replace(/"/g, '&quot;');
    const abs = it.pubIso.split('T')[0];
    const snapshot = (it.snapshot || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `
<div class="card card-pad">
  <h3 class="card-title"><a class="btn-link" href="${it.link}" target="_blank" rel="noopener noreferrer">${decodeEntities(t)}</a></h3>
  <p class="muted mb-1" data-en="Source: ${src}. Open original →" data-es="Fuente: ${src}. Abrir original →">Source: ${src}. Open original →</p>
  <time class="muted small news-date" datetime="${it.pubIso}" data-relative-time="true" data-show-absolute="true">${abs}</time>
  ${snapshot ? `<p class="muted" data-en="Source snapshot: ${snapshot}" data-es="Resumen de la fuente: ${snapshot}">Source snapshot: ${snapshot}</p>` : ''}
  <p class="muted" data-en="Our note: Compare costs and regulation for your LATAM jurisdiction, then validate the headline details on the official source." data-es="Nuestra nota: Compara costos y regulación para tu jurisdicción en LATAM, y valida los detalles del titular en la fuente oficial.">Our note: Compare costs and regulation for your LATAM jurisdiction, then validate the headline details on the official source.</p>
</div>
`.trim();
  }).join('\n');
}

function buildSite1DailyPageHtml({ key, datetime, brokers, forex, crypto }) {
  const canonical = `https://brokerproreviews.com/news/daily/${key}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Brief (LATAM) — ${key} | BrokerProReviews</title>
  <meta name="description" content="Daily LATAM brief: broker updates, forex headlines, and crypto news. Original summaries with links to primary sources.">
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
        <h1 class="guide-title" data-en="Daily brief (LATAM) — ${key}" data-es="Resumen diario (LATAM) — ${key}">Daily brief (LATAM) — ${key}</h1>
        <p class="guide-lead" data-en="Original summaries with links to the source. Always verify the regulated entity for your country and read the primary source before acting." data-es="Resúmenes originales con enlace a la fuente. Verifica siempre la entidad regulada para tu país y lee la fuente primaria antes de actuar.">Original summaries with links to the source. Always verify the regulated entity for your country and read the primary source before acting.</p>
        <time class="news-date" datetime="${datetime}" data-relative-time="true" data-show-absolute="true">${key}</time>

        <h2 class="section-subheading mt-5" data-en="Broker &amp; industry updates (LATAM)" data-es="Actualizaciones de brokers e industria (LATAM)">Broker &amp; industry updates (LATAM)</h2>
        ${renderSourceListSite1(brokers)}

        <h2 class="section-subheading mt-5" data-en="Forex &amp; macro headlines (LATAM focus)" data-es="Titulares de forex y macro (enfoque LATAM)">Forex &amp; macro headlines (LATAM focus)</h2>
        ${renderSourceListSite1(forex)}

        <h2 class="section-subheading mt-5" data-en="Crypto headlines (LATAM + global)" data-es="Titulares cripto (LATAM + global)">Crypto headlines (LATAM + global)</h2>
        ${renderSourceListSite1(crypto)}
      </article>
    </div>
  </main>

  <script src="../../../translations.js"></script>
</body>
</html>`;
}

function buildSite2DailyPageHtml({ key, datetime, brokers, forex, crypto }) {
  const canonical = `https://brokercompare.com/news/daily/${key}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily LATAM Brief — ${key} | Brokercompare</title>
  <meta name="description" content="Daily LATAM brief: brokers, forex, and crypto headlines. Original summaries with links to primary sources.">
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
        <h1 class="intro-title" data-en="Daily LATAM brief — ${key}" data-es="Resumen diario LATAM — ${key}">Daily LATAM brief — ${key}</h1>
        <p class="intro-text" data-en="Original summaries with links to sources. Verify regulation and read the primary source before acting." data-es="Resúmenes originales con enlace a las fuentes. Verifica regulación y lee la fuente primaria antes de actuar.">Original summaries with links to sources. Verify regulation and read the primary source before acting.</p>
        <time class="muted small news-date" datetime="${datetime}" data-relative-time="true" data-show-absolute="true">${key}</time>
      </div>
    </section>

    <section class="section section--alt">
      <div class="container">
        <h2 class="section-heading mb-2" data-en="Broker &amp; industry updates" data-es="Actualizaciones de brokers e industria">Broker &amp; industry updates</h2>
        <div class="grid grid-3">
          ${renderSourceListSite2(brokers)}
        </div>

        <h2 class="section-heading mb-2 mt-4" data-en="Forex &amp; macro" data-es="Forex y macro">Forex &amp; macro</h2>
        <div class="grid grid-3">
          ${renderSourceListSite2(forex)}
        </div>

        <h2 class="section-heading mb-2 mt-4" data-en="Crypto" data-es="Cripto">Crypto</h2>
        <div class="grid grid-3">
          ${renderSourceListSite2(crypto)}
        </div>
      </div>
    </section>
  </main>

  <script src=\"../../../translations.js\"></script>
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

async function enrich(items) {
  const out = [];
  for (const it of items) {
    const snapshot = await fetchSourceSnapshot(it.link);
    out.push({ ...it, snapshot });
  }
  return out;
}

async function run() {
  const datetime = isoNowUtc();
  const key = keyTodayUtc(new Date());
  const updated = [];

  // Build daily brief pages (summaries + source links)
  const brokerRaw = await buildItemsFromFeeds(
    ['https://fxnewsgroup.com/feed/', 'https://www.financemagnates.com/forex/feed/', 'https://www.leaprate.com/feed/'],
    24
  );
  const brokerItems = pickLatamFirst(brokerRaw.filter((it) => isBrokerIndustry(it.title)), 8);

  const forexRaw = await buildItemsFromFeeds(
    [
      'https://www.fxstreet.es/rss/news',
      'https://www.investing.com/rss/forex.rss',
      'https://www.centralbanking.com/feeds/rss/category/central-banks/monetary-policy/monetary-policy-decisions',
      'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=fix&BMXC_idioma=es'
    ],
    24
  );
  const forexItems = pickLatamFirst(forexRaw.filter((it) => isForexMacro(it.title)), 8);

  const cryptoRaw = await buildItemsFromFeeds(
    [
      'https://cointelegraph.com/rss/tag/latin-america',
      'https://cointelegraph.com/rss',
      'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
      'https://www.financemagnates.com/cryptocurrency/feed/'
    ],
    24
  );
  const cryptoItems = pickLatamFirst(cryptoRaw.filter((it) => isCrypto(it.title)), 8);

  const brokersEnriched = await enrich(brokerItems.slice(0, 4));
  const forexEnriched = await enrich(forexItems.slice(0, 4));
  const cryptoEnriched = await enrich(cryptoItems.slice(0, 4));

  // site1 daily page (write once per day)
  {
    const relPath = `site1-dark-gradient/news/daily/${key}/index.html`;
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) {
      const html = buildSite1DailyPageHtml({ key, datetime, brokers: brokersEnriched, forex: forexEnriched, crypto: cryptoEnriched });
      writeFileRel(relPath, html);
      updated.push(relPath);
    }
  }

  // site2 daily page (write once per day)
  {
    const relPath = `site2-minimal-light/news/daily/${key}/index.html`;
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) {
      const html = buildSite2DailyPageHtml({ key, datetime, brokers: brokersEnriched, forex: forexEnriched, crypto: cryptoEnriched });
      writeFileRel(relPath, html);
      updated.push(relPath);
    }
  }

  // site1
  {
    const relPath = 'site1-dark-gradient/index.html';
    const markerStart = '<!-- DAILY_NEWS_START -->';
    const markerEnd = '<!-- DAILY_NEWS_END -->';
    const html = readFileRel(relPath);
    const next = updateBetweenMarkers(html, {
      markerStart,
      markerEnd,
      buildNewItem: () => buildSite1DailyItem({ key }),
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
      buildNewItem: () => buildSite2DailyItem({ key }),
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

