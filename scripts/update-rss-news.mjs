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

function stripTags(html) {
  return String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function textFromTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return decodeEntities(stripCdata(m[1]).trim());
}

function textFromTagAny(xml, tags) {
  for (const t of tags) {
    const v = textFromTag(xml, t);
    if (v) return v;
  }
  return '';
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
    const summaryRaw = textFromTagAny(block, ['description', 'summary', 'content:encoded']);
    const rssSummary = decodeEntities(stripTags(stripCdata(summaryRaw))).replace(/\s+/g, ' ').trim();
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
    items.push({ title, link, pubIso, rssSummary });
  }

  // Atom entries (some official sources prefer Atom)
  const atomBlocks = input.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of atomBlocks) {
    const title = textFromTag(block, 'title');
    const link =
      safeUrl(attrFromTag(block, 'link', 'href')) ||
      safeUrl(textFromTag(block, 'link')) ||
      safeUrl(textFromTag(block, 'id'));
    const summaryRaw = textFromTagAny(block, ['summary', 'content']);
    const rssSummary = decodeEntities(stripTags(stripCdata(summaryRaw))).replace(/\s+/g, ' ').trim();
    const pubDateRaw = textFromTag(block, 'updated') || textFromTag(block, 'published');
    const pubMs = Date.parse(pubDateRaw);
    const pubIso = Number.isFinite(pubMs) ? new Date(pubMs).toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
    if (!title || !link || !pubIso) continue;
    items.push({ title, link, pubIso, rssSummary });
  }

  return items;
}

async function fetchText(url, { accept, acceptLanguage, timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      // Some feeds block default Node UA.
      'user-agent': 'BrokercompareNewsBot/1.0 (+https://example.invalid)',
      'accept': accept || 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      ...(acceptLanguage ? { 'accept-language': acceptLanguage } : {})
    }
  }).finally(() => clearTimeout(timer));
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

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inferLangFromLink(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '');
    if (host === 'banxico.org.mx') return 'es';
    if (host === 'fxstreet.es') return 'es';
    if (host === 'fxstreet.com') return 'en';
    if (host === 'investing.com') return 'en';
    if (host === 'centralbanking.com') return 'en';
  } catch {
    // ignore
  }
  return 'en';
}

function extractMetaContent(html, selector) {
  // selector is a list of (attrName, attrValue) pairs to match.
  const s = String(html || '');
  for (const [attrName, attrValue] of selector) {
    const re = new RegExp(`<meta[^>]+\\b${attrName}="${attrValue}"[^>]+\\bcontent="([^"]+)"[^>]*>`, 'i');
    const m = s.match(re);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return '';
}

function extractFirstParagraphText(html) {
  const s = String(html || '');
  const m = s.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!m?.[1]) return '';
  const txt = decodeEntities(stripTags(m[1])).replace(/\s+/g, ' ').trim();
  if (txt.length < 40) return '';
  return txt;
}

const pageSummaryCache = new Map();

async function fetchPageSummary(link, lang) {
  const key = `${lang || 'en'}|${link}`;
  if (pageSummaryCache.has(key)) return pageSummaryCache.get(key);

  const acceptLanguage = lang === 'es' ? 'es-ES,es;q=0.9,en;q=0.6' : 'en-US,en;q=0.9,es;q=0.5';
  try {
    const html = await fetchText(link, {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      acceptLanguage,
      timeoutMs: 12000
    });
    const meta =
      extractMetaContent(html, [['property', 'og:description'], ['name', 'description'], ['name', 'twitter:description']]) ||
      extractFirstParagraphText(html);
    const out = { ok: true, summary: meta || '' };
    pageSummaryCache.set(key, out);
    return out;
  } catch {
    const out = { ok: false, summary: '' };
    pageSummaryCache.set(key, out);
    return out;
  }
}

