import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='site1-dark-gradient';
const manifest=JSON.parse(fs.readFileSync('data/broker-brand-assets.json','utf8'));
assert.equal(manifest.brokers.length,5);
const home=fs.readFileSync(root+'/index.html','utf8');
assert.match(home,/id="research-pathways"/);
for(const broker of manifest.brokers){
  const target='/brokers/'+broker.slug+'-review/';
  assert.ok(home.includes(target),'Homepage missing '+target);
  assert.ok(fs.existsSync(root+target+'index.html'),'Missing review '+target);
}
const ic=fs.readFileSync(root+'/brokers/ic-markets-review/index.html','utf8');
assert.match(ic,/licence <strong>362\/18<\/strong>/);
assert.match(ic,/cysec.gov.cy\/en-GB\/entities\/investment-firms\/cypriot\/80418/);
for(const page of ['index.html',...manifest.brokers.map(b=>'brokers/'+b.slug+'-review/index.html')]){
  const html=fs.readFileSync(root+'/'+page,'utf8');
  assert.ok(/name="viewport"/i.test(html),page+' missing mobile viewport');
  assert.ok(/rel="canonical"/i.test(html),page+' missing canonical');
  assert.equal((html.match(/<h1\b/gi)||[]).length,1,page+' H1 count');
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    assert.match(m[0],/\balt=/i,page+' image missing alt');
    const src=m[0].match(/\bsrc=["']([^"']+)/i)?.[1];
    if(src?.startsWith('./')||src?.startsWith('../')) {
      const url=new URL(src,'https://brokerproreviews.com/'+page.replace(/index\.html$/,''));
      const asset=root+decodeURIComponent(url.pathname);
      assert.ok(fs.existsSync(asset),page+' missing image '+asset);
    }
  }
}
const css=fs.readFileSync(root+'/styles.css','utf8');
assert.ok(css.includes('object-fit:contain'),'Logo styling should contain rather than crop');
console.log('Five-broker paths, legal source, mobile viewport, image references and accessibility checks passed');
