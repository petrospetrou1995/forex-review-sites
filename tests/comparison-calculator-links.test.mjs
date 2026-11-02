import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root='site1-dark-gradient/compare';
let checked=0;
for(const item of fs.readdirSync(root,{withFileTypes:true})){
 if(!item.isDirectory())continue;
 const file=root+'/'+item.name+'/index.html';
 if(!fs.existsSync(file))continue;
 const html=fs.readFileSync(file,'utf8');
 assert.match(html,/class="comparison-calculator-link"/,file);
 assert.match(html,/href="\.\.\/\.\.\/tools\/forex-cost-calculator\/"/,file);
 checked++;
}
assert.equal(checked,11,'expected 11 flagship comparisons');
const generator=fs.readFileSync('scripts/generate-compare-pages.mjs','utf8');
assert.match(generator,/comparison-calculator-link/);
execFileSync(process.execPath,['--check','scripts/generate-compare-pages.mjs'],{stdio:'inherit'});
console.log('All comparison pages link to the calculator');
