import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base='site1-dark-gradient';
const expected=['libertex-vs-exness','xm-group-vs-pepperstone','exness-vs-ic-markets','pepperstone-vs-ic-markets'];
for(const country of ['colombia','mexico']){
 const html=fs.readFileSync(path.join(base,'latam',country,'index.html'),'utf8');
 assert.match(html,/id="related-comparisons"/);
 for(const slug of expected){
   assert.ok(html.includes('../../compare/'+slug+'/'),country+' missing '+slug);
   assert.ok(fs.existsSync(path.join(base,'compare',slug,'index.html')),'missing comparison: '+slug);
 }
 assert.ok(html.includes('../../methodology/'));
}
console.log('Country-guide internal links target existing comparison pages.');
