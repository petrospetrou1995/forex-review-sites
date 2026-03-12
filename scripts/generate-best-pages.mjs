import fs from 'node:fs';
import path from 'node:path';
import { BROKERS } from './brokers-data.mjs';
import { runAll as runSitemaps } from './generate-sitemaps.mjs';
import { runAll as runNav } from './ensure-consistent-nav.mjs';

const ROOT = process.cwd();

const SITES = [
  {
    key: 'site1',
    dir: 'site1-dark-gradient',
    siteName: 'BrokerProReviews',
    canonicalBase: 'https://brokerproreviews.com',
    ogImage: 'https://brokerproreviews.com/og/brokerpro.png',
    fontHref: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    themeColor: '#0b1220',
  },
  {
    key: 'site2',
    dir: 'site2-minimal-light',
    siteName: 'Brokercompare',
    canonicalBase: 'https://brokerpro.pages.dev/site2-minimal-light',
    ogImage: 'https://brokerpro.pages.dev/og/brokerpro.png',
    fontHref: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
    themeColor: '#ffffff',
  },
];

const CATEGORIES = [
  {
    slug: 'forex-brokers',
    titleEn: 'Best forex brokers (LATAM shortlist)',
    titleEs: 'Mejores brokers de forex (lista LATAM)',
    descEn:
      'Top brokers shortlist for LATAM traders based on regulation checks, fees context, platforms, and withdrawal practicality. Always verify your exact entity.',
    descEs:
      'Lista para LATAM basada en verificación de regulación, costos, plataformas y retiros. Verifica siempre tu entidad exacta.',
    select(brokers) {
      return [...brokers].sort((a, b) => Number(b.ratingValue || 0) - Number(a.ratingValue || 0));
    },
  },
  {
    slug: 'brokers-for-beginners',
    titleEn: 'Best brokers for beginners (risk-first)',
    titleEs: 'Mejores brokers para principiantes (riesgo primero)',
    descEn:
      'A beginner-friendly shortlist: low barriers to test, familiar platforms, and clear safety checks. Start with a demo and a small withdrawal test.',
    descEs:
      'Lista para principiantes: fácil para probar, plataformas conocidas y verificación de seguridad. Empieza con demo y retiro pequeño.',
    select(brokers) {
      const minNum = (b) => {
        const m = String(b.minDeposit || '').replace(/,/g, '').match(/(\d+(\.\d+)?)/);
        return m ? Number(m[1]) : 999999;
      };
      return [...brokers].sort((a, b) => (minNum(a) - minNum(b)) || (Number(b.ratingValue || 0) - Number(a.ratingValue || 0)));
    },
  },
  {
    slug: 'low-spread-brokers',
    titleEn: 'Best low spread brokers (cost-focused)',
    titleEs: 'Mejores brokers de spread bajo (costos)',
    descEn:
      'Shortlist for tight spreads and cost-sensitive trading. Compare all-in cost (spread + commission + swaps) and test execution during volatility.',
    descEs:
      'Lista para spreads ajustados y trading sensible a costos. Compara costo total (spread + comisión + swaps) y prueba ejecución.',
    select(brokers) {
      const spreadNum = (b) => {
        const s = b?.comparison?.spreads || '';
        const m = String(s).match(/(\d+(\.\d+)?)/);
        return m ? Number(m[1]) : 999;
      };
      return [...brokers].sort((a, b) => (spreadNum(a) - spreadNum(b)) || (Number(b.ratingValue || 0) - Number(a.ratingValue || 0)));
    },
  },
  {
    slug: 'crypto-brokers',
    titleEn: 'Best crypto brokers (availability varies)',
    titleEs: 'Mejores brokers cripto (disponibilidad varía)',
    descEn:
      'Crypto CFDs/crypto instruments availability can vary by entity and region. Use this shortlist to compare platforms, fees context, and safety checks, then confirm instruments in your portal.',
    descEs:
      'La disponibilidad de cripto (CFDs/instrumentos) varía por entidad y región. Usa esta lista para comparar plataformas, costos y seguridad, y confirma instrumentos en tu portal.',
    select(brokers) {
      const mentionsCrypto = (b) => {
        const blob = `${b.verdict || ''} ${(b.spreadsFees || []).join(' ')} ${(b.comparison?.fees || '')}`.toLowerCase();
        return /\bcrypto\b|\bcripto\b|\bcfd\b/.test(blob) ? 1 : 0;
      };
      return [...brokers].sort((a, b) => (mentionsCrypto(b) - mentionsCrypto(a)) || (Number(b.ratingValue || 0) - Number(a.ratingValue || 0)));
    },
  },
];

