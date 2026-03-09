import fs from 'node:fs';
import path from 'node:path';
import { BROKERS } from './brokers-data.mjs';
import { ensureBrokerFaqs } from './broker-faqs.mjs';
import { discoverConfiguredSites } from './site-config.mjs';

const ROOT = process.cwd();

const SITES = discoverConfiguredSites().map((s) => ({
  key: s.key,
  dir: s.dir,
  siteName: s.siteName,
  baseUrl: s.baseUrl,
  logoUrl: s.logoUrl,
}));

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

function shouldSkip(rel) {
  const base = path.basename(rel);
  if (/^google[a-z0-9]+\.html$/i.test(base)) return true;
  return false;
}

function isRedirectStub(html) {
  const s = String(html || '');
  return /http-equiv="refresh"/i.test(s) && /This page moved/i.test(s) && /window\.location\.replace/i.test(s);
}

function hasSchemaType(html, type) {
  const t = String(type || '').trim();
  if (!t) return false;
  // Rough but effective: match JSON-LD occurrences of "@type": "<type>" (case-insensitive).
  const re = new RegExp(`"@type"\\s*:\\s*"${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"`, 'i');
  return re.test(String(html || ''));
}

function getFirst(html, re) {
  const m = String(html || '').match(re);
  return m ? m[1] : '';
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

function slugify(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return t || 'page';
}

function json(obj) {
  // Avoid embedding raw < which can break HTML parsing in some cases.
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function upsertBetween(html, start, end, nextInner) {
  const s = String(html || '');
  const a = s.indexOf(start);
  const b = s.indexOf(end);
  if (a !== -1 && b !== -1 && b > a) {
    return s.slice(0, a + start.length) + `\n${nextInner.trim()}\n` + s.slice(b);
  }
  // Insert before </body> if possible.
  const bodyClose = s.toLowerCase().lastIndexOf('</body>');
  if (bodyClose === -1) return s;
  return s.slice(0, bodyClose) + `\n${start}\n${nextInner.trim()}\n${end}\n` + s.slice(bodyClose);
}

function orgSchema(site) {
  const orgId = `${site.baseUrl}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': orgId,
    name: site.siteName,
    url: `${site.baseUrl}/`,
    logo: {
      '@type': 'ImageObject',
      url: site.logoUrl,
    },
    image: site.logoUrl,
  };
}

function websiteSchema(site) {
  const orgId = `${site.baseUrl}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.baseUrl}/#website`,
    url: `${site.baseUrl}/`,
    name: site.siteName,
    publisher: { '@id': orgId },
    inLanguage: ['en', 'es'],
  };
}

function parseCanonical(html, site, rel) {
  const c = getFirst(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i).trim();
  if (c) return c;
  // Fallback: compute from rel path
  const rp = rel.replace(/\\/g, '/');
  if (rp === 'index.html') return `${site.baseUrl}/`;
  if (rp.endsWith('/index.html')) return `${site.baseUrl}/${rp.slice(0, -'index.html'.length)}`;
  return `${site.baseUrl}/${rp}`;
}

function inferPageKind(rel) {
  const rp = rel.replace(/\\/g, '/');
  if (rp === 'index.html') return 'home';
  if (/^brokers\/.+-review\/index\.html$/i.test(rp)) return 'broker-review';
  if (/^compare\/[^/]+-vs-[^/]+\/index\.html$/i.test(rp)) return 'compare';
  if (/^guides\/[^/]+\/index\.html$/i.test(rp)) return 'guide-article';
  if (/^news\/daily\/\d{4}-\d{2}-\d{2}\/index\.html$/i.test(rp)) return 'news-daily';
  if (/^news\/weekly\/\d{4}-W\d{2}\/index\.html$/i.test(rp)) return 'news-weekly';
  return 'page';
}