function extractImpactSignals(text) {
  const t = String(text || '').toLowerCase();
  const signals = {
    rates: /\b(rate|rates|interest|policy|tighten|cut|hike|banxico|fomc|central bank|tasa|tasas|inter[eé]s|pol[ií]tica monetaria|banco central)\b/i.test(t),
    inflation: /\b(inflation|cpi|prices|pce|inflaci[oó]n|ipc|precios)\b/i.test(t),
    jobs: /\b(jobs|payroll|unemployment|employment|empleo|desempleo|n[oó]minas)\b/i.test(t),
    fx: /\b(fx|forex|usd|eur|jpy|gbp|mxn|brl|ars|clp|cop|pen|peso|real|d[oó]lar|yen|euro|libra)\b/i.test(t),
    banks: /\b(bank|banks|banking|lender|banco|bancos|bancario)\b/i.test(t),
    crypto: /\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency|cripto|criptomoneda)\b/i.test(t),
    equities: /\b(stocks|equities|shares|bolsa|acciones)\b/i.test(t),
    commodities: /\b(oil|brent|wti|gold|silver|copper|petr[oó]leo|oro|plata|cobre)\b/i.test(t),
  };

  const countries = [];
  if (/\bmexic|méxic|mexico|méxico|banxico\b/i.test(t)) countries.push('Mexico');
  if (/\bbrazil|brasil\b/i.test(t)) countries.push('Brazil');
  if (/\bargentina\b/i.test(t)) countries.push('Argentina');
  if (/\bchile\b/i.test(t)) countries.push('Chile');
  if (/\bcolombia\b/i.test(t)) countries.push('Colombia');
  if (/\bperu|perú\b/i.test(t)) countries.push('Peru');

  const currencies = [];
  if (/\bmxn\b/i.test(t) || /\bpeso mexicano\b/i.test(t)) currencies.push('MXN');
  if (/\bbrl\b/i.test(t) || /\breal\b/i.test(t)) currencies.push('BRL');
  if (/\bars\b/i.test(t)) currencies.push('ARS');
  if (/\bclp\b/i.test(t)) currencies.push('CLP');
  if (/\bcop\b/i.test(t)) currencies.push('COP');
  if (/\bpen\b/i.test(t)) currencies.push('PEN');

  return { signals, countries, currencies };
}

function buildCategoryLabel(signals, lang) {
  const parts = [];
  if (signals.rates) parts.push(lang === 'es' ? 'Banca central / tasas' : 'Central banking / rates');
  else if (signals.inflation || signals.jobs) parts.push(lang === 'es' ? 'Datos macro' : 'Macro data');
  if (signals.fx) parts.push('FX');
  if (signals.banks) parts.push(lang === 'es' ? 'Bancos' : 'Banks');
  if (signals.crypto) parts.push(lang === 'es' ? 'Cripto' : 'Crypto');
  if (signals.commodities) parts.push(lang === 'es' ? 'Commodities' : 'Commodities');
  if (signals.equities) parts.push(lang === 'es' ? 'Acciones' : 'Equities');
  if (!parts.length) return lang === 'es' ? 'Mercados' : 'Markets';
  return parts.slice(0, 3).join(' • ');
}

function buildRegionLabel(countries, currencies, lang) {
  const c = Array.from(new Set(countries || [])).slice(0, 2);
  const fx = Array.from(new Set(currencies || [])).slice(0, 3);
  if (c.length || fx.length) {
    const bits = [];
    if (c.length) bits.push(c.join(', '));
    if (fx.length) bits.push(fx.join(', '));
    return bits.join(' · ');
  }
  return lang === 'es' ? 'LATAM (contexto regional)' : 'LATAM (regional context)';
}

