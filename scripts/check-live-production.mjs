import assert from 'node:assert/strict';
const origin=process.env.SITE_ORIGIN || 'https://brokerproreviews.com';
const paths=['/','/brokers/libertex-review/','/brokers/exness-review/','/brokers/pepperstone-review/','/brokers/xm-group-review/','/brokers/ic-markets-review/','/latam/mexico/','/latam/colombia/','/methodology/','/sitemap.xml','/robots.txt'];
const findings=[];
const results=[];
for(const path of paths){
 const url=origin+path;
 try{
  const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'BrokerProReviews-ProductionSmoke/1.0'}});
  const body=await response.text();
  results.push({path,status:response.status,contentType:response.headers.get('content-type')});
  if(!response.ok){findings.push(path+': HTTP '+response.status);continue}
  if(path.endsWith('.xml')){if(!body.includes('<urlset'))findings.push(path+': unexpected sitemap content');continue}
  if(path.endsWith('.txt')){if(!body.includes('Sitemap:'))findings.push(path+': missing sitemap directive');continue}
  const expected=origin+path;
  const canonical=body.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
  if(canonical!==expected)findings.push(path+': canonical '+(canonical||'missing')+' != '+expected);
  if(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(body))findings.push(path+': unexpectedly noindex');
  if(!/<h1\\b/i.test(body))findings.push(path+': missing H1');
 }catch(err){findings.push(path+': '+err.message)}
}
const report={testedAt:new Date().toISOString(),origin,results,findings};
console.log(JSON.stringify(report,null,2));
assert.equal(findings.length,0,findings.join('\\n'));