function extractH1(html) {
  return normalizeText(getFirst(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
}

function extractMetaDescription(html) {
  return decodeEntities(getFirst(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i)).trim();
}

function extractTimeDatetime(html) {
  const dt = getFirst(html, /<time[^>]+datetime="([^"]+)"/i).trim();
  return dt;
}

function isoFromFsMtime(absPath) {
  try {
    const st = fs.statSync(absPath);
    return new Date(st.mtimeMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}

function isoFromDailyRel(rel) {
  const m = rel.replace(/\\/g, '/').match(/news\/daily\/(\d{4}-\d{2}-\d{2})\/index\.html$/i);
  if (!m?.[1]) return '';
  return `${m[1]}T09:00:00Z`;
}

function isoFromWeeklyRel(rel) {
  const m = rel.replace(/\\/g, '/').match(/news\/weekly\/(\d{4})-W(\d{2})\/index\.html$/i);
  if (!m) return '';
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return '';

  // ISO week Monday date
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7, Monday=1
  const mondayWeek1 = new Date(Date.UTC(year, 0, 4 - (jan4Day - 1)));
  const monday = new Date(mondayWeek1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const iso = monday.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return iso;
}

function blogPostingSchema({ site, canonicalUrl, headline, description, datePublished, dateModified }) {
  const orgId = `${site.baseUrl}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    description,
    image: [site.logoUrl],
    datePublished,
    dateModified,
    author: { '@id': orgId },
    publisher: {
      '@id': orgId,
    },
    mainEntityOfPage: canonicalUrl,
  };
}

function comparisonSchema({ site, canonicalUrl, headline, description, brokers }) {
  const orgId = `${site.baseUrl}/#organization`;
  const items = (brokers || []).slice(0, 2).map((b, idx) => {
    const rating = Number(b.ratingValue);
    const ratingValue = Number.isFinite(rating) ? String(rating.toFixed(1)) : undefined;
    return {
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Product',
        name: b.name,
        url: `${site.baseUrl}/brokers/${b.slug}-review/`,
        image: site.logoUrl,
        ...(ratingValue
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue,
                bestRating: '5',
              },
            }
          : {}),
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: headline,
    description,
    url: canonicalUrl,
    publisher: { '@id': orgId },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items,
    },
    about: items.map((x) => x.item),
    mainEntityOfPage: canonicalUrl,
  };
}

function bestListSchema({ site, canonicalUrl, headline, description, brokers }) {
  const orgId = `${site.baseUrl}/#organization`;
  const items = (brokers || []).slice(0, 10).map((b, idx) => {
    const rating = Number(b.ratingValue);
    const ratingValue = Number.isFinite(rating) ? String(rating.toFixed(1)) : undefined;
    return {
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Product',
        name: b.name,
        url: `${site.baseUrl}/brokers/${b.slug}-review/`,
        image: site.logoUrl,
        ...(ratingValue
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue,
                bestRating: '5',
                ratingCount: 1,
              },
            }
          : {}),
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: canonicalUrl,
    name: headline,
    description,
    image: [site.logoUrl],
    author: { '@id': orgId },
    publisher: { '@id': orgId },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items,
    },
    about: items.map((x) => x.item),
    mainEntityOfPage: canonicalUrl,
  };
}

function reviewSchema({ site, broker, canonicalUrl }) {
  const orgId = `${site.baseUrl}/#organization`;
  const rating = Number(broker.ratingValue);
  const ratingValue = Number.isFinite(rating) ? String(rating.toFixed(1)) : '4.5';
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'Product',
      name: broker.name,
      image: site.logoUrl,
      url: canonicalUrl,
    },
    author: { '@id': orgId },
    publisher: { '@id': orgId },
    reviewRating: {
      '@type': 'Rating',
      ratingValue,
      bestRating: '5',
    },
    datePublished: TODAY,
    reviewBody: broker.verdict,
    mainEntityOfPage: canonicalUrl,
  };
}

function faqSchema({ canonicalUrl, faqs }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (faqs || []).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
    url: canonicalUrl,
  };
}

const TODAY = new Date().toISOString().slice(0, 10);

