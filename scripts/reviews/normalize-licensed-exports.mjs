import fs from 'node:fs';
import path from 'node:path';
import { BROKERS, isKnownBrokerSlug } from './reviews.config.mjs';

const ROOT = process.cwd();

function readJson(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(absPath, data) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function listJsonFiles(dirAbs) {
  if (!fs.existsSync(dirAbs)) return [];
  return fs.readdirSync(dirAbs)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => path.join(dirAbs, f));
}

function toYyyyMmDd(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    // Already date-only
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // ISO datetime
    const m = value.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (m) return m[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function clampRating(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(1, Math.min(5, Math.round(x)));
}

function anonymizeAuthor(author) {
  if (!author || typeof author !== 'string') return 'User';
  const trimmed = author.trim();
  if (!trimmed) return 'User';
  // "Maria Lopez" => "Maria L."
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return `${parts[0].slice(0, 1).toUpperCase()}${parts[0].slice(1, 20)}`;
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].slice(0, 1).toUpperCase();
  return `${first} ${lastInitial}.`;
}

function normalizeItem(item, fallbackSourceName) {
  const brokerSlug = item.brokerSlug || item.broker || item.broker_id;
  if (!brokerSlug || !isKnownBrokerSlug(brokerSlug)) return null;

  const rating = clampRating(item.rating ?? item.stars ?? item.score);
  const text = String(item.text ?? item.body ?? item.comment ?? '').trim();
  const date = toYyyyMmDd(item.date ?? item.createdAt ?? item.publishedAt);
  if (!rating || !text || !date) return null;

  const sourceName = String(item.sourceName ?? item.source ?? fallbackSourceName ?? 'Licensed export').trim() || 'Licensed export';
  const sourceUrl = item.sourceUrl ? String(item.sourceUrl).trim() : '';

  return {
    brokerSlug,
    rating,
    text,
    date,
    authorDisplay: anonymizeAuthor(item.author ?? item.reviewer ?? item.user),
    sourceName,
    sourceUrl,
    locale: (item.locale ? String(item.locale) : 'en'),
    country: (item.country ? String(item.country) : ''),
  };
}

function aggregateForBroker(reviews) {
  const reviewCount = reviews.length;
  const avg = reviewCount
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount)
    : 0;
  const ratingValue = Math.round(avg * 10) / 10;
  return { ratingValue, reviewCount, bestRating: 5 };
}

function run() {
  const exportsDir = path.join(ROOT, 'data/reviews/exports');
  const outFile = path.join(ROOT, 'data/reviews/normalized.json');
  const files = listJsonFiles(exportsDir);

  const byBroker = Object.fromEntries(BROKERS.map((b) => [b.slug, []]));

  for (const absPath of files) {
    const base = path.basename(absPath, '.json');
    const json = readJson(absPath);
    if (!Array.isArray(json)) continue;

    for (const item of json) {
      const n = normalizeItem(item, base);
      if (!n) continue;
      byBroker[n.brokerSlug].push(n);
    }
  }

  // Sort by newest first, de-dupe very simply by (authorDisplay+date+text)
  for (const slug of Object.keys(byBroker)) {
    const seen = new Set();
    const cleaned = [];
    for (const r of byBroker[slug]) {
      const key = `${r.authorDisplay}|${r.date}|${r.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(r);
    }
    cleaned.sort((a, b) => (a.date < b.date ? 1 : -1));
    byBroker[slug] = cleaned;
  }

  const normalized = {
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    brokers: Object.fromEntries(
      BROKERS.map((b) => [
        b.slug,
        {
          name: b.name,
          aggregate: aggregateForBroker(byBroker[b.slug]),
          reviews: byBroker[b.slug],
        },
      ]),
    ),
  };

  writeJson(outFile, normalized);
  // eslint-disable-next-line no-console
  console.log(`Normalized reviews written: ${path.relative(ROOT, outFile)} (files=${files.length})`);
}

run();

