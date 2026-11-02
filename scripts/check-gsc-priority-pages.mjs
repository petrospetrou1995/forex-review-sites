import fs from 'node:fs';
import assert from 'node:assert/strict';
const pages=['index.html','brokers/libertex-review/index.html','brokers/pepperstone-review/index.html','latam/colombia/index.html','latam/mexico/index.html'];
for(const page of pages){
 const s=fs.readFileSync('site1-dark-gradient/'+page,'utf8');
 const title=s.match(/<title>([^<]+)<\/title>/i)?.[1];
 const desc=s.match(/<meta name="description" content="([^"]+)"/i)?.[1];
 assert.ok(title&&title.length<=75,page+' invalid title');
 assert.ok(desc&&desc.length<=165,page+' invalid description');
 assert.match(s,/<link rel="canonical" href="https:\/\/brokerproreviews\.com\//i);
 assert.doesNotMatch(s,/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);
}
console.log('Five query-targeted pages: titles, descriptions, canonicals and indexability OK');
