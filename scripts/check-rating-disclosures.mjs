import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const slug of ['libertex','xm-group','exness','pepperstone','ic-markets']){
 const html=fs.readFileSync('site1-dark-gradient/brokers/'+slug+'-review/index.html','utf8');
 assert.ok(html.includes('(provisional editorial rating; not independently validated)'));
 assert.ok(!html.includes('(internal score for comparison + schema)'));
}
const script=fs.readFileSync('scripts/generate-broker-review-pages.mjs','utf8');
assert.ok(script.includes('(provisional editorial rating; not independently validated)'));
console.log('All five provisional-rating labels verified');