function write(relPath, content) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
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

function canonical(site, relPretty) {
  return `${site.canonicalBase}${relPretty}`;
}

function head(site, title, description, canonicalUrl) {
  const css = site.key === 'site1' ? '../../styles.css' : '../../styles.css';
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta name="theme-color" content="${site.themeColor}">
    <link rel="preload" href="${css}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${css}"></noscript>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${site.fontHref}" rel="stylesheet">

    <!-- SEO:OG:START -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(site.siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:image" content="${escapeAttr(site.ogImage)}">
    <!-- SEO:OG:END -->

    <!-- SEO:TWITTER:START -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(site.ogImage)}">
    <!-- SEO:TWITTER:END -->
  `.trim();
}

function brokerReviewHref(site, broker) {
  // All sites use same relative structure.
  return `../../brokers/${broker.slug}-review/`;
}

function top10ListHtml(site, brokers) {
  const items = brokers.slice(0, 10);
  const lis = items
    .map((b, idx) => {
      const href = brokerReviewHref(site, b);
      const en = `${b.name} review →`;
      const es = `Reseña de ${b.name} →`;
      return `<li><strong>#${idx + 1} ${escapeHtml(b.name)}</strong> — <a class="${site.key === 'site1' ? 'link-cta' : 'btn-link'}" href="${escapeAttr(href)}" data-en="${escapeAttr(en)}" data-es="${escapeAttr(es)}">${escapeHtml(en)}</a></li>`;
    })
    .join('');

  const placeholdersNeeded = Math.max(0, 10 - items.length);
  const placeholders = Array.from({ length: placeholdersNeeded })
    .map((_, i) => `<li class="${site.key === 'site1' ? 'rating-small' : 'muted'}"><strong>#${items.length + i + 1}</strong> — More brokers being added…</li>`)
    .join('');

  return `<ol class="${site.key === 'site1' ? 'guide-list' : ''}">${lis}${placeholders}</ol>`;
}

