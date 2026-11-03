import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site1-dark-gradient/index.html', 'utf8');
const MAX_BYTES = 125 * 1024;
const counts = [
  ['DAILY_NEWS', 6],
  ['WEEKLY_NEWS', 4],
  ['RSS_NEWS', 6],
];
for (const [name, limit] of counts) {
  const start = `<!-- ${name}_START -->`;
  const end = `<!-- ${name}_END -->`;
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  assert(a !== -1 && b > a, `Missing ${name} markers`);
  const section = html.slice(a, b);
  const total = (section.match(/<article\b/g) || []).length;
  assert(total > 0 && total <= limit, `${name} contains ${total} items, expected 1-${limit}`);
  console.log(`${name}: ${total} articles (max ${limit})`);
}
assert(html.includes('href="news/daily/"'), 'Daily archive link missing');
assert(html.includes('href="news/weekly/"'), 'Weekly archive link missing');
assert(html.includes('href="news/headlines/"'), 'Headlines archive link missing');
const bytes = Buffer.byteLength(html, 'utf8');
console.log(`Homepage: ${bytes} bytes (budget ${MAX_BYTES})`);
assert(bytes <= MAX_BYTES, 'Homepage exceeds HTML byte budget');
console.log('Homepage payload and archive links validated');
