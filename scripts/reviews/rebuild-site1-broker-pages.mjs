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

function buildSummaryBlock(broker, data) {
  const agg = data.aggregate || { ratingValue: 0, reviewCount: 0, bestRating: 5 };
  const reviewCount = agg.reviewCount || 0;
  const ratingValue = reviewCount ? agg.ratingValue : 0;
  const starText = ratingValue ? stars(Math.round(ratingValue)) : '☆☆☆☆☆';

  const top = (data.reviews || []).slice(0, 3);
  const snippets = top.map((r) => {
    const src = r.sourceUrl
      ? `<a class="link-cta" href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.sourceName)}</a>`
      : escapeHtml(r.sourceName);
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
                        <span class="review-date" data-en="Source: ${escapeHtml(r.sourceName)} (licensed)" data-es="Fuente: ${escapeHtml(r.sourceName)} (licencia)">Source: ${src} (licensed)</span>
                    </div>
`.trimEnd();
  });

  const enCount = reviewCount ? `(${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})` : '(0 reviews)';
  const esCount = reviewCount ? `(${reviewCount} ${reviewCount === 1 ? 'reseña' : 'reseñas'})` : '(0 reseñas)';

  return `
                <div class="card-panel" data-licensed-reviews-summary="${escapeHtml(broker.slug)}">
                    <h2 class="subheading-card" data-en="User rating (licensed exports)" data-es="Calificación de usuarios (licencia)">User rating (licensed exports)</h2>
                    <p class="guide-text" data-en="This summary is calculated from reviews you’re licensed to republish (and/or reader submissions). It’s separate from our editorial score." data-es="Este resumen se calcula con reseñas con licencia (y/o envíos de lectores). Es independiente del puntaje editorial.">
                        This summary is calculated from reviews you’re licensed to republish (and/or reader submissions). It’s separate from our editorial score.
                    </p>
                    <div class="rating-row">
                        <span class="rating-stars-gold">${escapeHtml(starText)}</span>
                        <span class="rating-score">${escapeHtml(ratingValue ? `${ratingValue}/5` : '—')}</span>
                        <span class="rating-small" data-en="${escapeHtml(enCount)}" data-es="${escapeHtml(esCount)}">${escapeHtml(enCount)}</span>
                    </div>
                    <div class="mt-2">
                        <h3 class="criteria-label" data-en="Recent licensed snippets" data-es="Fragmentos recientes (licencia)">Recent licensed snippets</h3>
${snippets.length ? snippets.join('\n') : `                        <p class="rating-small" data-en="No licensed reviews imported yet." data-es="Aún no hay reseñas importadas con licencia.">No licensed reviews imported yet.</p>`}
                    </div>
                    <div class="link-row">
                        <a class="link-cta" href="../methodology/" data-en="Methodology &amp; sources →" data-es="Metodología y fuentes →">Methodology &amp; sources →</a>
                        <a class="link-cta" href="../reviews/submit/" data-en="Submit a review →" data-es="Enviar una reseña →">Submit a review →</a>
                    </div>
                </div>
`.trimEnd();
}

function rewriteBetweenMarkers(html, start, end, replacement) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`Missing markers: ${start} ... ${end}`);
  return html.slice(0, a + start.length) + '\n' + replacement + '\n                ' + html.slice(b);
}

function run() {
  const dataPath = 'data/reviews/normalized.json';
  const normalized = JSON.parse(readFile(dataPath));
  const brokersData = normalized.brokers || {};

  for (const broker of BROKERS) {
    const relPath = `site1-dark-gradient/brokers/${broker.slug}.html`;
    const html = readFile(relPath);
    const start = '<!-- LICENSED_USER_REVIEWS_SUMMARY_START -->';
    const end = '<!-- LICENSED_USER_REVIEWS_SUMMARY_END -->';
    const replacement = buildSummaryBlock(broker, brokersData[broker.slug] || { aggregate: { ratingValue: 0, reviewCount: 0 }, reviews: [] });
    const next = rewriteBetweenMarkers(html, start, end, replacement);
    if (next !== html) {
      writeFile(relPath, next);
      // eslint-disable-next-line no-console
      console.log(`Updated licensed review summary: ${relPath}`);
    }
  }
}

run();

