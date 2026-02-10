import fs from 'node:fs';
import path from 'node:path';
import { BROKERS } from './reviews.config.mjs';

const ROOT = process.cwd();

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeFile(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stars(rating) {
  const n = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

function buildReviewCard(r) {
  const source = r.sourceUrl
    ? `<a class="link-cta" href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.sourceName)}</a>`
    : escapeHtml(r.sourceName);

  // We keep both languages identical unless you provide translated exports later.
  const text = escapeHtml(r.text);
  return `
                            <div class="review-card">
                                <div class="review-header">
                                    <span class="review-name">${escapeHtml(r.authorDisplay || 'User')}</span>
                                    <span class="rating-stars-gold">${escapeHtml(stars(r.rating))}</span>
                                </div>
                                <p class="review-text" data-en="${text}" data-es="${text}">
                                    ${text}
                                </p>
                                <time class="review-date" datetime="${escapeHtml(r.date)}">${escapeHtml(r.date)}</time>
                                <span class="review-date" data-en="Source: ${escapeHtml(r.sourceName)} (licensed)" data-es="Fuente: ${escapeHtml(r.sourceName)} (licencia)">Source: ${source} (licensed)</span>
                            </div>
`.trimEnd();
}

function buildBrokerPanel(broker, data) {
  const agg = data.aggregate || { ratingValue: 0, reviewCount: 0, bestRating: 5 };
  const ratingValue = agg.reviewCount ? agg.ratingValue : 0;
  const reviewCount = agg.reviewCount || 0;
  const starText = ratingValue ? stars(Math.round(ratingValue)) : '☆☆☆☆☆';

  const cards = (data.reviews || []).slice(0, 5).map(buildReviewCard);
  const showMore = (data.reviews || []).length > 2;
  const cardsWithHide = cards.map((html, idx) => {
    if (idx < 2) return html;
    return html.replace('class="review-card"', 'class="review-card is-hidden"');
  });

  const reviewCountLabelEn = `(${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`;
  const reviewCountLabelEs = `(${reviewCount} ${reviewCount === 1 ? 'reseña' : 'reseñas'})`;

  return `
                    <div class="card-panel" data-licensed-reviews-broker="${escapeHtml(broker.slug)}">
                        <div class="card-header-flex">
                            <div class="badge-logo">
                                <img class="broker-logo-img" src="${escapeHtml(broker.logoUrl)}" alt="${escapeHtml(broker.name)} logo" width="48" height="48" loading="lazy" decoding="async">
                            </div>
                            <div>
                                <h4 class="card-heading-sm">${escapeHtml(broker.name)}</h4>
                                <div class="rating-row">
                                    <span class="rating-stars-gold">${escapeHtml(starText)}</span>
                                    <span class="rating-score">${escapeHtml(ratingValue ? `${ratingValue}/5` : '—')}</span>
                                    <span class="rating-small review-count" data-en="${escapeHtml(reviewCountLabelEn)}" data-es="${escapeHtml(reviewCountLabelEs)}">${escapeHtml(reviewCountLabelEn)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="mt-2">
                            <h5 class="block-title" data-en="User Reviews (licensed)" data-es="Reseñas (licencia)">User Reviews (licensed)</h5>
${cardsWithHide.length ? cardsWithHide.join('\n') : `                            <p class="rating-small" data-en="No licensed reviews imported yet." data-es="Aún no hay reseñas importadas con licencia.">No licensed reviews imported yet.</p>`}
${showMore ? `                            <div class="reviews-actions">
                                <button class="btn-more" type="button" data-review-toggle data-en="View more reviews" data-es="Ver más reseñas">View more reviews</button>
                            </div>` : ''}
                        </div>
                    </div>
`.trimEnd();
}

function run() {
  const dataPath = 'data/reviews/normalized.json';
  const indexPath = 'site1-dark-gradient/index.html';

  const normalized = JSON.parse(readFile(dataPath));
  const brokersData = normalized.brokers || {};

  const indexHtml = readFile(indexPath);
  const start = '<!-- LICENSED_REVIEWS_BLOCK_START -->';
  const end = '<!-- LICENSED_REVIEWS_BLOCK_END -->';
  const a = indexHtml.indexOf(start);
  const b = indexHtml.indexOf(end);
  if (a === -1 || b === -1 || b < a) {
    throw new Error('Missing licensed review markers in site1 index.html');
  }

  const before = indexHtml.slice(0, a + start.length);
  const after = indexHtml.slice(b);

  const blockHeader = `
                    <h3 class="section-subheading" data-en="Detailed Broker Reviews" data-es="Reseñas Detalladas de Brokers">Detailed Broker Reviews</h3>
                    <p class="rating-small" data-en="These review snippets are imported from licensed exports and/or reader submissions. Always verify the broker entity on official registers." data-es="Estos fragmentos se importan de exports con licencia y/o envíos de lectores. Verifica la entidad en registros oficiales.">These review snippets are imported from licensed exports and/or reader submissions. Always verify the broker entity on official registers.</p>
`.trim();

  const panels = BROKERS.map((broker) => buildBrokerPanel(broker, brokersData[broker.slug] || { aggregate: { ratingValue: 0, reviewCount: 0 }, reviews: [] }));
  const rebuilt = `\n${blockHeader}\n\n${panels.join('\n\n')}\n`;

  const nextHtml = before + rebuilt + after;
  if (nextHtml !== indexHtml) {
    writeFile(indexPath, nextHtml);
    // eslint-disable-next-line no-console
    console.log(`Rebuilt licensed reviews block in ${indexPath}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('No changes to site1 index.html');
  }
}

run();

