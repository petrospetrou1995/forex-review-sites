/**
 * Editorial audit for displayed homepage broker facts and logo assets.
 * Run: node scripts/audit-homepage-brokers.mjs
 * Audit only: this intentionally does not rewrite financial claims.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFile = path.join(root, 'site1-dark-gradient/index.html');
const dbFile = path.join(root, 'data/brokers-db.json');
const html = fs.readFileSync(htmlFile, 'utf8');
const brokers = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
const findings = [];

function textValue(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function firstMoney(s) {
  const m = String(s).match(/(?:[$€£])\s*[\d,.]+/);
  return m?.[0]?.replace(/\s+/g, '') ?? null;
}
for (const broker of brokers) {
  const index = html.indexOf(`brokers/${broker.slug}-review/`);
  if (index < 0) {
    findings.push({ broker: broker.broker_name, type: 'review-link', issue: 'Review link not found on homepage' });
    continue;
  }
  const vicinity = html.slice(Math.max(0, index - 3000), index + 500);
  const name = broker.broker_name === 'XM Group' ? 'XM' : broker.broker_name;
  const cardStart = vicinity.lastIndexOf('class="broker-card');
  const card = cardStart >= 0 ? vicinity.slice(cardStart) : vicinity;
  const cardText = textValue(card);
  const amount = firstMoney(broker.minimum_deposit);
  if (amount && !cardText.includes(amount)) {
    findings.push({ broker: name, type: 'minimum-deposit', issue: 'Homepage and broker database may disagree', database: broker.minimum_deposit, cardExcerpt: cardText.slice(-450) });
  }
}
const imgTag = /<img\b[^>]*>/gi;
for (const match of html.matchAll(imgTag)) {
  const tag = match[0];
  const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!src || /^(?:https?:|data:|\/\/)/i.test(src)) continue;
  const file = path.resolve(path.dirname(htmlFile), src.split(/[?#]/)[0].replace(/^\//, ''));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    findings.push({ type: 'logo-or-image', issue: 'Referenced local image missing or requires deployment-root check', src });
  }
}
console.log(JSON.stringify({ checkedBrokers: brokers.length, findings }, null, 2));
console.log('\nEditorial follow-up: verify entity-specific leverage, spreads, commissions, deposits and rating methodology against dated primary sources; confirm logo usage rights and visual quality manually.');
// Informational report, not a deployment blocker, until data and jurisdiction are verified.
