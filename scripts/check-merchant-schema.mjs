import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='site1-dark-gradient';
let count=0;
for (const section of ['brokers','compare']) {
 for (const d of fs.readdirSync(root+'/'+section,{withFileTypes:true})) {
  if (!d.isDirectory()) continue;
  const path=root+'/'+section+'/'+d.name+'/index.html';
  if(!fs.existsSync(path)) continue;
  scan(path); count++;
 }
}
scan(root+'/index.html');
function scan(file){
 const html=fs.readFileSync(file,'utf8');
 for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
  const nodes=[];function visit(x){if(!x||typeof x!=='object')return;nodes.push(x);Object.values(x).forEach(visit)}
  visit(JSON.parse(m[1]));
  assert.equal(nodes.some(x=>x['@type']==='Product'||x['@type']==='Offer'||x['@type']==='AggregateRating'),false,file);
 }
}
const robots=fs.readFileSync(root+'/robots.txt','utf8');
assert.match(robots,/Sitemap: https:\/\/brokerproreviews\.com\/sitemap\.xml/);
const gen=fs.readFileSync('scripts/ensure-structured-data.mjs','utf8');
assert.doesNotMatch(gen,/'@type': 'Product'/);
console.log('SEO merchant markup check passed for '+(count+1)+' pages');
