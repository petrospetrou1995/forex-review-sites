import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
for(const slug of ['libertex-vs-exness','libertex-vs-ic-markets','libertex-vs-pepperstone','libertex-vs-xm-group']){
 const file='site1-dark-gradient/compare/'+slug+'/index.html';
 const html=fs.readFileSync(file,'utf8');
 for(const item of ['Libertex comparison verification','164/12','libertex.com/terms-fees','Trading costs','Regulation','Funding','Platforms'])
  assert.ok(html.includes(item),file+' missing '+item);
}
const generator=fs.readFileSync('scripts/generate-compare-pages.mjs','utf8');
assert.match(generator,/LIBERTEX_COMPARISON_PANEL/);
execFileSync(process.execPath,['--check','scripts/generate-compare-pages.mjs'],{stdio:'inherit'});
console.log('Four Libertex comparison checklists and generator verified.');