function ensureStructuredDataForFile({ site, absPath, relPath }) {
  const html = fs.readFileSync(absPath, 'utf8');
  if (shouldSkip(relPath) || isRedirectStub(html)) return { changed: false };

  const kind = inferPageKind(relPath);
  const canonicalUrl = parseCanonical(html, site, relPath);
  const title = normalizeText(getFirst(html, /<title>([\s\S]*?)<\/title>/i)) || canonicalUrl;
  const description = extractMetaDescription(html) || title;
  const h1 = extractH1(html) || title;

  const jsonlds = [];
  // Avoid duplicating existing JSON-LD types; keep our injected block minimal and additive.
  if (!hasSchemaType(html, 'Organization')) jsonlds.push(orgSchema(site));
  if (!hasSchemaType(html, 'WebSite')) jsonlds.push(websiteSchema(site));

  // Best ranking pages: inject ItemList schema of top brokers.
  {
    const rp = relPath.replace(/\\/g, '/');
    const m = rp.match(/^best\/([^/]+)\/index\.html$/i);
    const bestSlug = m?.[1] || '';
    if (bestSlug && !hasSchemaType(html, 'ItemList') && !hasSchemaType(html, 'WebPage')) {
      const all = BROKERS.filter((b) =>
        fs.existsSync(path.join(ROOT, site.dir, 'brokers', `${b.slug}-review`, 'index.html'))
      );

      const minNum = (b) => {
        const mm = String(b.minDeposit || '').replace(/,/g, '').match(/(\d+(\.\d+)?)/);
        return mm ? Number(mm[1]) : 999999;
      };

      const spreadNum = (b) => {
        const s = b?.comparison?.spreads || '';
        const mm = String(s).match(/(\d+(\.\d+)?)/);
        return mm ? Number(mm[1]) : 999;
      };

      const mentionsCrypto = (b) => {
        const blob = `${b.verdict || ''} ${(b.spreadsFees || []).join(' ')} ${(b.comparison?.fees || '')}`.toLowerCase();
        return /\bcrypto\b|\bcripto\b|\bcfd\b/.test(blob) ? 1 : 0;
      };

      let picked = [...all];
      if (bestSlug === 'forex-brokers') {
        picked.sort((a, b) => Number(b.ratingValue || 0) - Number(a.ratingValue || 0));
      } else if (bestSlug === 'brokers-for-beginners') {
        picked.sort((a, b) => (minNum(a) - minNum(b)) || (Number(b.ratingValue || 0) - Number(a.ratingValue || 0)));
      } else if (bestSlug === 'low-spread-brokers') {
        picked.sort((a, b) => (spreadNum(a) - spreadNum(b)) || (Number(b.ratingValue || 0) - Number(a.ratingValue || 0)));
      } else if (bestSlug === 'crypto-brokers') {
        picked.sort((a, b) => (mentionsCrypto(b) - mentionsCrypto(a)) || (Number(b.ratingValue || 0) - Number(a.ratingValue || 0)));
      } else {
        picked.sort((a, b) => Number(b.ratingValue || 0) - Number(a.ratingValue || 0));
      }

      jsonlds.push(
        bestListSchema({
          site,
          canonicalUrl,
          headline: h1,
          description,
          brokers: picked,
        })
      );
    }
  }

  if (kind === 'broker-review') {
    const m = relPath.replace(/\\/g, '/').match(/^brokers\/(.+)-review\/index\.html$/i);
    const slug = m?.[1] || '';
    const broker = BROKERS.find((b) => b.slug === slug) || BROKERS.find((b) => slug && slugify(b.name) === slug);
    if (broker) {
      if (!hasSchemaType(html, 'Review')) jsonlds.push(reviewSchema({ site, broker, canonicalUrl }));
      if (!hasSchemaType(html, 'FAQPage')) jsonlds.push(faqSchema({ canonicalUrl, faqs: ensureBrokerFaqs(broker) }));
    }
  }

  if (kind === 'guide-article' || kind === 'news-daily' || kind === 'news-weekly') {
    const dtFromTime = extractTimeDatetime(html);
    const dtFromPath = kind === 'news-daily'
      ? isoFromDailyRel(relPath)
      : kind === 'news-weekly'
        ? isoFromWeeklyRel(relPath)
        : '';
    const datePublished = dtFromTime || dtFromPath || isoFromFsMtime(absPath);
    const dateModified = isoFromFsMtime(absPath);
    if (!hasSchemaType(html, 'BlogPosting') && !hasSchemaType(html, 'Article') && !hasSchemaType(html, 'NewsArticle')) {
      jsonlds.push(
        blogPostingSchema({
          site,
          canonicalUrl,
          headline: h1,
          description,
          datePublished,
          dateModified,
        })
      );
    }
  }

  if (kind === 'compare') {
    const rp = relPath.replace(/\\/g, '/');
    const m = rp.match(/^compare\/([^/]+)-vs-([^/]+)\/index\.html$/i);
    const aSlug = m?.[1] || '';
    const bSlug = m?.[2] || '';
    const a = BROKERS.find((x) => x.slug === aSlug);
    const b = BROKERS.find((x) => x.slug === bSlug);
    const brokers = [a, b].filter(Boolean);
    if (brokers.length === 2 && !hasSchemaType(html, 'ItemList') && !hasSchemaType(html, 'WebPage')) {
      jsonlds.push(
        comparisonSchema({
          site,
          canonicalUrl,
          headline: h1,
          description,
          brokers,
        })
      );
    }
  }

  if (!jsonlds.length) return { changed: false };

  const block = `
<script type="application/ld+json">
${json(jsonlds)}
</script>
`.trim();

  const next = upsertBetween(html, '<!-- JSONLD:GLOBAL:START -->', '<!-- JSONLD:GLOBAL:END -->', block);
  if (next !== html) fs.writeFileSync(absPath, next, 'utf8');
  return { changed: next !== html };
}

function runSite(site) {
  const absDir = path.join(ROOT, site.dir);
  const files = listHtmlFiles(absDir);
  let changed = 0;
  let total = 0;
  for (const abs of files) {
    const rel = path.relative(absDir, abs).replace(/\\/g, '/');
    total += 1;
    const res = ensureStructuredDataForFile({ site, absPath: abs, relPath: rel });
    if (res.changed) changed += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[jsonld] ${site.key}: updated ${changed}/${total}`);
}

for (const s of SITES) runSite(s);

