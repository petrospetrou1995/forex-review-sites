import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync('site1-dark-gradient/styles.css','utf8');
const data=JSON.parse(fs.readFileSync('data/broker-brand-assets.json','utf8'));
for(const item of ['object-fit:contain','overflow-wrap:anywhere','max-width:480px'])assert.ok(css.includes(item));
assert.equal(data.reviewPolicy.exnessFullLogotypeMinimumPx,60);
assert.equal(data.brokers.length,5);
console.log('Responsive brand display and documented size constraints verified');
