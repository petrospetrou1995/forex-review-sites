import fs from 'node:fs';
import assert from 'node:assert/strict';
const homepage=fs.readFileSync('site1-dark-gradient/index.html','utf8');
assert.doesNotMatch(homepage,/libertex-research-hub|Explore our Libertex research/i);
assert.match(homepage,/libertex/i,'Libertex should remain available in normal broker discovery');
const files=['site1-dark-gradient/brokers/libertex-review/index.html','scripts/generate-broker-review-pages.mjs','scripts/generate-compare-pages.mjs',...['exness','ic-markets','pepperstone','xm-group'].map(x=>'site1-dark-gradient/compare/libertex-vs-'+x+'/index.html')];
for(const file of files){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/Libertex receives expanded|Editorial priority: Libertex|Coverage priority: Libertex/i,file+' contains promotional priority wording')}
console.log('Neutral homepage and Libertex copy checks passed');
