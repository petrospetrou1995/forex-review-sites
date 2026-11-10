import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const gen='scripts/generate-broker-review-pages.mjs';
execFileSync(process.execPath,['--check',gen],{stdio:'inherit'});
for(const slug of ['exness','ic-markets','libertex','pepperstone','xm-group']){
 const html=fs.readFileSync('site1-dark-gradient/brokers/'+slug+'-review/index.html','utf8');
 assert.match(html,/class="review-evidence-checklist"/);
 assert.match(html,/independently verified transaction-level testing record/);
 assert.match(html,/href="\.\.\/\.\.\/methodology\/"/);
}
assert.match(fs.readFileSync(gen,'utf8'),/class="review-evidence-checklist"/);
console.log('Review transparency checks passed');
