import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const page=fs.readFileSync('site1-dark-gradient/brokers/libertex-review/index.html','utf8');
const generator=fs.readFileSync('scripts/generate-broker-review-pages.mjs','utf8');
for (const phrase of ['libertex-verified-context','164/12','libertex.com/terms-fees','compare/libertex-vs-exness','compare/libertex-vs-ic-markets','compare/libertex-vs-pepperstone','compare/libertex-vs-xm-group'])
 assert.ok(page.includes(phrase),'missing on review: '+phrase);
assert.match(generator,/LIBERTEX_RESEARCH_PANEL/);
assert.match(generator,/broker\.slug === 'libertex'/);
execFileSync(process.execPath,['--check','scripts/generate-broker-review-pages.mjs'],{stdio:'inherit'});
console.log('Libertex review source and regeneration checks passed');
