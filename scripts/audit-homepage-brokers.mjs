/**
 * Read-only audit of editorial consistency and image references on the main site.
 * Run from repository root: node scripts/audit-homepage-brokers.mjs
 * Run after site generation. Does not make or replace regulated financial claims.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteDir = path.join(root, 'site1-dark-gradient');
const homepage = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const brokers = JSON.parse(fs.readFileSync(path.join(root, 'data/brokers-db.json'), 'utf8'));
const findings = [];
const byName = new Map(brokers.map(b => [b.slug, b]));
const cards = [...homepage.matchAll(/<div class="broker-card" data-broker-id="([^"]+)">([\s\S]*?)(?=<div class="broker-card" data-broker-id=|<\/div>\s*<\/div>\s*<p class="rating-small")/g)];

function money(value) {
  const match = String(value || '').match(/[$€£]\s*[\d,.]+/);
  return match ? match[0].replace(/\s/g, '') : null;
}
function report(type, detail) { findings.push({ type, ...detail }); }

for (const [, id, html] of cards) {
  const slug = id === 'xm' ? 'xm-group' : id;
  const broker = byName.get(slug);
  if (!broker) { report('unknown-broker', { id }); continue; }
  if (!html.includes(`brokers/${broker.slug}-review/`)) {
    report('missing-review-link', { broker: broker.broker_name });
  }
  const displayed = html.match(/<span class="info-label"[^>]*>Min Deposit<\/span>\s*<span class="info-value">([^<]*)<\/span>/);
  const expected = money(broker.minimum_deposit);
  const actual = displayed && money(displayed[1]);
  // Only flag mismatches when both sides explicitly state a monetary figure.
  if (expected && actual && expected !== actual) {
    report('minimum-deposit-mismatch', {
      broker: broker.broker_name, homepage: displayed[1], database: broker.minimum_deposit,
    });
  }
  if (/Up to 1:(?:888|2000|500)/.test(html)) {
    report('unqualified-leverage', { broker: broker.broker_name });
  }
}

// Local images can be relative to the page or absolute to the deployed site root.
for (const match of homepage.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
  const src = match[1].split(/[?#]/)[0];
  if (/^(?:https?:|data:|\/\/)/i.test(src)) continue;
  const candidate = src.startsWith('/') ? path.join(siteDir, src.slice(1)) : path.join(siteDir, src);
  if (!fs.existsSync(candidate)) report('missing-local-image', { src });
}

const result = { checkedCards: cards.length, databaseBrokers: brokers.length, findings };
console.log(JSON.stringify(result, null, 2));
if (cards.length === 0) process.exitCode = 1;
if (findings.some(f => ['missing-review-link', 'missing-local-image', 'unknown-broker'].includes(f.type))) process.exitCode = 1;
console.log('Reminder: visually verify official logo usage and check jurisdiction-specific claims at primary sources.');
