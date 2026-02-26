import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readFileRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function writeFileRel(relPath, next) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next, 'utf8');
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
    .replace(/&#8230;/g, '…');
}

function stripCdata(str) {
  const s = String(str || '').trim();
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : s;
}

function textFromTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
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

function attrFromTag(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"[^>]*\\/?>`, 'i');
  const m = String(xml || '').match(re);
  return m ? decodeEntities(m[1]).trim() : '';
}

function parseRssItems(xml) {
  const items = [];
  const input = String(xml || '');

  // RSS 2.0 / RSS 1.0 (RDF) items
  const rssBlocks = input.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of rssBlocks) {
    const title = textFromTag(block, 'title');
    const link =
      safeUrl(textFromTag(block, 'link')) ||
      safeUrl(textFromTag(block, 'guid')) ||
      safeUrl(attrFromTag(block, 'item', 'rdf:about'));
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

  // Atom entries (some official sources prefer Atom)
  const atomBlocks = input.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of atomBlocks) {
    const title = textFromTag(block, 'title');
    const link =
      safeUrl(attrFromTag(block, 'link', 'href')) ||
      safeUrl(textFromTag(block, 'link')) ||
      safeUrl(textFromTag(block, 'id'));
    const pubDateRaw = textFromTag(block, 'updated') || textFromTag(block, 'published');
    const pubMs = Date.parse(pubDateRaw);
    const pubIso = Number.isFinite(pubMs) ? new Date(pubMs).toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
    if (!title || !link || !pubIso) continue;
    items.push({ title, link, pubIso });
  }

  return items;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      // Some feeds block default Node UA.
      'user-agent': 'BrokercompareNewsBot/1.0 (+https://example.invalid)',
      'accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  return await res.text();
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

