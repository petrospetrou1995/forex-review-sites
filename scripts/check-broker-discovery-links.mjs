import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const slug of ['libertex','exness','pepperstone','xm-group','ic-markets']){
const html=fs.readFileSync('site1-dark-gradient/brokers/'+slug+'-review/index.html','utf8');
assert.ok(html.includes('Related comparisons and regional guides'));
for(const place of ['mexico','colombia'])assert.ok(html.includes('../../latam/'+place+'/'));
}
console.log('Five broker reviews have reciprocal discovery links');
