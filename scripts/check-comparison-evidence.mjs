import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath,['--check','scripts/generate-compare-pages.mjs'],{stdio:'inherit'});
const root='site1-dark-gradient/compare';
let count=0;
for(const d of fs.readdirSync(root,{withFileTypes:true})){
 if(!d.isDirectory())continue;
 const path=root+'/'+d.name+'/index.html';
 if(!fs.existsSync(path))continue;
 const html=fs.readFileSync(path,'utf8');
 assert.match(html,/class="comparison-evidence"/,path);
 assert.match(html,/www\.fca\.org\.uk\/firms\/financial-services-register/,path);
 assert.match(html,/www\.cysec\.gov\.cy/,path);
 assert.match(html,/Not independently verified/,path);
 count++;
}
assert.equal(count,11);
assert.match(fs.readFileSync('scripts/generate-compare-pages.mjs','utf8'),/class="comparison-evidence"/);
console.log('All 11 flagship broker comparisons include evidence checklist');