function comparisonTableHtml(site, brokers) {
  const items = brokers.slice(0, 10);
  const rows = items
    .map((b) => {
      const regs = (b.regulators || []).join(', ') || 'Varies';
      const plats = (b.platforms || []).join(', ') || 'Varies';
      const spreads = b.comparison?.spreads || 'Varies';
      const minDep = b.minDeposit || 'Varies';
      const rating = `${String(b.ratingValue ?? '')}/5`;
      const href = brokerReviewHref(site, b);
      const nameCell = `<a class="${site.key === 'site1' ? 'link-cta' : 'btn-link'}" href="${escapeAttr(href)}">${escapeHtml(b.name)}</a>`;
      return `<tr>
        <th scope="row" class="primary">${nameCell}</th>
        <td>${escapeHtml(rating)}</td>
        <td>${escapeHtml(minDep)}</td>
        <td>${escapeHtml(spreads)}</td>
        <td>${escapeHtml(plats)}</td>
        <td>${escapeHtml(regs)}</td>
      </tr>`;
    })
    .join('');

  const table = site.key === 'site1'
    ? `<div class="table-scroll"><table class="table-basic"><caption class="sr-only">Top brokers comparison table</caption><thead><tr>
        <th scope="col">Broker</th><th scope="col">Rating</th><th scope="col">Min deposit</th><th scope="col">Spreads</th><th scope="col">Platforms</th><th scope="col">Regulation</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="table-wrapper"><table><caption class="sr-only">Top brokers comparison table</caption><thead><tr>
        <th scope="col">Broker</th><th scope="col">Rating</th><th scope="col">Min deposit</th><th scope="col">Spreads</th><th scope="col">Platforms</th><th scope="col">Regulation</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;

  return table;
}

function summariesHtml(site, brokers) {
  const items = brokers.slice(0, 10);
  const cards = items
    .map((b) => {
      const href = brokerReviewHref(site, b);
      const excerpt = String(b.verdict || '').trim();
      const short = excerpt.length > 220 ? `${excerpt.slice(0, 218).trimEnd()}…` : excerpt;
      const regs = (b.regulators || []).join(', ') || 'Varies';
      const plats = (b.platforms || []).join(', ') || 'Varies';
      const minDep = b.minDeposit || 'Varies';

      if (site.key === 'site1') {
        return `<div class="card-panel">
          <h2 class="subheading-card">${escapeHtml(b.name)}</h2>
          <p class="guide-text">${escapeHtml(short)}</p>
          <ul class="guide-checklist">
            <li><strong>Rating</strong>: ${escapeHtml(String(b.ratingValue ?? ''))}/5</li>
            <li><strong>Min deposit</strong>: ${escapeHtml(minDep)}</li>
            <li><strong>Platforms</strong>: ${escapeHtml(plats)}</li>
            <li><strong>Regulation</strong>: ${escapeHtml(regs)}</li>
          </ul>
          <div class="link-row mt-4">
            <a class="link-cta" href="${escapeAttr(href)}" data-en="Read ${escapeAttr(b.name)} review →" data-es="Leer reseña de ${escapeAttr(b.name)} →">Read ${escapeHtml(b.name)} review →</a>
          </div>
        </div>`;
      }

      return `<div class="card card-pad">
        <h2 class="card-title">${escapeHtml(b.name)}</h2>
        <p class="muted">${escapeHtml(short)}</p>
        <ul class="learn-list muted small">
          <li><strong>Rating:</strong> ${escapeHtml(String(b.ratingValue ?? ''))}/5</li>
          <li><strong>Min deposit:</strong> ${escapeHtml(minDep)}</li>
          <li><strong>Platforms:</strong> ${escapeHtml(plats)}</li>
          <li><strong>Regulation:</strong> ${escapeHtml(regs)}</li>
        </ul>
        <div class="link-row">
          <a class="btn-link" href="${escapeAttr(href)}" data-en="Read ${escapeAttr(b.name)} review →" data-es="Leer reseña de ${escapeAttr(b.name)} →">Read ${escapeHtml(b.name)} review →</a>
        </div>
      </div>`;
    })
    .join('');

  if (site.key === 'site1') return cards;
  return `<div class="grid grid-3">${cards}</div>`;
}

function site1BestPage(site, cat, brokers) {
  const relPretty = `/best/${cat.slug}/`;
  const canon = canonical(site, relPretty);
  const title = `${cat.titleEn} | ${site.siteName}`;
  const description = cat.descEn;
  const picked = cat.select(brokers);

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head(site, title, description, canon)}
</head>
<body>
  <header class="header guide-header">
    <nav class="nav guide-nav">
      <div class="container">
        <div class="nav-content">
          <a class="logo" href="../../index.html" aria-label="${escapeAttr(site.siteName)} home">
            <span class="logo-icon">📊</span>
            <span class="logo-text">${escapeHtml(site.siteName)}</span>
          </a>
          <div class="nav-actions">
            <a class="guide-back link-cta" href="../" data-en="← Back to categories" data-es="← Volver a categorías">← Back to categories</a>
            <button class="lang-toggle" id="langToggle" type="button">ES</button>
          </div>
        </div>
      </div>
    </nav>
  </header>

  <main class="section-pad section-pad-dark">
    <div class="container">
      <article class="guide-article">
        <h1 class="guide-title" data-en="${escapeAttr(cat.titleEn)}" data-es="${escapeAttr(cat.titleEs)}">${escapeHtml(cat.titleEn)}</h1>
        <p class="guide-lead" data-en="${escapeAttr(cat.descEn)}" data-es="${escapeAttr(cat.descEs)}">${escapeHtml(cat.descEn)}</p>

        <div class="card-panel">
          <h2 class="subheading-card" data-en="Top 10 shortlist" data-es="Top 10 (lista)">Top 10 shortlist</h2>
          ${top10ListHtml(site, picked)}
          <p class="rating-small" data-en="This shortlist uses our internal scorecards. Always verify the exact regulated entity for your country." data-es="Esta lista usa nuestro puntaje interno. Verifica la entidad regulada para tu país.">This shortlist uses our internal scorecards. Always verify the exact regulated entity for your country.</p>
        </div>

        <div class="card-panel">
          <h2 class="subheading-card" data-en="Comparison table" data-es="Tabla comparativa">Comparison table</h2>
          ${comparisonTableHtml(site, picked)}
        </div>

        <div class="card-panel">
          <h2 class="subheading-card" data-en="Broker summaries" data-es="Resúmenes de brokers">Broker summaries</h2>
          <p class="rating-small" data-en="Short summaries plus links to the full review pages." data-es="Resúmenes cortos y enlaces a reseñas completas.">Short summaries plus links to the full review pages.</p>
        </div>

        ${summariesHtml(site, picked)}
      </article>
    </div>
  </main>

  <script src="../../translations.js" defer></script>
  <script src="../../app.js" defer></script>
</body>
</html>
`;
}

