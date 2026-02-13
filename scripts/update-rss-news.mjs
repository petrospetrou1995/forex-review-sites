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

function parseRssItems(xml) {
  const items = [];
  const blocks = String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = textFromTag(block, 'title');
    const link = safeUrl(textFromTag(block, 'link'));
    const pubDateRaw = textFromTag(block, 'pubDate') || textFromTag(block, 'published') || textFromTag(block, 'updated');
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

  return Array.from(dedup.values())
    .sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso))
    .slice(0, limit);
}

async function run() {
  const updated = [];

  // Site1: different mix (DailyFX + Fed + BIS)
  {
    const relPath = 'site1-dark-gradient/index.html';
    const html = readFileRel(relPath);
    const items = await buildItemsFromFeeds(
      [
        'https://www.dailyfx.com/rss',
        'https://www.federalreserve.gov/feeds/press_all.xml',
        'https://www.bis.org/doclist/all_pressrels.rss'
      ],
      9
    );
    if (items.length) {
      const nextInner = buildSite1Cards(items);
      const next = updateBetweenMarkers(html, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->', nextInner, ' '.repeat(20));
      if (next !== html) {
        writeFileRel(relPath, next);
        updated.push(relPath);
      }
    }
  }

  // Site2: different mix (FXStreet + BoE news + ECB press)
  {
    const relPath = 'site2-minimal-light/news/index.html';
    const html = readFileRel(relPath);
    const items = await buildItemsFromFeeds(
      [
        'https://www.fxstreet.com/rss/news',
        'https://www.bankofengland.co.uk/rss/news',
        'https://www.ecb.europa.eu/rss/press.html'
      ],
      9
    );
    if (items.length) {
      const nextInner = buildSite2Cards(items);
      const next = updateBetweenMarkers(html, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->', nextInner, ' '.repeat(20));
      if (next !== html) {
        writeFileRel(relPath, next);
        updated.push(relPath);
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

