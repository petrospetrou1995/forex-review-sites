import fs from 'node:fs';
import path from 'node:path';
import { discoverConfiguredSites } from './site-config.mjs';

const ROOT = process.cwd();

const SITE_CONFIGS = discoverConfiguredSites().map((s) => ({
  key: s.key,
  dir: s.dir,
  siteName: s.siteName,
  baseUrl: s.baseUrl,
  ogImage: s.ogImage,
  twitterCard: s.twitterCard || 'summary_large_image',
}));

function read(abs) {
  return fs.readFileSync(abs, 'utf8');
}

function write(abs, next) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next, 'utf8');
}

function listHtmlFiles(absDir) {
  const out = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) out.push(...listHtmlFiles(abs));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

function stripTags(s) {
  return String(s || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/g, ' ')
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

function normalizeText(s) {
  return decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function collapseSpaces(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function clampWords(text, maxLen) {
  const t = collapseSpaces(text);
  if (t.length <= maxLen) return t;
  const words = t.split(' ');
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > maxLen) break;
    out = next;
  }
  if (!out) return t.slice(0, maxLen).trim();
  return out.trim();
}

function trimDanglingTail(text) {
  let t = collapseSpaces(text);
  t = t.replace(/[,:;–—-]\s*$/g, '').trim();
  // Avoid ending on weak conjunctions/prepositions after truncation.
  const badTail = new Set([
    'and',
    'or',
    'with',
    'to',
    'for',
    'from',
    'of',
    'in',
    'on',
    'at',
    'by',
    'as',
    'then',
    'who',
    'which',
    'that',
  ]);
  const parts = t.split(' ');
  while (parts.length && badTail.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  t = parts.join(' ').trim();
  t = t.replace(/[,:;–—-]\s*$/g, '').trim();
  return t;
}

function padToMin(text, minLen, padPhrases) {
  let t = collapseSpaces(text);
  for (const phrase of padPhrases) {
    if (t.length >= minLen) break;
    const sep = t.endsWith('.') ? ' ' : '. ';
    t = `${t}${sep}${phrase}`.trim();
  }
  if (t.length < minLen) {
    // Last resort: append a short generic clause.
    t = `${t}${t.endsWith('.') ? ' ' : '. '}Practical, risk-first context for LATAM traders.`.trim();
  }
  return t;
}

function buildCanonical(baseUrl, relPath) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const rp = relPath.replace(/\\/g, '/');
  if (rp === 'index.html') return `${base}/`;
  if (rp.endsWith('/index.html')) return `${base}/${rp.slice(0, -'index.html'.length)}`;
  return `${base}/${rp}`;
}

function inferPageType(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (p === 'index.html') return 'home';
  if (p.startsWith('brokers/')) return 'broker';
  if (p.startsWith('news/daily/') && p.endsWith('/index.html')) return 'news-daily-post';
  if (p.startsWith('news/weekly/') && p.endsWith('/index.html')) return 'news-weekly-post';
  if (p.startsWith('news/')) return 'news';
  if (p.startsWith('guides/')) return 'guide';
  if (p.startsWith('education/')) return 'education';
  if (p.startsWith('strategies/')) return 'strategies';
  if (p.startsWith('compare/')) return 'compare';
  if (p.startsWith('reviews/')) return 'reviews';
  if (p.startsWith('latam/')) return 'latam';
  if (p.startsWith('methodology/')) return 'methodology';
  return 'page';
}

function getFirstMatch(html, re) {
  const m = String(html || '').match(re);
  return m ? m[1] : '';
}

function extractH1(html) {
  const h1 = getFirstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return normalizeText(h1);
}

function extractIntroParagraph(html) {
  // Prefer a "lead" paragraph near the top.
  const candidates = [
    /<p\b[^>]*class="[^"]*(?:lead|intro|section-intro|section-lead|guide-lead|intro-text)[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    /<p\b[^>]*>([\s\S]*?)<\/p>/i,
  ];
  for (const re of candidates) {
    const raw = getFirstMatch(html, re);
    const txt = normalizeText(raw);
    if (txt.length >= 60) return txt;
  }
  return '';
}

function buildTitleMain(h1, relPath, pageType) {
  if (h1) return h1;
  const rp = relPath.replace(/\\/g, '/');
  const parts = rp.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  const stem = last.replace(/\.html$/i, '');
  if (stem && stem !== 'index') return stem.replace(/[-_]+/g, ' ');
  return pageType === 'home' ? 'Forex broker reviews & comparison' : 'Forex broker reviews';
}

function mainTitleKeywords(pageType) {
  switch (pageType) {
    case 'broker':
      return ['2026 fees & regulation', 'safety & spreads'];
    case 'compare':
      return ['spreads, fees & safety', 'side-by-side'];
    case 'news':
      // Keep this short so it can fit inside a 50–60 char title with suffix.
      return ['LATAM headlines', 'daily & weekly briefs'];
    case 'news-daily-post':
      return ['LATAM FX & crypto', 'market brief'];
    case 'news-weekly-post':
      return ['weekly forex brief', 'macro themes'];
    case 'guide':
    case 'education':
    case 'strategies':
      return ['risk-first guide', 'practical checklist'];
    case 'latam':
      return ['LATAM broker checks', 'country guide'];
    case 'methodology':
      return ['ratings & methodology', 'how we review'];
    default:
      return ['2026 guide', 'LATAM focus'];
  }
}

function shortTitlePads(pageType) {
  switch (pageType) {
    case 'news-daily-post':
      return ['LATAM brief', 'FX & crypto'];
    case 'news-weekly-post':
      return ['weekly brief', 'FX week'];
    case 'guide':
    case 'education':
    case 'strategies':
      return ['risk-first', '2026 guide'];
    case 'broker':
      return ['fees & regulation', 'safety'];
    case 'news':
      return ['LATAM', 'headlines'];
    default:
      return ['LATAM', '2026'];
  }
}

function buildTitle({ siteName, mainRaw, pageType }) {
  const suffix = ` | ${siteName}`;
  const min = 50;
  const max = 60;

  const allowedMainMax = Math.max(10, max - suffix.length);
  const allowedMainMin = Math.max(10, min - suffix.length);

  const base = trimDanglingTail(
    collapseSpaces(mainRaw)
      .replace(new RegExp(`^${siteName}\\s*[:–—-]\\s*`, 'i'), '')
      .replace(new RegExp(`\\b${siteName}\\b`, 'ig'), '')
      .replace(/\s+\(\d{4}\)\s*$/g, '')
  ).trim();
  const candidates = [
    base,
    `${base} — ${mainTitleKeywords(pageType)[0]}`,
    `${base} — ${mainTitleKeywords(pageType)[1]}`,
  ].map(collapseSpaces);

  let main = candidates.find((t) => t.length >= allowedMainMin && t.length <= allowedMainMax) || candidates[0];
  if (main.length > allowedMainMax) main = clampWords(main, allowedMainMax);
  main = trimDanglingTail(main);

  // If still short, append keywords until within range.
  if (main.length < allowedMainMin) {
    const pads = mainTitleKeywords(pageType);
    for (const kw of pads) {
      const next = collapseSpaces(`${main} — ${kw}`);
      if (next.length > allowedMainMax) continue;
      main = next;
      if (main.length >= allowedMainMin) break;
    }
  }

  // If still short, try compact pads (avoid repeating year-only pads).
  if (main.length < allowedMainMin) {
    for (const kw of shortTitlePads(pageType)) {
      const next = collapseSpaces(`${main} — ${kw}`);
      if (next.length > allowedMainMax) continue;
      main = next;
      if (main.length >= allowedMainMin) break;
    }
  }

  // Last resort: hard-pad with year.
  if (main.length < allowedMainMin) {
    const next = /\b2026\b/.test(main) ? main : collapseSpaces(`${main} — 2026`);
    main = next.length <= allowedMainMax ? next : main;
  }

  const title = collapseSpaces(`${main}${suffix}`);
  // Ensure within 50-60 by trimming main further if needed.
  if (title.length > max) {
    const trimmedMain = clampWords(main, Math.max(10, allowedMainMax - (title.length - max)));
    return collapseSpaces(`${trimmedMain}${suffix}`).slice(0, max);
  }
  if (title.length < min) {
    // Add a short filler before suffix.
    const filler = ' — 2026';
    const withFiller = /\b2026\b/.test(main) ? title : collapseSpaces(`${main}${filler}${suffix}`);
    if (withFiller.length <= max) return withFiller;
  }
  return title;
}

function buildDescription({ introRaw, pageType, siteName }) {
  const min = 140;
  const max = 160;

  let d = collapseSpaces(introRaw);
  if (!d) {
    d = `${siteName} page covering key details with a risk-first, LATAM-friendly approach. We summarize what matters and link to primary sources.`;
  }

  const pads = (() => {
    switch (pageType) {
      case 'broker':
        return [
          'Compare fees, spreads, platforms and regulation.',
          'Includes practical safety checks and a quick cost snapshot.',
        ];
      case 'compare':
        return [
          'Compare spreads, deposits, platforms and regulation side by side.',
          'Use it to shortlist brokers and verify costs before trading.',
        ];
      case 'news':
        return [
          'Daily and weekly briefs plus LATAM-focused forex headlines.',
          'Each item links to the original source for verification.',
        ];
      case 'guide':
      case 'education':
      case 'strategies':
        return [
          'Includes practical steps, examples, and a risk-first checklist.',
          'Built for traders who want clarity before placing a trade.',
        ];
      default:
        return [
          'Built for LATAM traders who want clear, practical context.',
          'Includes key takeaways and links where relevant.',
        ];
    }
  })();

  d = padToMin(d, min, pads);
  d = collapseSpaces(d);

  if (d.length > max) d = trimDanglingTail(clampWords(d, max));
  if (d.length < min) d = d.slice(0, max); // should be rare after padding
  if (!/[.!?]$/.test(d)) d = `${d}.`;
  if (d.length > max) d = trimDanglingTail(clampWords(d, max));

  return d;
}

function upsertTagBlock(headInner, tags, blockId) {
  const start = `<!-- SEO:${blockId}:START -->`;
  const end = `<!-- SEO:${blockId}:END -->`;

  const hasBlock = headInner.includes(start) && headInner.includes(end);
  const block = `${start}\n${tags.trim()}\n${end}`;

  if (hasBlock) {
    const re = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
    return headInner.replace(re, block);
  }
  return `${headInner.trimEnd()}\n\n${block}\n`;
}

function ensureHead(html, meta) {
  const lower = html.toLowerCase();
  const headOpenIdx = lower.indexOf('<head');
  const headCloseIdx = lower.indexOf('</head>');
  if (headOpenIdx === -1 || headCloseIdx === -1) return { html, changed: false };

  const headStart = html.indexOf('>', headOpenIdx);
  if (headStart === -1) return { html, changed: false };

  const before = html.slice(0, headStart + 1);
  const headInner = html.slice(headStart + 1, headCloseIdx);
  const after = html.slice(headCloseIdx);

  // Always update <title> and meta description directly.
  let nextInner = headInner;
  const titleTag = `<title>${escapeAttr(meta.title)}</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(nextInner)) nextInner = nextInner.replace(/<title>[\s\S]*?<\/title>/i, titleTag);
  else nextInner = `${titleTag}\n${nextInner.trimStart()}`;

  const descTag = `<meta name="description" content="${escapeAttr(meta.description)}">`;
  if (/<meta[^>]+name="description"[^>]*>/i.test(nextInner)) {
    nextInner = nextInner.replace(/<meta[^>]+name="description"[^>]*>/i, descTag);
  } else {
    // Place after viewport if possible.
    if (/<meta[^>]+name="viewport"[^>]*>/i.test(nextInner)) {
      nextInner = nextInner.replace(/(<meta[^>]+name="viewport"[^>]*>\s*)/i, `$1${descTag}\n`);
    } else {
      nextInner = `${descTag}\n${nextInner.trimStart()}`;
    }
  }

  // Canonical
  const canonicalTag = `<link rel="canonical" href="${escapeAttr(meta.canonical)}">`;
  // Normalize position: remove any existing canonical tag and re-insert after description.
  nextInner = nextInner.replace(/<link[^>]+rel="canonical"[^>]*>\s*/gi, '');
  if (/<meta[^>]+name="description"[^>]*>/i.test(nextInner)) {
    nextInner = nextInner.replace(/(<meta[^>]+name="description"[^>]*>\s*)/i, `$1${canonicalTag}\n`);
  } else if (/<meta[^>]+name="viewport"[^>]*>/i.test(nextInner)) {
    nextInner = nextInner.replace(/(<meta[^>]+name="viewport"[^>]*>\s*)/i, `$1${canonicalTag}\n`);
  } else if (/<meta[^>]+charset[^>]*>/i.test(nextInner)) {
    nextInner = nextInner.replace(/(<meta[^>]+charset[^>]*>\s*)/i, `$1${canonicalTag}\n`);
  } else {
    nextInner = `${canonicalTag}\n${nextInner.trimStart()}`;
  }

  // Remove pre-existing OG/Twitter tags to prevent duplicates.
  nextInner = nextInner
    .replace(/<meta[^>]+property="og:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name="twitter:[^"]+"[^>]*>\s*/gi, '');

  const ogType = meta.ogType;
  const ogTags = `
<meta property="og:type" content="${escapeAttr(ogType)}">
<meta property="og:site_name" content="${escapeAttr(meta.siteName)}">
<meta property="og:title" content="${escapeAttr(meta.ogTitle)}">
<meta property="og:description" content="${escapeAttr(meta.ogDescription)}">
<meta property="og:url" content="${escapeAttr(meta.canonical)}">
<meta property="og:image" content="${escapeAttr(meta.ogImage)}">
`.trim();

  const twitterTags = `
<meta name="twitter:card" content="${escapeAttr(meta.twitterCard)}">
<meta name="twitter:title" content="${escapeAttr(meta.ogTitle)}">
<meta name="twitter:description" content="${escapeAttr(meta.ogDescription)}">
<meta name="twitter:image" content="${escapeAttr(meta.ogImage)}">
`.trim();

  nextInner = upsertTagBlock(nextInner, ogTags, 'OG');
  nextInner = upsertTagBlock(nextInner, twitterTags, 'TWITTER');

  const next = `${before}${nextInner}${after}`;
  return { html: next, changed: next !== html };
}

function shouldSkip(relPath) {
  const base = path.basename(relPath);
  if (/^google[a-z0-9]+\.html$/i.test(base)) return true;
  return false;
}

function ensureSite(site) {
  const absDir = path.join(ROOT, site.dir);
  const files = listHtmlFiles(absDir);

  const planned = [];

  for (const abs of files) {
    const rel = path.relative(absDir, abs).replace(/\\/g, '/');
    if (shouldSkip(rel)) continue;

    const html = read(abs);
    const pageType = inferPageType(rel);
    const h1 = extractH1(html);
    const intro = extractIntroParagraph(html);
    const mainRaw = buildTitleMain(h1, rel, pageType);

    planned.push({
      abs,
      rel,
      pageType,
      titleMain: mainRaw,
      intro,
    });
  }

  // Ensure unique titles inside site.
  const used = new Map();
  const results = [];
  for (const p of planned) {
    const baseTitle = buildTitle({ siteName: site.siteName, mainRaw: p.titleMain, pageType: p.pageType });
    let title = baseTitle;

    // De-dup with a short discriminator.
    if (used.has(title)) {
      const disc = p.rel.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/[-_]+/g, ' ');
      const altMain = `${p.titleMain} — ${disc.split('/').slice(-2).join(' ')}`;
      title = buildTitle({ siteName: site.siteName, mainRaw: altMain, pageType: p.pageType });
    }
    used.set(title, true);

    const canonical = buildCanonical(site.baseUrl, p.rel);
    const description = buildDescription({ introRaw: p.intro, pageType: p.pageType, siteName: site.siteName });

    results.push({
      ...p,
      title,
      description,
      canonical,
      ogType: ['broker', 'guide', 'education', 'strategies', 'news-daily-post', 'news-weekly-post', 'methodology'].includes(p.pageType) ? 'article' : 'website',
    });
  }

  let changed = 0;
  for (const r of results) {
    const html = read(r.abs);
    const next = ensureHead(html, {
      title: r.title,
      description: r.description,
      canonical: r.canonical,
      siteName: site.siteName,
      ogTitle: r.title,
      ogDescription: r.description,
      ogImage: site.ogImage,
      ogType: r.ogType,
      twitterCard: site.twitterCard,
    });
    if (next.changed) {
      write(r.abs, next.html);
      changed += 1;
    }
  }

  return { site: site.key, files: results.length, changed };
}

function run() {
  const summaries = [];
  for (const site of SITE_CONFIGS) {
    summaries.push(ensureSite(site));
  }
  // eslint-disable-next-line no-console
  summaries.forEach((s) => console.log(`[seo] ${s.site}: updated ${s.changed}/${s.files} pages`));
}

run();

