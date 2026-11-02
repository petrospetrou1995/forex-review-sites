import fs from 'node:fs';
import assert from 'node:assert/strict';
for (const [country,currency] of [['mexico','MXN'],['colombia','COP']]) {
const html=fs.readFileSync('site1-dark-gradient/latam/'+country+'/index.html','utf8');
assert.ok(html.includes(country+'-cost-checklist'));
assert.ok(html.includes('funding in '+currency));
for(const name of ['libertex','exness','pepperstone','xm-group','ic-markets']) assert.ok(html.includes('/brokers/'+name+'-review/'),country+' missing '+name);
assert.match(html,/<link rel="canonical" href="https:\/\/brokerproreviews\.com\//);
}
console.log('LATAM cost checklists present and broker links balanced');
