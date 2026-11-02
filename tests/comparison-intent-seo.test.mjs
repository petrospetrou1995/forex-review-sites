import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir='site1-dark-gradient/compare';
let count=0;
const titles=new Set();
for(const d of fs.readdirSync(dir,{withFileTypes:true})){
 if(!d.isDirectory())continue;
 const path=dir+'/'+d.name+'/index.html';if(!fs.existsSync(path))continue;
 const html=fs.readFileSync(path,'utf8');
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1]||'';
 const desc=html.match(/<meta name="description" content="([^"]*)"/)?.[1]||'';
 assert.match(title,/vs .*Spreads, Fees & Regulation/);
 assert.match(desc,/spread and commission assumptions/);
 assert.match(html,/<h1 class="guide-title">[^<]*Fees, Regulation and Platforms<\/h1>/);
 assert.ok(!titles.has(title),'duplicate title '+title);titles.add(title);
 count++;
}
assert.equal(count,11);
execFileSync(process.execPath,['--check','scripts/generate-compare-pages.mjs'],{stdio:'inherit'});
console.log('Comparison SEO metadata verified for',count,'pages');
