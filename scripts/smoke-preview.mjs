// Safe read-only smoke checks. Never writes broker data.
import { strict as assert } from 'node:assert';
const origin=process.env.PREVIEW_ORIGIN;
if(!origin) throw new Error('Set PREVIEW_ORIGIN to a Cloudflare Pages preview URL');
const base=new URL(origin);
if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||!base.hostname.endsWith('.pages.dev')) throw new Error('A non-production HTTPS *.pages.dev preview origin is required');
async function check(path){
 const url=new URL(path,base);
 assert.equal(url.origin,base.origin);
 const res=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000)});
 return res;
}
const results=[];
const homepage=await check('/');
assert.equal(homepage.status,200,'homepage returns HTTP 200');
const html=await homepage.text();
assert.match(html,/<link rel="canonical"/i);
assert.match(html,/<main[^>]*>/i);
results.push('Homepage HTTP 200 + canonical + main');
const robots=await check('/robots.txt');
assert.equal(robots.status,200,'robots HTTP 200');
results.push('robots.txt HTTP 200');
for(const path of ['/admin/','/api/admin/brokers','/api/admin/events']){
 const res=await check(path);
 assert.ok([302,303,307,308,401,403].includes(res.status),'Protected endpoint '+path+' unexpectedly returned '+res.status);
 results.push(path+' denied or redirected unauthenticated ('+res.status+')');
}
const api=await check('/api/brokers');
assert.ok([200,503].includes(api.status),'Unexpected public broker API status: '+api.status);
results.push('Broker API responds '+api.status);
console.log(results.join('\n'));