function updateBetweenMarkers(html, markerStart, markerEnd, nextInner, indent) {
  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Markers not found: ${markerStart} ... ${markerEnd}`);
  }
  const before = html.slice(0, startIdx + markerStart.length);
  const after = html.slice(endIdx);
  const rebuilt = `\n${indent}${nextInner.trim()}\n${indent}`;
  return before + rebuilt + after;
}

function extractBetweenMarkers(html, markerStart, markerEnd) {
  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return '';
  return html.slice(startIdx + markerStart.length, endIdx);
}

function parseExistingRssCardsSite1(middle) {
  const blocks = String(middle || '').match(/<article class="news-card rss-news-card">[\s\S]*?<\/article>/gi) || [];
  const items = [];
  for (const b of blocks) {
    const href = (b.match(/<a[^>]+href="([^"]+)"/i) || [])[1] || '';
    const dt = (b.match(/<time[^>]+datetime="([^"]+)"/i) || [])[1] || '';
    const link = safeUrl(href);
    const pubIso = String(dt || '').trim();
    if (!link || !pubIso) continue;
    const anchorTextRaw = decodeEntities(stripCdata((b.match(/<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '')).replace(/<[^>]+>/g, '');
    let anchorText = anchorTextRaw.replace(/\s+/g, ' ').trim();
    const src = domainLabel(link);
    // Clean up any legacy injected titles that accidentally included the source label repeatedly.
    for (let i = 0; i < 3; i++) {
      if (anchorText.toLowerCase().startsWith(`${src.toLowerCase()} `)) {
        anchorText = anchorText.slice(src.length).trim();
        continue;
      }
      break;
    }
    items.push({ title: anchorText || link, link, pubIso });
  }
  return items;
}

function parseExistingRssCardsSite2(middle) {
  const blocks = String(middle || '').match(/<div class="card card-pad rss-news-card">[\s\S]*?<\/div>/gi) || [];
  const items = [];
  for (const b of blocks) {
    const href = (b.match(/<a[^>]+href="([^"]+)"/i) || [])[1] || '';
    const dt = (b.match(/<time[^>]+datetime="([^"]+)"/i) || [])[1] || '';
    const link = safeUrl(href);
    const pubIso = String(dt || '').trim();
    if (!link || !pubIso) continue;
    const anchorTextRaw = decodeEntities(stripCdata((b.match(/<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '')).replace(/<[^>]+>/g, '');
    let anchorText = anchorTextRaw.replace(/\s+/g, ' ').trim();
    const src = domainLabel(link);
    for (let i = 0; i < 3; i++) {
      if (anchorText.toLowerCase().startsWith(`${src.toLowerCase()} `)) {
        anchorText = anchorText.slice(src.length).trim();
        continue;
      }
      break;
    }
    items.push({ title: anchorText || link, link, pubIso });
  }
  return items;
}

function mergeKeepRecent(existing, incoming, maxItems) {
  const map = new Map();
  for (const it of [...incoming, ...existing]) {
    if (!it?.link || !it?.pubIso) continue;
    if (!map.has(it.link)) map.set(it.link, it);
  }
  return Array.from(map.values())
    .sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso))
    .slice(0, maxItems);
}

function buildSite1Cards(items) {
  return items.map((it) => {
    const src = domainLabel(it.link);
    const title = truncate(it.title, 110);
    const titleEsc = title.replace(/"/g, '&quot;');
    return `
<article class="news-card rss-news-card">
  <div class="news-image"></div>
  <div class="news-content">
    <span class="news-category" data-en="${src}" data-es="${src}">${src}</span>
    <h3 class="news-title">
      <a class="link-cta" href="${it.link}" target="_blank" rel="noopener noreferrer" data-en="${titleEsc}" data-es="${titleEsc}">${title}</a>
    </h3>
    <p class="news-excerpt" data-en="Source: ${src}. Open original →" data-es="Fuente: ${src}. Abrir original →">Source: ${src}. Open original →</p>
    <time class="news-date" datetime="${it.pubIso}" data-relative-time="true" data-show-absolute="true">${it.pubIso.split('T')[0]}</time>
  </div>
</article>
`.trim();
  }).join('\n');
}

function buildSite2Cards(items) {
  return items.map((it) => {
    const src = domainLabel(it.link);
    const title = truncate(it.title, 95);
    const titleEsc = title.replace(/"/g, '&quot;');
    return `
<div class="card card-pad rss-news-card">
  <h3 class="card-title">
    <a class="btn-link" href="${it.link}" target="_blank" rel="noopener noreferrer" data-en="${titleEsc}" data-es="${titleEsc}">${title}</a>
  </h3>
  <p class="muted mb-1" data-en="Source: ${src}. Open original →" data-es="Fuente: ${src}. Abrir original →">Source: ${src}. Open original →</p>
  <time class="muted small news-date" datetime="${it.pubIso}" data-relative-time="true" data-show-absolute="true">${it.pubIso.split('T')[0]}</time>
</div>
`.trim();
  }).join('\n');
}

async function buildItemsFromFeeds(feedUrls, limit) {
  const all = [];
  for (const url of feedUrls) {
    try {
      const xml = await fetchText(url);
      all.push(...parseRssItems(xml));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`WARN: ${String(e?.message || e)} `);
    }
  }

  const dedup = new Map();
  for (const it of all) {
    if (!dedup.has(it.link)) dedup.set(it.link, it);
  }

  return Array.from(dedup.values()).sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso)).slice(0, limit);
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
    // currency codes commonly used in FX headlines
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
    'pab'
  ];

  const re = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|')})\\b`, 'i');
  const trustedLatamDomains = new Set(['banxico.org.mx']);

  return (it) => {
    const title = String(it?.title || '');
    if (re.test(title)) return true;
    try {
      const host = new URL(it.link).hostname.replace(/^www\./, '');
      return trustedLatamDomains.has(host);
    } catch {
      return false;
    }
  };
}

function isFresh(pubIso, maxAgeDays) {
  const ms = Date.parse(pubIso);
  if (!Number.isFinite(ms)) return false;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return ms >= cutoff;
}

async function buildLatamFocusedItems(feedUrls, limit) {
  const all = [];
  for (const url of feedUrls) {
    try {
      const xml = await fetchText(url);
      all.push(...parseRssItems(xml));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`WARN: ${String(e?.message || e)} `);
    }
  }

  const dedup = new Map();
  for (const it of all) {
    if (!dedup.has(it.link)) dedup.set(it.link, it);
  }

  const sorted = Array.from(dedup.values()).sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso));
  const isLatam = buildLatamMatcher();
  const fresh = sorted.filter((it) => isFresh(it.pubIso, 45));
  const latam = fresh.filter(isLatam);

  // Prefer LATAM-related headlines, but also keep results fresh.
  if (latam.length >= Math.max(4, Math.min(7, limit))) return latam.slice(0, limit);
  const fill = fresh.filter((it) => !isLatam(it)).slice(0, Math.max(0, limit - latam.length));
  return latam.concat(fill).slice(0, limit);
}

