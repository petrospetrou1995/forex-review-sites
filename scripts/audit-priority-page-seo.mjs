import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='site1-dark-gradient';
const pages=['index.html','brokers/libertex-review/index.html','brokers/xm-group-review/index.html','brokers/exness-review/index.html','brokers/pepperstone-review/index.html','brokers/ic-markets-review/index.html','latam/colombia/index.html','latam/mexico/index.html'];
const issues=[];
for(const page of pages){
 const html=fs.readFileSync(base+'/'+page,'utf8');
 const desc=(html.match(/<meta\\s+name=["']description["'][^>]+content=["']([^"']+)/i)||[])[1];
 const title=(html.match(/<title>([^<]+)<\\/title>/i)||[])[1];
 const h1=(html.match(/<h1\\b/gi)||[]).length;
 if(!title)issues.push(page+': missing title');
 if(!desc)issues.push(page+': missing description');
 if(h1!==1)issues.push(page+': expected one h1; found '+h1);
 if(!/name=["']viewport["']/i.test(html))issues.push(page+': missing viewport');
 if(!/rel=["']canonical["']/i.test(html))issues.push(page+': missing canonical');
 const images=[...html.matchAll(/<img\\b[^>]*>/gi)];
 if(images.some(m=>!/\\balt=["'][^"']*["']/i.test(m[0])))issues.push(page+': image missing alt attribute');
}
console.log(JSON.stringify({pages:pages.length,issues},null,2));
assert.equal(issues.length,0,issues.join('\\n'));
