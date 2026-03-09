import fs from 'node:fs';
import path from 'node:path';
import { BROKERS } from './brokers-data.mjs';
import { runAll as runSitemaps } from './generate-sitemaps.mjs';
import { ensureBrokerFaqs } from './broker-faqs.mjs';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);

const SITES = [
  {
    key: 'site1',
    dir: 'site1-dark-gradient',
    siteName: 'BrokerProReviews',
    canonicalBase: 'https://brokerproreviews.com',
    ogImage: 'https://brokerproreviews.com/og/brokerpro.png',
  },
  {
    key: 'site2',
    dir: 'site2-minimal-light',
    siteName: 'Brokercompare',
    canonicalBase: 'https://brokerpro.pages.dev/site2-minimal-light',
    ogImage: 'https://brokerpro.pages.dev/og/brokerpro.png',
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

function jsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function canonical(site, relPretty) {
  return `${site.canonicalBase}${relPretty}`;
}

function moneyToNumber(s) {
  const t = String(s || '').replace(/,/g, '').trim();
  const m = t.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

function compareRelPath(aSlug, bSlug) {
  const ia = BROKERS.findIndex((x) => x.slug === aSlug);
  const ib = BROKERS.findIndex((x) => x.slug === bSlug);
  const first = ia !== -1 && ib !== -1 && ia <= ib ? aSlug : bSlug;
  const second = first === aSlug ? bSlug : aSlug;
  return `/compare/${first}-vs-${second}/`;
}

function scoreRelated(a, b) {
  if (!a || !b || a.slug === b.slug) return -1e9;
  const aPlat = new Set((a.platforms || []).map((x) => String(x).toLowerCase()));
  const bPlat = new Set((b.platforms || []).map((x) => String(x).toLowerCase()));
  const aRegs = new Set((a.regulators || []).map((x) => String(x).toLowerCase()));
  const bRegs = new Set((b.regulators || []).map((x) => String(x).toLowerCase()));

  let overlapPlat = 0;
  for (const p of aPlat) if (bPlat.has(p)) overlapPlat += 1;

  let overlapRegs = 0;
  for (const r of aRegs) if (bRegs.has(r)) overlapRegs += 1;

  const aMin = moneyToNumber(a.minDeposit);
  const bMin = moneyToNumber(b.minDeposit);
  const depositDistance = Number.isFinite(aMin) && Number.isFinite(bMin) ? Math.abs(aMin - bMin) : 9999;
  const depositScore = depositDistance === 0 ? 2 : depositDistance <= 50 ? 1 : depositDistance <= 200 ? 0.5 : 0;

  const ratingScore = 0.5 * (Number(a.ratingValue || 0) + Number(b.ratingValue || 0));
  return overlapPlat * 2 + overlapRegs * 1.5 + depositScore + ratingScore * 0.2;
}

function pickRelated(broker, siteBrokers, max = 3) {
  return (siteBrokers || [])
    .filter((b) => b.slug !== broker.slug)
    .map((b) => ({ b, score: scoreRelated(broker, b) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((x) => x.b);
}

function reviewJsonLd(site, broker, relPretty, ratingValue, reviewBody) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'Product',
      name: broker.name,
      image: site.ogImage,
      url: canonical(site, relPretty),
    },
    author: {
      '@type': 'Organization',
      name: site.siteName,
    },
    publisher: {
      '@type': 'Organization',
      name: site.siteName,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: String(ratingValue),
      bestRating: '5',
    },
    datePublished: TODAY,
    reviewBody,
    mainEntityOfPage: canonical(site, relPretty),
  };
}

function faqJsonLd(site, broker, relPretty) {
  const faqs = ensureBrokerFaqs(broker);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.a,
      },
    })),
    url: canonical(site, relPretty),
  };
}

