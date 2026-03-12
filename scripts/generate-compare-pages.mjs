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

function pairs(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  }
  return out;
}

function relPrettyCompare(a, b) {
  return `/compare/${a.slug}-vs-${b.slug}/`;
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
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="${site.themeColor}">
  <link rel="stylesheet" href="${css}">
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

function brokerSpreads(b) {
  return (b?.comparison?.spreads || '').trim() || 'Varies by account type and market conditions';
}

function brokerFees(b) {
  return (b?.comparison?.fees || '').trim() || 'Varies by account type; include swaps/financing for overnight holds';
}

function brokerRegulation(b) {
  return (b?.regulators || []).join(', ') || 'Varies by entity';
}

function brokerPlatforms(b) {
  return (b?.platforms || []).join(', ') || 'Varies by region/entity';
}

function brokerMinDeposit(b) {
  return (b?.minDeposit || '').trim() || 'Varies';
}

function brokerRating(b) {
  return `${String(b?.ratingValue ?? '4.5')}/5`;
}

function comparisonTableRows(a, b) {
  const rows = [
    { k: 'Spreads', a: brokerSpreads(a), b: brokerSpreads(b) },
    { k: 'Fees', a: brokerFees(a), b: brokerFees(b) },
    { k: 'Regulation', a: brokerRegulation(a), b: brokerRegulation(b) },
    { k: 'Trading platforms', a: brokerPlatforms(a), b: brokerPlatforms(b) },
    { k: 'Minimum deposit', a: brokerMinDeposit(a), b: brokerMinDeposit(b) },
    { k: 'Rating score', a: brokerRating(a), b: brokerRating(b) },
  ];

  return rows
    .map(
      (r) =>
        `<tr>
          <th scope="row" class="primary">${escapeHtml(r.k)}</th>
          <td>${escapeHtml(r.a)}</td>
          <td>${escapeHtml(r.b)}</td>
        </tr>`
    )
    .join('');
}

function site1ComparePage(site, a, b) {
  const relPretty = relPrettyCompare(a, b);
  const canon = canonical(site, relPretty);
  const title = `${a.name} vs ${b.name} — fees & safety comparison | ${site.siteName}`;
  const description = `Compare ${a.name} vs ${b.name}: regulation checks, platforms, minimum deposit, and cost considerations. Use a risk-first checklist before funding.`;

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
            <a class="guide-back link-cta" href="../../index.html#comparison" data-en="← Back to comparison" data-es="← Volver a comparación">← Back to comparison</a>
            <button class="lang-toggle" id="langToggle" type="button">ES</button>
          </div>
        </div>
      </div>
    </nav>
  </header>

  <main class="section-pad section-pad-dark">
    <div class="container">
      <article class="guide-article">
        <h1 class="guide-title">${escapeHtml(a.name)} vs ${escapeHtml(b.name)} (2026)</h1>
        <p class="guide-lead">
          Compare ${escapeHtml(a.name)} vs ${escapeHtml(b.name)} using a simple, risk-first checklist: entity/regulation, all-in costs, platforms, and withdrawals.
        </p>

        <div class="card-panel">
          <h2 class="subheading-card" data-en="Comparison table" data-es="Tabla comparativa">Comparison table</h2>
          <div class="table-scroll">
            <table class="table-basic">
              <caption class="sr-only">${escapeHtml(a.name)} vs ${escapeHtml(b.name)} comparison table</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">${escapeHtml(a.name)}</th>
                  <th scope="col">${escapeHtml(b.name)}</th>
                </tr>
              </thead>
              <tbody>
                ${comparisonTableRows(a, b)}
              </tbody>
            </table>
          </div>
          <p class="rating-small" data-en="These are comparison summaries. Always verify the exact regulated entity and current pricing on the broker’s official site." data-es="Son resúmenes comparativos. Verifica la entidad regulada y precios en el sitio oficial.">
            These are comparison summaries. Always verify the exact regulated entity and current pricing on the broker’s official site.
          </p>
        </div>

        <div class="card-panel">
          <h2 class="subheading-card">How to decide (risk-first)</h2>
          <ul class="guide-list">
            <li>Compare all-in cost (spread + commission + swaps) for your main pairs and trade size.</li>
            <li>Verify the exact entity and license status on official regulator registers.</li>
            <li>Test withdrawals early with a small amount before scaling.</li>
          </ul>
          <div class="link-row mt-4">
            <a class="link-cta" href="../../brokers/${a.slug}-review/" data-en="Read ${escapeAttr(a.name)} broker review →" data-es="Leer reseña de ${escapeAttr(a.name)} →">Read ${escapeHtml(a.name)} broker review →</a>
            <a class="link-cta" href="../../brokers/${b.slug}-review/" data-en="Read ${escapeAttr(b.name)} broker review →" data-es="Leer reseña de ${escapeAttr(b.name)} →">Read ${escapeHtml(b.name)} broker review →</a>
          </div>
        </div>
      </article>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-bottom">
        <p>&copy; 2026 ${escapeHtml(site.siteName)}.</p>
      </div>
    </div>
  </footer>

  <script src="../../translations.js"></script>
  <script src="../../app.js"></script>
</body>
</html>
`;
}

function site2ComparePage(site, a, b) {
  const relPretty = relPrettyCompare(a, b);
  const canon = canonical(site, relPretty);
  const title = `${a.name} vs ${b.name} — compare fees & safety | ${site.siteName}`;
  const description = `Compare ${a.name} vs ${b.name} side by side: regulation checks, platforms, minimum deposit, and cost considerations. Risk-first shortlist.`;

  const list = (arr) => `<ul>${(arr || []).map((x) => `<li class="muted">${escapeHtml(x)}</li>`).join('')}</ul>`;

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
          <li><a href="../" data-en="Compare" data-es="Comparar">Compare</a></li>
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
          <a class="btn-inline" href="../" data-en="← Back to compare" data-es="← Volver a comparar">← Back to compare</a>
        </div>

        <h1 class="section-heading-md">${escapeHtml(a.name)} vs ${escapeHtml(b.name)}</h1>
        <p class="section-lead section-lead-narrow">${escapeHtml(description)}</p>

        <div class="card card-pad">
          <h2 class="card-title" data-en="Comparison table" data-es="Tabla comparativa">Comparison table</h2>
          <p class="muted small" data-en="Summaries only. Always verify the exact regulated entity and current pricing on the broker’s official site." data-es="Solo resúmenes. Verifica la entidad regulada y precios en el sitio oficial.">
            Summaries only. Always verify the exact regulated entity and current pricing on the broker’s official site.
          </p>
          <div class="table-wrapper">
            <table>
              <caption class="sr-only">${escapeHtml(a.name)} vs ${escapeHtml(b.name)} comparison table</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">${escapeHtml(a.name)}</th>
                  <th scope="col">${escapeHtml(b.name)}</th>
                </tr>
              </thead>
              <tbody>
                ${comparisonTableRows(a, b)}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid grid-3">
          <div class="card card-pad">
            <h2 class="card-title">${escapeHtml(a.name)} snapshot</h2>
            <p class="muted"><strong>Rating:</strong> ${escapeHtml(a.ratingValue)}/5</p>
            <p class="muted"><strong>Min deposit:</strong> ${escapeHtml(a.minDeposit || 'Varies')}</p>
            <p class="muted"><strong>Platforms:</strong> ${escapeHtml((a.platforms || []).join(', ') || 'Varies')}</p>
            <p class="muted"><strong>Regulators:</strong> ${escapeHtml((a.regulators || []).join(', ') || 'Varies')}</p>
            <a class="btn-link" href="../../brokers/${a.slug}-review/" data-en="Read ${escapeAttr(a.name)} review →" data-es="Leer reseña de ${escapeAttr(a.name)} →">Read ${escapeHtml(a.name)} review →</a>
          </div>
          <div class="card card-pad">
            <h2 class="card-title">${escapeHtml(b.name)} snapshot</h2>
            <p class="muted"><strong>Rating:</strong> ${escapeHtml(b.ratingValue)}/5</p>
            <p class="muted"><strong>Min deposit:</strong> ${escapeHtml(b.minDeposit || 'Varies')}</p>
            <p class="muted"><strong>Platforms:</strong> ${escapeHtml((b.platforms || []).join(', ') || 'Varies')}</p>
            <p class="muted"><strong>Regulators:</strong> ${escapeHtml((b.regulators || []).join(', ') || 'Varies')}</p>
            <a class="btn-link" href="../../brokers/${b.slug}-review/" data-en="Read ${escapeAttr(b.name)} review →" data-es="Leer reseña de ${escapeAttr(b.name)} →">Read ${escapeHtml(b.name)} review →</a>
          </div>
          <div class="card card-pad">
            <h2 class="card-title">How to decide</h2>
            ${list([
              'Compare all-in cost (spread + commission + swaps) for your pairs.',
              'Verify the regulated entity and license for your country.',
              'Test withdrawals early with a small amount before scaling.',
            ])}
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-bottom">
        <p data-en="© 2026 ${escapeAttr(site.siteName)}. All rights reserved." data-es="© 2026 ${escapeAttr(site.siteName)}. Todos los derechos reservados.">© 2026 ${escapeHtml(site.siteName)}. All rights reserved.</p>
      </div>
    </div>
  </footer>

  <script src="../../translations.js"></script>
  <script src="../../app.js"></script>
</body>
</html>
`;
}

function generateForSite(site) {
  const siteBrokers = BROKERS.filter((b) => {
    const abs = path.join(ROOT, site.dir, 'brokers', `${b.slug}-review`, 'index.html');
    return fs.existsSync(abs);
  });
  const allPairs = pairs(siteBrokers);
  for (const [a, b] of allPairs) {
    const relPath = `${site.dir}/compare/${a.slug}-vs-${b.slug}/index.html`;
    const html = site.key === 'site1' ? site1ComparePage(site, a, b) : site2ComparePage(site, a, b);
    write(relPath, html);
  }
  return allPairs.length;
}

function run() {
  for (const s of SITES) {
    const n = generateForSite(s);
    // eslint-disable-next-line no-console
    console.log(`[compare] ${s.key}: generated ${n} pages`);
  }
  runSitemaps();
  runNav();
}

run();