function buildRssReport(it, lang) {
  const sourceText = [it?.pageSummary, it?.rssSummary, it?.title].filter(Boolean).join(' — ');
  const base = String(it?.pageSummary || it?.rssSummary || '').trim();
  const purposeCore = base || String(it?.title || '').trim();
  const purpose = truncate(purposeCore, 220);

  const { signals, countries, currencies } = extractImpactSignals(sourceText);
  const category = buildCategoryLabel(signals, lang);
  const region = buildRegionLabel(countries, currencies, lang);

  const purposePara =
    lang === 'es'
      ? `Propósito (${category} · ${region}): ${purpose}`
      : `Purpose (${category} · ${region}): ${purpose}`;

  const impactCore =
    lang === 'es'
      ? `Impacto potencial: Puede afectar expectativas y precios (especialmente ${category}) con relevancia para ${region}.`
      : `Potential impact: This may shift expectations and pricing (especially ${category}) with relevance to ${region}.`;

  const watchBit = (currencies?.length || countries?.length)
    ? (lang === 'es'
      ? ` Pistas: observa ${[
        currencies?.length ? `pares y cruces con ${currencies.slice(0, 3).join(', ')}` : '',
        signals.rates ? 'tasa de referencia y rendimientos' : '',
        signals.fx ? 'movimiento del USD y spreads' : '',
      ].filter(Boolean).join('; ')}.`
      : ` Signals to watch: ${[
        currencies?.length ? `moves in pairs involving ${currencies.slice(0, 3).join(', ')}` : '',
        signals.rates ? 'policy-rate guidance and yields' : '',
        signals.fx ? 'USD moves and spreads' : '',
      ].filter(Boolean).join('; ')}.`)
    : (lang === 'es'
      ? ' Pistas: observa reacción del USD, expectativas de tasas y sentimiento de riesgo.'
      : ' Signals to watch: USD reaction, rate expectations, and risk sentiment.');

  const impact = `${impactCore}${watchBit}`;

  return {
    purpose: purposePara,
    impact: truncate(impact, 220)
  };
}

