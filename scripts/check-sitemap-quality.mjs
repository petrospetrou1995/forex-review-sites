import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const file = 'scripts/generate-sitemaps.mjs';
const source = fs.readFileSync(file, 'utf8');
assert.doesNotMatch(source, /fs\.statSync|mtimeMs/, 'Sitemap must not use filesystem timestamps');
assert.match(source, /noindex/, 'Sitemap must exclude noindex pages');
execFileSync(process.execPath, ['--check',file], {stdio:'inherit'});
const sitemap = fs.readFileSync('site1-dark-gradient/sitemap.xml','utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
assert.equal(new Set(urls).size, urls.length,'Sitemap must not contain duplicate URLs');
assert.ok(urls.every(u=>u.startsWith('https://brokerproreviews.com/')));
console.log('Sitemap guardrails passed');