function site2BestPage(site, cat, brokers) {
  const relPretty = `/best/${cat.slug}/`;
  const canon = canonical(site, relPretty);
  const title = `${cat.titleEn} | ${site.siteName}`;
  const description = cat.descEn;
  const picked = cat.select(brokers);

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head(site, title, description, canon)}
</head>
<body>
  <header class="header">
    <div class="container">
      <nav class="navbar">
        <a class="logo" href="../../index.html">${escapeHtml(site.siteName)}</a>
        <ul class="nav-links" id="primaryNav">
          <li><a href="../../reviews/" data-en="Reviews" data-es="Reseñas">Reviews</a></li>
          <li><a href="../../compare/" data-en="Compare" data-es="Comparar">Compare</a></li>
          <li><a href="../../news/" data-en="News" data-es="Noticias">News</a></li>
        </ul>
        <div class="nav-right">
          <button class="menu-btn" id="menuToggle" type="button" aria-controls="primaryNav" aria-expanded="false" data-en="Menu" data-es="Menú">Menu</button>
          <button class="lang-btn" id="langToggle" type="button">ES</button>
        </div>
      </nav>
    </div>
  </header>

  <main>
    <section class="section">
      <div class="container">
        <div class="link-row">
          <a class="btn-inline" href="../" data-en="← Back to categories" data-es="← Volver a categorías">← Back to categories</a>
        </div>

        <h1 class="section-heading-md" data-en="${escapeAttr(cat.titleEn)}" data-es="${escapeAttr(cat.titleEs)}">${escapeHtml(cat.titleEn)}</h1>
        <p class="section-lead section-lead-narrow" data-en="${escapeAttr(cat.descEn)}" data-es="${escapeAttr(cat.descEs)}">${escapeHtml(cat.descEn)}</p>

        <div class="card card-pad">
          <h2 class="card-title" data-en="Top 10 shortlist" data-es="Top 10 (lista)">Top 10 shortlist</h2>
          ${top10ListHtml(site, picked)}
        </div>

        <div class="card card-pad mt-3">
          <h2 class="card-title" data-en="Comparison table" data-es="Tabla comparativa">Comparison table</h2>
          ${comparisonTableHtml(site, picked)}
        </div>

        <div class="mt-3">
          <h2 class="section-heading-md" data-en="Broker summaries" data-es="Resúmenes de brokers">Broker summaries</h2>
          <p class="section-lead section-lead-narrow" data-en="Short summaries plus links to the full review pages." data-es="Resúmenes cortos y enlaces a reseñas completas.">Short summaries plus links to the full review pages.</p>
          ${summariesHtml(site, picked)}
        </div>
      </div>
    </section>
  </main>

  <script src="../../translations.js" defer></script>
  <script src="../../app.js" defer></script>
</body>
</html>
`;
}

function siteBrokers(site) {
  return BROKERS.filter((b) => fs.existsSync(path.join(ROOT, site.dir, 'brokers', `${b.slug}-review`, 'index.html')));
}

function run() {
  for (const site of SITES) {
    const brokers = siteBrokers(site);
    for (const cat of CATEGORIES) {
      const relPath = `${site.dir}/best/${cat.slug}/index.html`;
      const html = site.key === 'site1' ? site1BestPage(site, cat, brokers) : site2BestPage(site, cat, brokers);
      write(relPath, html);
    }
    // eslint-disable-next-line no-console
    console.log(`[best] ${site.key}: generated ${CATEGORIES.length} category pages`);
  }
  runSitemaps();
  runNav();
}

run();