async function run() {
  const updated = [];

  // LATAM-focused: central banks, FX, and finance (with a LATAM keyword preference)
  {
    const relPath = 'site1-dark-gradient/index.html';
    const html = readFileRel(relPath);
    const fresh = await buildLatamFocusedItems(
      [
        // Mexico (central bank indicators, FX + policy rate)
        'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=fix&BMXC_idioma=es',
        'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=tasObj&BMXC_idioma=es',
        // LATAM-friendly FX headlines (Spanish)
        'https://www.fxstreet.es/rss/news',
        // Central banking decisions & policy (filter will prefer LATAM)
        'https://www.centralbanking.com/feeds/rss/category/central-banks/monetary-policy/monetary-policy-decisions'
      ],
      30
    );
    if (fresh.length) {
      // Canonical storage of the RSS archive is the /news/ pages.
      const archivePaths = [
        'site1-dark-gradient/news/index.html',
        'site1-dark-gradient/news/headlines/index.html',
      ];

      // Prefer existing content from the first archive page that exists.
      let existing = [];
      for (const p of archivePaths) {
        try {
          const archiveHtml = readFileRel(p);
          const existingMid = extractBetweenMarkers(archiveHtml, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->');
          existing = parseExistingRssCardsSite1(existingMid);
          if (existing.length) break;
        } catch {
          // ignore
        }
      }

      const merged = mergeKeepRecent(existing, fresh, 60);

      // Update archive pages (all items)
      for (const archivePath of archivePaths) {
        try {
          const archiveHtml = readFileRel(archivePath);
          const nextArchiveInner = buildSite1Cards(merged);
          const nextArchive = updateBetweenMarkers(archiveHtml, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->', nextArchiveInner, ' '.repeat(20));
          if (nextArchive !== archiveHtml) {
            writeFileRel(archivePath, nextArchive);
            updated.push(archivePath);
          }
        } catch {
          // ignore missing page
        }
      }

      // Update homepage (only last 6)
      const homeInner = buildSite1Cards(merged.slice(0, 6));
      const nextHome = updateBetweenMarkers(html, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->', homeInner, ' '.repeat(20));
      if (nextHome !== html) {
        writeFileRel(relPath, nextHome);
        updated.push(relPath);
      }
    }
  }

  // Site2: different sources, still LATAM-focused
  {
    const relPath = 'site2-minimal-light/news/index.html';
    const html = readFileRel(relPath);
    const fresh = await buildLatamFocusedItems(
      [
        // FX / finance headlines (filter will prefer LATAM currencies & countries)
        'https://www.investing.com/rss/forex.rss',
        'https://www.fxstreet.es/rss/news',
        // Central banking decisions / macro context (filter will prefer LATAM)
        'https://www.centralbanking.com/feeds/rss/category/central-banks/monetary-policy/monetary-policy-decisions',
        // Extra Mexico macro signals (remittances / reserves)
        'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=remesa&BMXC_idioma=es',
        'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=reserv&BMXC_idioma=es'
      ],
      30
    );
    if (fresh.length) {
      const existingMid = extractBetweenMarkers(html, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->');
      const existing = parseExistingRssCardsSite2(existingMid);
      const items = mergeKeepRecent(existing, fresh, 36);
      const nextInner = buildSite2Cards(items);
      const next = updateBetweenMarkers(html, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->', nextInner, ' '.repeat(20));
      if (next !== html) {
        writeFileRel(relPath, next);
        updated.push(relPath);
      }

      // Also update Headlines category page if present.
      {
        const archivePath = 'site2-minimal-light/news/headlines/index.html';
        try {
          const archiveHtml = readFileRel(archivePath);
          const nextArchiveInner = buildSite2Cards(items);
          const nextArchive = updateBetweenMarkers(archiveHtml, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->', nextArchiveInner, ' '.repeat(20));
          if (nextArchive !== archiveHtml) {
            writeFileRel(archivePath, nextArchive);
            updated.push(archivePath);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // eslint-disable-next-line no-console
  if (updated.length) {
    console.log(`RSS news updated: ${updated.join(', ')}`);
  } else {
    console.log('RSS news: no updates applied (feeds empty or markers missing).');
  }
}

run();