async function enrichWithReports(items, lang, maxToFetch = 60) {
  const list = Array.from(items || []);
  const limit = Math.max(0, Math.min(maxToFetch, list.length));
  const concurrency = 4;
  let idx = 0;

  async function worker() {
    while (idx < limit) {
      const i = idx++;
      const it = list[i];
      const res = await fetchPageSummary(it.link, lang);
      if (res.ok && res.summary) it.pageSummary = res.summary;
      const rep = buildRssReport(it, lang);
      it.reportPurpose = rep.purpose;
      it.reportImpact = rep.impact;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  // For any remaining items (if we ever cap maxToFetch), still generate reports from RSS summary/title.
  for (let i = limit; i < list.length; i++) {
    const it = list[i];
    const rep = buildRssReport(it, lang);
    it.reportPurpose = rep.purpose;
    it.reportImpact = rep.impact;
  }
  return list;
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
    const lang = ((b.match(/data-rss-lang="(en|es)"/i) || [])[1] || '').toLowerCase();
    const reportPurpose = decodeEntities((b.match(/data-rss-purpose="true"[^>]*\bdata-en="([^"]*)"/i) || [])[1] || '').trim();
    const reportImpact = decodeEntities((b.match(/data-rss-impact="true"[^>]*\bdata-en="([^"]*)"/i) || [])[1] || '').trim();
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
    items.push({
      title: anchorText || link,
      link,
      pubIso,
      lang: lang || inferLangFromLink(link),
      reportPurpose,
      reportImpact
    });
  }
  return items;
}

function parseExistingRssCardsSite2(middle) {
  const blocks = String(middle || '').match(/<div class="card card-pad rss-news-card">[\s\S]*?<\/div>/gi) || [];
  const items = [];
  for (const b of blocks) {
    const href = (b.match(/<a[^>]+href="([^"]+)"/i) || [])[1] || '';
    const dt = (b.match(/<time[^>]+datetime="([^"]+)"/i) || [])[1] || '';
    const lang = ((b.match(/data-rss-lang="(en|es)"/i) || [])[1] || '').toLowerCase();
    const reportPurpose = decodeEntities((b.match(/data-rss-purpose="true"[^>]*\bdata-en="([^"]*)"/i) || [])[1] || '').trim();
    const reportImpact = decodeEntities((b.match(/data-rss-impact="true"[^>]*\bdata-en="([^"]*)"/i) || [])[1] || '').trim();
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
    items.push({
      title: anchorText || link,
      link,
      pubIso,
      lang: lang || inferLangFromLink(link),
      reportPurpose,
      reportImpact
    });
  }
  return items;
}

function mergeKeepRecent(existing, incoming, maxItems) {
  const map = new Map();
  for (const it of [...incoming, ...existing]) {
    if (!it?.link || !it?.pubIso) continue;
    const lang = (it.lang || inferLangFromLink(it.link) || 'en').toLowerCase();
    const key = `${lang}|${it.link}`;
    if (!map.has(key)) {
      map.set(key, { ...it, lang });
      continue;
    }
    // Prefer newer fields from incoming, but keep any existing report text if missing.
    const prev = map.get(key);
    const next = { ...prev, ...it, lang };
    if (!next.reportPurpose && prev.reportPurpose) next.reportPurpose = prev.reportPurpose;
    if (!next.reportImpact && prev.reportImpact) next.reportImpact = prev.reportImpact;
    if (!next.rssSummary && prev.rssSummary) next.rssSummary = prev.rssSummary;
    map.set(key, next);
  }
  return Array.from(map.values())
    .sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso))
    .slice(0, maxItems);
}

function buildSite1Cards(items) {
  return items.map((it) => {
    const src = domainLabel(it.link);
    const title = truncate(it.title, 110);
    const lang = (it.lang || inferLangFromLink(it.link) || 'en').toLowerCase();
    const titleEsc = escapeAttr(title);
    const titleHtml = escapeText(title);
    const rep = buildRssReport(it, lang);
    const purposeEsc = escapeAttr(rep.purpose);
    const impactEsc = escapeAttr(rep.impact);
    const purposeHtml = escapeText(rep.purpose);
    const impactHtml = escapeText(rep.impact);
    return `
<article class="news-card rss-news-card" data-rss-lang="${lang}" data-lang-only="${lang}">
  <div class="news-image"></div>
  <div class="news-content">
    <span class="news-category" data-en="${src}" data-es="${src}">${src}</span>
    <h3 class="news-title">
      <a class="link-cta" href="${it.link}" target="_blank" rel="noopener noreferrer" data-en="${titleEsc}" data-es="${titleEsc}">${titleHtml}</a>
    </h3>
    <p class="news-excerpt" data-rss-purpose="true" data-en="${purposeEsc}" data-es="${purposeEsc}">${purposeHtml}</p>
    <p class="news-excerpt" data-rss-impact="true" data-en="${impactEsc}" data-es="${impactEsc}">${impactHtml}</p>
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
    const lang = (it.lang || inferLangFromLink(it.link) || 'en').toLowerCase();
    const titleEsc = escapeAttr(title);
    const titleHtml = escapeText(title);
    const rep = buildRssReport(it, lang);
    const purposeEsc = escapeAttr(rep.purpose);
    const impactEsc = escapeAttr(rep.impact);
    const purposeHtml = escapeText(rep.purpose);
    const impactHtml = escapeText(rep.impact);
    return `
<div class="card card-pad rss-news-card" data-rss-lang="${lang}" data-lang-only="${lang}">
  <h3 class="card-title">
    <a class="btn-link" href="${it.link}" target="_blank" rel="noopener noreferrer" data-en="${titleEsc}" data-es="${titleEsc}">${titleHtml}</a>
  </h3>
  <p class="muted mb-1" data-rss-purpose="true" data-en="${purposeEsc}" data-es="${purposeEsc}">${purposeHtml}</p>
  <p class="muted mb-1" data-rss-impact="true" data-en="${impactEsc}" data-es="${impactEsc}">${impactHtml}</p>
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
    const [freshEnRaw, freshEsRaw] = await Promise.all([
      buildLatamFocusedItems(
        [
          // Mexico (central bank indicators, FX + policy rate) — English
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=fix&BMXC_idioma=en',
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=tasObj&BMXC_idioma=en',
          // LATAM-friendly FX headlines (English)
          'https://www.fxstreet.com/rss/news',
          // Forex / finance headlines (English)
          'https://www.investing.com/rss/forex.rss',
          // Central banking decisions & policy
          'https://www.centralbanking.com/feeds/rss/category/central-banks/monetary-policy/monetary-policy-decisions'
        ],
        30
      ),
      buildLatamFocusedItems(
        [
          // Mexico (central bank indicators, FX + policy rate) — Spanish
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=fix&BMXC_idioma=es',
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=tasObj&BMXC_idioma=es',
          // LATAM-friendly FX headlines (Spanish)
          'https://www.fxstreet.es/rss/news'
        ],
        30
      )
    ]);

    const freshEn = freshEnRaw.map((it) => ({ ...it, lang: 'en' }));
    const freshEs = freshEsRaw.map((it) => ({ ...it, lang: 'es' }));

    if (freshEn.length || freshEs.length) {
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

      const existingEn = existing.filter((it) => (it.lang || 'en') === 'en');
      const existingEs = existing.filter((it) => (it.lang || 'en') === 'es');
      let mergedEn = mergeKeepRecent(existingEn, freshEn, 30);
      let mergedEs = mergeKeepRecent(existingEs, freshEs, 30);

      // Enrich with short purpose/impact reports (best-effort, deterministic).
      mergedEn = await enrichWithReports(mergedEn, 'en', 60);
      mergedEs = await enrichWithReports(mergedEs, 'es', 60);
      const merged = [...mergedEn, ...mergedEs].sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso));

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
      const homeInner = buildSite1Cards([...mergedEn.slice(0, 6), ...mergedEs.slice(0, 6)].sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso)));
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
    const [freshEnRaw, freshEsRaw] = await Promise.all([
      buildLatamFocusedItems(
        [
          // FX / finance headlines (English)
          'https://www.investing.com/rss/forex.rss',
          'https://www.fxstreet.com/rss/news',
          // Central banking decisions / macro context
          'https://www.centralbanking.com/feeds/rss/category/central-banks/monetary-policy/monetary-policy-decisions',
          // Extra Mexico macro signals (remittances / reserves) — English
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=remesa&BMXC_idioma=en',
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=reserv&BMXC_idioma=en'
        ],
        30
      ),
      buildLatamFocusedItems(
        [
          // FX / finance headlines (Spanish)
          'https://www.fxstreet.es/rss/news',
          // Extra Mexico macro signals (remittances / reserves) — Spanish
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=remesa&BMXC_idioma=es',
          'https://www.banxico.org.mx/rsscb/rss?BMXC_canal=reserv&BMXC_idioma=es'
        ],
        30
      )
    ]);

    const freshEn = freshEnRaw.map((it) => ({ ...it, lang: 'en' }));
    const freshEs = freshEsRaw.map((it) => ({ ...it, lang: 'es' }));

    if (freshEn.length || freshEs.length) {
      const existingMid = extractBetweenMarkers(html, '<!-- RSS_NEWS_START -->', '<!-- RSS_NEWS_END -->');
      const existing = parseExistingRssCardsSite2(existingMid);
      const existingEn = existing.filter((it) => (it.lang || 'en') === 'en');
      const existingEs = existing.filter((it) => (it.lang || 'en') === 'es');
      let mergedEn = mergeKeepRecent(existingEn, freshEn, 18);
      let mergedEs = mergeKeepRecent(existingEs, freshEs, 18);

      mergedEn = await enrichWithReports(mergedEn, 'en', 36);
      mergedEs = await enrichWithReports(mergedEs, 'es', 36);

      const items = [...mergedEn, ...mergedEs].sort((a, b) => Date.parse(b.pubIso) - Date.parse(a.pubIso));
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

