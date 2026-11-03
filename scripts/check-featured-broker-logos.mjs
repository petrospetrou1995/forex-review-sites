import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('site1-dark-gradient/index.html','utf8');
const entries = [...html.matchAll(/<div class="broker-card" data-broker-id="([^"]+)">([\s\S]*?)(?=<div class="broker-card" data-broker-id=|<\/div>\s*<\/div>\s*<p class="rating-small")/g)];
assert.equal(entries.length,4,'Expect four featured broker cards');
for(const [,id,card] of entries){
 const m=card.match(/<img[^>]+class="[^"]*featured-broker-logo[^"]*"[^>]+src="([^"]+)"/);
 assert(m, id+' has no logo img');
 const url=m[1];
 if(url.startsWith('.')){
   assert(fs.existsSync('site1-dark-gradient/'+url.replace(/^\.\//,'')),id+' local logo missing');
   console.log(id+': self-hosted logo present');
   continue;
 }
 assert(url.startsWith('https://'),id+' logo must use HTTPS');
 try {
   const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0 (compatible; BrokerProReviewsAssetChecker/1.0)'}});
   console.log(id+': '+res.status+' '+(res.headers.get('content-type')||'unknown')+' '+res.url);
   assert(res.ok,id+' image request failed');
   assert(/image\//i.test(res.headers.get('content-type')||''),id+' response not an image');
 } catch(err) {
   console.error(id+': '+err.message);
   process.exitCode=1;
 }
}
