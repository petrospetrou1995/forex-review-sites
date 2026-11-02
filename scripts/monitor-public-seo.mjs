import fs from 'node:fs';
import assert from 'node:assert/strict';

const base='site1-dark-gradient';
const host='https://brokerproreviews.com';
const sitemap=fs.readFileSync(base+'/sitemap.xml','utf8');
const robots=fs.readFileSync(base+'/robots.txt','utf8');
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
const failures=[];
function check(ok,message){if(!ok)failures.push(message)}
check(robots.includes('Sitemap: '+host+'/sitemap.xml'),'robots.txt sitemap URL mismatch');
check(urls.length>0,'empty sitemap');
check(urls.length===new Set(urls).size,'duplicate sitemap URLs');
for(const url of urls){
 let u;try{u=new URL(url)}catch{failures.push('malformed sitemap URL: '+url);continue}
 check(u.origin===host,'wrong host: '+url);
 const rel=decodeURIComponent(u.pathname).replace(/^\/|\/$/g,'');
 const file=base+(rel?'/'+rel:'')+'/index.html';
 if(!fs.existsSync(file)){failures.push('missing page: '+url);continue}
 const html=fs.readFileSync(file,'utf8');
 const canonical=(html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)||[])[1];
 check(canonical===url,'canonical mismatch: '+url);
 const noindex=/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
 check(!noindex,'noindex page in sitemap: '+url);
}
const report={checkedAt:new Date().toISOString(),sitemapCount:urls.length,errors:failures.length,examples:failures.slice(0,30)};
console.log(JSON.stringify(report,null,2));
assert.equal(failures.length,0,failures.slice(0,10).join('\n'));
