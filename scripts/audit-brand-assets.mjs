import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('data/broker-brand-assets.json','utf8'));
const base = 'site1-dark-gradient/';
const homepage = fs.readFileSync(base+'index.html','utf8');
assert.equal(manifest.brokers.length,5);
for(const broker of manifest.brokers){
  assert.ok(broker.officialSource.startsWith('https://'));
  if(broker.siteAsset){
    assert.ok(fs.existsSync(base+broker.siteAsset),'Missing logo: '+broker.slug);
    const asset=fs.readFileSync(base+broker.siteAsset);
    assert.ok(asset.length>200,'Empty or tiny logo: '+broker.slug);
    if(broker.siteAsset.endsWith('.svg'))assert.match(asset.toString('utf8'),/<svg\b/);
  }
}
for(const slug of ['libertex','xm','exness'])assert.ok(!homepage.includes('assets/brokers/'+slug+'.webp'),'Misleading placeholder still displayed: '+slug);
assert.ok(homepage.includes('assets/brokers/pepperstone.svg'));
const css = fs.readFileSync(base+'styles.css','utf8');
assert.ok(css.includes('object-fit:contain'));
console.log('Brand identity provenance and local asset integrity checks passed');