function commonHead(site, title, description, canonicalUrl, ogType = 'article') {
  // Note: SEO meta tags are enforced/updated by scripts/ensure-seo-meta.mjs
  // but we still set good defaults for new pages.
  const css = site.key === 'site1' ? '../../styles.css' : '../../styles.css';
  const font = site.key === 'site1'
    ? 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
    : 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap';
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta name="theme-color" content="${site.key === 'site1' ? '#0b1220' : '#ffffff'}">
    <link rel="preload" href="${css}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${css}"></noscript>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${font}" rel="stylesheet">

    <!-- SEO:OG:START -->
    <meta property="og:type" content="${ogType}">
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

function site1Page(site, broker) {
  const siteBrokers = BROKERS.filter((b) => fs.existsSync(path.join(ROOT, site.dir, 'brokers', `${b.slug}-review`, 'index.html')));
  const related = pickRelated(broker, siteBrokers, 3);
  const faqs = ensureBrokerFaqs(broker);

  const relPretty = `/brokers/${broker.slug}-review/`;
  const canon = canonical(site, relPretty);
  const title = `${broker.name} review — fees, safety & platforms 2026 | ${site.siteName}`;
  const description = `Read our ${broker.name} review for 2026: rating, pros/cons, regulation checks, platforms, fees, and LATAM deposit/withdrawal notes. Verify the entity.`;
  const reviewBody = broker.verdict;
  const rating = broker.ratingValue;

  const compareLinks = related
    .map((rb) => {
      const rel = compareRelPath(broker.slug, rb.slug);
      const href = `../../${rel.replace(/^\//, '')}`;
      const en = `Compare ${broker.name} vs ${rb.name} (fees, platforms & safety) →`;
      const es = `Comparar ${broker.name} vs ${rb.name} (comisiones, plataformas y seguridad) →`;
      return `<li><a class="link-cta" href="${escapeAttr(href)}" data-en="${escapeAttr(en)}" data-es="${escapeAttr(es)}">${escapeHtml(en)}</a></li>`;
    })
    .join('');

  const relatedLinks = related
    .map((rb) => {
      const href = `../../brokers/${rb.slug}-review/`;
      const en = `Read ${rb.name} review (fees, platforms & safety) →`;
      const es = `Leer reseña de ${rb.name} (comisiones, plataformas y seguridad) →`;
      return `<li><a class="link-cta" href="${escapeAttr(href)}" data-en="${escapeAttr(en)}" data-es="${escapeAttr(es)}">${escapeHtml(en)}</a></li>`;
    })
    .join('');

  const sections = `
    <div class="card-panel">
      <h2 class="subheading-card" data-en="Broker overview" data-es="Resumen del broker">Broker overview</h2>
      <p class="guide-text" data-en="${escapeAttr(broker.verdict)}" data-es="${escapeAttr(broker.verdict)}">${escapeHtml(broker.verdict)}</p>
      <div class="link-row mt-4">
        <a class="link-cta" href="${escapeAttr(broker.website)}" target="_blank" rel="noopener noreferrer" data-en="Visit ${escapeAttr(broker.name)} →" data-es="Visitar ${escapeAttr(broker.name)} →">Visit ${escapeHtml(broker.name)} →</a>
      </div>
    </div>

    <div class="card-panel">
      <h2 class="subheading-card" data-en="Broker rating score" data-es="Puntuación del broker">Broker rating score</h2>
      <div class="rating-row">
        <span class="rating-stars-gold">★★★★★</span>
        <span class="rating-score">${escapeHtml(rating)}/5</span>
        <span class="rating-small" data-en="(internal score for comparison + schema)" data-es="(puntaje interno para comparación + schema)">(internal score for comparison + schema)</span>
      </div>
      <p class="rating-small" data-en="Use this score as a starting point only. Always verify the regulated entity and test withdrawals." data-es="Usa este puntaje solo como punto de partida. Verifica la entidad regulada y prueba retiros.">
        Use this score as a starting point only. Always verify the regulated entity and test withdrawals.
      </p>
    </div>

    <div class="guide-grid">
      <div class="card-panel">
        <h2 class="subheading-card" data-en="Pros" data-es="Pros">Pros</h2>
        <ul class="guide-checklist">
          ${(broker.pros || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
      <div class="card-panel">
        <h2 class="subheading-card" data-en="Cons" data-es="Contras">Cons</h2>
        <ul class="guide-checklist">
          ${(broker.cons || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="card-panel">
      <h2 class="subheading-card" data-en="Regulation and safety" data-es="Regulación y seguridad">Regulation and safety</h2>
      <p class="guide-text" data-en="Regulation varies by entity and jurisdiction. Verify the exact entity name and license status on the regulator’s official register before depositing." data-es="La regulación varía por entidad y jurisdicción. Verifica el nombre de la entidad y el estado de la licencia en el registro oficial antes de depositar.">
        Regulation varies by entity and jurisdiction. Verify the exact entity name and license status on the regulator’s official register before depositing.
      </p>
      <ul class="guide-checklist">
        <li><strong data-en="Regulators mentioned" data-es="Reguladores mencionados">Regulators mentioned</strong>: ${escapeHtml((broker.regulators || []).join(', ') || 'Varies')}</li>
        <li data-en="Confirm which entity you’re onboarding under (protections differ)." data-es="Confirma bajo qué entidad te registras (protecciones difieren).">Confirm which entity you’re onboarding under (protections differ).</li>
      </ul>
    </div>

    <div class="card-panel">
      <h2 class="subheading-card" data-en="Trading platforms" data-es="Plataformas de trading">Trading platforms</h2>
      <ul class="guide-checklist">
        ${(broker.platforms || []).map((pl) => `<li>${escapeHtml(pl)}</li>`).join('')}
      </ul>
      <p class="guide-text" data-en="Platform availability can vary by region/entity. Confirm the exact platform list in your account portal." data-es="La disponibilidad puede variar por región/entidad. Confirma la lista exacta en tu portal.">
        Platform availability can vary by region/entity. Confirm the exact platform list in your account portal.
      </p>
    </div>

    <div class="card-panel">
      <h2 class="subheading-card" data-en="Spreads and fees" data-es="Spreads y comisiones">Spreads and fees</h2>
      <ul class="guide-checklist">
        ${(broker.spreadsFees || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
      </ul>
    </div>

    <div class="card-panel">
      <h2 class="subheading-card" data-en="Deposit and withdrawal methods" data-es="Depósitos y retiros">Deposit and withdrawal methods</h2>
      <div class="guide-grid">
        <div class="card-panel">
          <h3 class="subheading-card" data-en="Deposit methods" data-es="Métodos de depósito">Deposit methods</h3>
          <ul class="guide-checklist">
            ${(
              (broker.deposit_methods || broker.depositMethods || []).length
                ? (broker.deposit_methods || broker.depositMethods || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')
                : `<li>${escapeHtml('Varies by entity/country. Confirm inside your client portal.')}</li>`
            )}
          </ul>
        </div>
        <div class="card-panel">
          <h3 class="subheading-card" data-en="Withdrawal methods" data-es="Métodos de retiro">Withdrawal methods</h3>
          <ul class="guide-checklist">
            ${(
              (broker.withdrawal_methods || broker.withdrawalMethods || []).length
                ? (broker.withdrawal_methods || broker.withdrawalMethods || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')
                : `<li>${escapeHtml('Varies by entity/country. Confirm inside your client portal.')}</li>`
            )}
          </ul>
        </div>
      </div>
      <ul class="guide-checklist">
        ${(broker.depositWithdrawals || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
      </ul>
    </div>

    <div class="guide-grid">
      <div class="card-panel">
        <h2 class="subheading-card" data-en="Minimum deposit" data-es="Depósito mínimo">Minimum deposit</h2>
        <p class="guide-text"><strong>${escapeHtml(broker.minDeposit || 'Varies')}</strong></p>
        <p class="rating-small" data-en="Treat minimum deposit as a starting point; confirm by entity and method." data-es="Tómalo como referencia; confirma por entidad y método.">
          Treat minimum deposit as a starting point; confirm by entity and method.
        </p>
      </div>
      <div class="card-panel">
        <h2 class="subheading-card" data-en="Countries accepted" data-es="Países aceptados">Countries accepted</h2>
        <ul class="guide-checklist">
          ${(broker.countriesAccepted || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="card-panel guide-related">
      <h2 class="subheading-card" data-en="FAQ" data-es="FAQ">FAQ</h2>
      <ul class="guide-related-list">
        ${faqs.map((f) => (
          `<li><strong>${escapeHtml(f.q)}</strong><br><span class="rating-small">${escapeHtml(f.a)}</span></li>`
        )).join('')}
      </ul>
    </div>

    <div class="card-panel">
      <h2 class="subheading-card" data-en="Final verdict" data-es="Veredicto final">Final verdict</h2>
      <p class="guide-text">${escapeHtml(broker.verdict)}</p>
    </div>

    <div class="guide-grid">
      <div class="card-panel">
        <h2 class="subheading-card" data-en="Compare ${escapeAttr(broker.name)}" data-es="Comparar ${escapeAttr(broker.name)}">Compare ${escapeHtml(broker.name)}</h2>
        <p class="rating-small" data-en="Side-by-side pages help you compare fees, platforms, and safety checks." data-es="Las comparaciones ayudan a revisar comisiones, plataformas y seguridad.">
          Side-by-side pages help you compare fees, platforms, and safety checks.
        </p>
        <ul class="guide-related-list">
          ${compareLinks || `<li class="rating-small" data-en="More comparisons coming soon." data-es="Más comparaciones pronto.">More comparisons coming soon.</li>`}
        </ul>
      </div>
      <div class="card-panel">
        <h2 class="subheading-card" data-en="Related brokers" data-es="Brokers relacionados">Related brokers</h2>
        <p class="rating-small" data-en="Similar platform and regulation footprints (always verify your entity)." data-es="Plataformas y regulación similares (verifica tu entidad).">
          Similar platform and regulation footprints (always verify your entity).
        </p>
        <ul class="guide-related-list">
          ${relatedLinks || `<li class="rating-small" data-en="Browse all reviews from the homepage." data-es="Ver todas las reseñas desde la página principal.">Browse all reviews from the homepage.</li>`}
        </ul>
      </div>
    </div>
  `.trim();

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.canonicalBase}/` },
      { '@type': 'ListItem', position: 2, name: 'Brokers', item: `${site.canonicalBase}/#reviews` },
      { '@type': 'ListItem', position: 3, name: `${broker.name} review`, item: canon },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
${commonHead(site, title, description, canon, 'article')}
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
            <a class="guide-back link-cta" href="../../reviews/" data-en="← Back to reviews" data-es="← Volver a reseñas">← Back to reviews</a>
            <button class="lang-toggle" id="langToggle" type="button">ES</button>
          </div>
        </div>
      </div>
    </nav>
  </header>

  <main class="section-pad section-pad-dark">
    <div class="container">
      <article class="guide-article">
        <h1 class="guide-title" data-en="${escapeAttr(broker.name)} review (2026)" data-es="Reseña de ${escapeAttr(broker.name)} (2026)">${escapeHtml(broker.name)} review (2026)</h1>
        <p class="guide-lead" data-en="Practical review sections: rating, pros/cons, regulation, platforms, fees, and LATAM deposits/withdrawals. Always verify the entity for your country." data-es="Secciones prácticas: puntuación, pros/contras, regulación, plataformas, comisiones y pagos en LATAM. Verifica la entidad para tu país.">
          Practical review sections: rating, pros/cons, regulation, platforms, fees, and LATAM deposits/withdrawals. Always verify the entity for your country.
        </p>

        ${sections}
      </article>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-bottom">
        <p>&copy; 2026 ${escapeHtml(site.siteName)}. <a class="link-cta" href="../../methodology/" data-en="Methodology" data-es="Metodología">Methodology</a></p>
      </div>
    </div>
  </footer>

  <script src="../../translations.js"></script>
  <script src="../../app.js"></script>

  <script type="application/ld+json">
${jsonLd(breadcrumb)}
  </script>
  <script type="application/ld+json">
${jsonLd(reviewJsonLd(site, broker, relPretty, rating, reviewBody))}
  </script>
  <script type="application/ld+json">
${jsonLd(faqJsonLd(site, broker, relPretty))}
  </script>
</body>
</html>
`;
}

function site2Page(site, broker) {
  const siteBrokers = BROKERS.filter((b) => fs.existsSync(path.join(ROOT, site.dir, 'brokers', `${b.slug}-review`, 'index.html')));
  const related = pickRelated(broker, siteBrokers, 3);
  const faqs = ensureBrokerFaqs(broker);

  const relPretty = `/brokers/${broker.slug}-review/`;
  const canon = canonical(site, relPretty);
  const title = `${broker.name} review — fees, safety & platforms 2026 | ${site.siteName}`;
  const description = `Read our ${broker.name} review for 2026: rating, pros/cons, regulation checks, platforms, fees, deposits/withdrawals, and key FAQs. Verify entity.`;
  const reviewBody = broker.verdict;
  const rating = broker.ratingValue;

  const cardList = (items) => `<ul>${(items || []).map((x) => `<li class="muted">${escapeHtml(x)}</li>`).join('')}</ul>`;

  const relatedList = (items) => {
    const lis = (items || [])
      .map((rb) => {
        const href = `../../brokers/${rb.slug}-review/`;
        const en = `Read ${rb.name} review (fees, platforms & safety) →`;
        const es = `Leer reseña de ${rb.name} (comisiones, plataformas y seguridad) →`;
        return `<li class="muted"><a class="btn-link" href="${escapeAttr(href)}" data-en="${escapeAttr(en)}" data-es="${escapeAttr(es)}">${escapeHtml(en)}</a></li>`;
      })
      .join('');
    return `<ul>${lis}</ul>`;
  };

  const compareList = (items) => {
    const lis = (items || [])
      .map((rb) => {
        const rel = compareRelPath(broker.slug, rb.slug);
        const href = `../../${rel.replace(/^\//, '')}`;
        const en = `Compare ${broker.name} vs ${rb.name} (fees, platforms & safety) →`;
        const es = `Comparar ${broker.name} vs ${rb.name} (comisiones, plataformas y seguridad) →`;
        return `<li class="muted"><a class="btn-link" href="${escapeAttr(href)}" data-en="${escapeAttr(en)}" data-es="${escapeAttr(es)}">${escapeHtml(en)}</a></li>`;
      })
      .join('');
    return `<ul>${lis}</ul>`;
  };

  const overview = `
    <div class="link-row">
      <a class="btn-inline" href="../../index.html#brokers" data-en="← Back to broker list" data-es="← Volver a la lista de brokers">← Back to broker list</a>
      <a class="btn-inline" href="${escapeAttr(broker.website)}" target="_blank" rel="noopener noreferrer" data-en="Visit ${escapeAttr(broker.name)}" data-es="Visitar ${escapeAttr(broker.name)}">Visit ${escapeHtml(broker.name)}</a>
    </div>

    <h1 class="section-heading-md" data-en="${escapeAttr(broker.name)} review" data-es="Reseña de ${escapeAttr(broker.name)}">${escapeHtml(broker.name)} review</h1>
    <p class="section-lead section-lead-narrow" data-en="${escapeAttr(broker.verdict)}" data-es="${escapeAttr(broker.verdict)}">${escapeHtml(broker.verdict)}</p>
  `.trim();

  const layout = `
    <div class="grid grid-3">
      <div class="card card-pad">
        <h2 class="card-title" data-en="Broker overview" data-es="Resumen del broker">Broker overview</h2>
        <p class="muted" data-en="${escapeAttr(broker.verdict)}" data-es="${escapeAttr(broker.verdict)}">${escapeHtml(broker.verdict)}</p>
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Broker rating score" data-es="Puntuación del broker">Broker rating score</h2>
        <p class="label mt-3" data-en="Internal rating (comparison + schema)" data-es="Puntaje interno (comparación + schema)">Internal rating (comparison + schema)</p>
        <span class="rating">${escapeHtml(rating)}/5</span>
        <p class="muted small" data-en="Use as a starting point only—verify entity, costs, and withdrawals." data-es="Solo como referencia—verifica entidad, costos y retiros.">Use as a starting point only—verify entity, costs, and withdrawals.</p>
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Minimum deposit" data-es="Depósito mínimo">Minimum deposit</h2>
        <p class="muted"><strong>${escapeHtml(broker.minDeposit || 'Varies')}</strong></p>
        <p class="muted small" data-en="Confirm by entity and funding method." data-es="Confirma por entidad y método.">Confirm by entity and funding method.</p>
      </div>
    </div>

    <div class="grid grid-3 mt-3">
      <div class="card card-pad">
        <h2 class="card-title" data-en="Pros" data-es="Pros">Pros</h2>
        ${cardList(broker.pros)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Cons" data-es="Contras">Cons</h2>
        ${cardList(broker.cons)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Regulation and safety" data-es="Regulación y seguridad">Regulation and safety</h2>
        <p class="muted" data-en="Verify the exact entity and license on the official register. Protections vary by jurisdiction." data-es="Verifica la entidad y licencia en el registro oficial. Protecciones varían por jurisdicción.">Verify the exact entity and license on the official register. Protections vary by jurisdiction.</p>
        <p class="muted small"><strong data-en="Regulators mentioned" data-es="Reguladores mencionados">Regulators mentioned</strong>: ${escapeHtml((broker.regulators || []).join(', ') || 'Varies')}</p>
      </div>
    </div>

    <div class="grid grid-3 mt-3">
      <div class="card card-pad">
        <h2 class="card-title" data-en="Trading platforms" data-es="Plataformas de trading">Trading platforms</h2>
        ${cardList(broker.platforms)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Spreads and fees" data-es="Spreads y comisiones">Spreads and fees</h2>
        ${cardList(broker.spreadsFees)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Deposits and withdrawals" data-es="Depósitos y retiros">Deposits and withdrawals</h2>
        <div class="grid grid-2">
          <div class="card card-pad">
            <h3 class="card-title" data-en="Deposit methods" data-es="Métodos de depósito">Deposit methods</h3>
            ${cardList((broker.deposit_methods || broker.depositMethods || []).length ? (broker.deposit_methods || broker.depositMethods) : ['Varies by entity/country. Confirm inside your client portal.'])}
          </div>
          <div class="card card-pad">
            <h3 class="card-title" data-en="Withdrawal methods" data-es="Métodos de retiro">Withdrawal methods</h3>
            ${cardList((broker.withdrawal_methods || broker.withdrawalMethods || []).length ? (broker.withdrawal_methods || broker.withdrawalMethods) : ['Varies by entity/country. Confirm inside your client portal.'])}
          </div>
        </div>
        ${cardList(broker.depositWithdrawals)}
      </div>
    </div>

    <div class="grid grid-3 mt-3">
      <div class="card card-pad">
        <h2 class="card-title" data-en="Countries accepted" data-es="Países aceptados">Countries accepted</h2>
        ${cardList(broker.countriesAccepted)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="FAQ" data-es="FAQ">FAQ</h2>
        <ul>
          ${faqs.map((f) => `
            <li class="muted">
              <strong>${escapeHtml(f.q)}</strong><br>
              <span>${escapeHtml(f.a)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Final verdict" data-es="Veredicto final">Final verdict</h2>
        <p class="muted">${escapeHtml(broker.verdict)}</p>
      </div>
    </div>

    <div class="grid grid-3 mt-3">
      <div class="card card-pad">
        <h2 class="card-title" data-en="Compare ${escapeAttr(broker.name)}" data-es="Comparar ${escapeAttr(broker.name)}">Compare ${escapeHtml(broker.name)}</h2>
        <p class="muted small" data-en="Use side-by-side comparisons to shortlist brokers by costs, platforms, and safety checks." data-es="Usa comparaciones para filtrar brokers por costos, plataformas y seguridad.">Use side-by-side comparisons to shortlist brokers by costs, platforms, and safety checks.</p>
        ${compareList(related)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Related brokers" data-es="Brokers relacionados">Related brokers</h2>
        <p class="muted small" data-en="Similar platform/regulation footprints (always verify your entity)." data-es="Plataformas/regulación similares (verifica tu entidad).">Similar platform/regulation footprints (always verify your entity).</p>
        ${relatedList(related)}
      </div>
      <div class="card card-pad">
        <h2 class="card-title" data-en="Explore" data-es="Explorar">Explore</h2>
        <ul>
          <li class="muted"><a class="btn-link" href="../../compare/" data-en="Browse all comparisons →" data-es="Ver comparaciones →">Browse all comparisons →</a></li>
          <li class="muted"><a class="btn-link" href="../../reviews/" data-en="Browse all reviews →" data-es="Ver reseñas →">Browse all reviews →</a></li>
        </ul>
      </div>
    </div>
  `.trim();

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.canonicalBase}/` },
      { '@type': 'ListItem', position: 2, name: 'Brokers', item: `${site.canonicalBase}/index.html#brokers` },
      { '@type': 'ListItem', position: 3, name: `${broker.name} review`, item: canon },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
${commonHead(site, title, description, canon, 'article')}
</head>
<body>
  <header class="header">
    <div class="container">
      <nav class="navbar">
        <a class="logo" href="../../index.html">${escapeHtml(site.siteName)}</a>
        <ul class="nav-links" id="primaryNav">
          <li><a href="../../reviews/" data-en="Reviews" data-es="Reseñas">Reviews</a></li>
          <li><a href="../../compare/" data-en="Compare" data-es="Comparar">Compare</a></li>
          <li><a href="../../strategies/" data-en="Strategies" data-es="Estrategias">Strategies</a></li>
          <li><a href="../../learn/" data-en="Learn" data-es="Aprender">Learn</a></li>
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
        ${overview}
        ${layout}
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

  <script type="application/ld+json">
${jsonLd(breadcrumb)}
  </script>
  <script type="application/ld+json">
${jsonLd(reviewJsonLd(site, broker, relPretty, rating, reviewBody))}
  </script>
  <script type="application/ld+json">
${jsonLd(faqJsonLd(site, broker, relPretty))}
  </script>
</body>
</html>
`;
}

function ensureBrokerPagesForSite(site) {
  const siteAbs = path.join(ROOT, site.dir);
  const destRoot = path.join(siteAbs, 'brokers');
  if (!fs.existsSync(destRoot)) return { site: site.key, generated: 0 };

  // Generate pages for all known brokers (plus ensure ic-markets exists everywhere).
  const list = BROKERS;
  let generated = 0;

  for (const b of list) {
    const relPath = `${site.dir}/brokers/${b.slug}-review/index.html`;
    const html = site.key === 'site1' ? site1Page(site, b) : site2Page(site, b);
    write(relPath, html);
    generated += 1;
  }
  return { site: site.key, generated };
}

function run() {
  const results = SITES.map(ensureBrokerPagesForSite);
  // eslint-disable-next-line no-console
  results.forEach((r) => console.log(`[broker-template] ${r.site}: generated ${r.generated}`));
  runSitemaps();
}

run();

