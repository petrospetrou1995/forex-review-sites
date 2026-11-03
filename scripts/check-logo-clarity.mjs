import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('site1-dark-gradient/index.html','utf8');
const css=fs.readFileSync('site1-dark-gradient/styles.css','utf8');
for(const [id,name] of [['libertex','Libertex'],['xm','XM'],['exness','Exness'],['pepperstone','Pepperstone']]){
  const i=html.indexOf('data-broker-id="'+id+'"');
  assert(i>=0,'Missing '+id+' broker card');
  const card=html.slice(i,html.indexOf('</button>',i));
  assert(card.includes('class="featured-broker-logo')||card.includes('featured-broker-logo '),'Missing '+name+' image');
  assert(card.includes('alt="'+name+'"'),'Missing '+name+' accessible image name');
}
for(const broker of ['Libertex','XM','Exness'])assert.ok(html.includes('class="broker-brand-wordmark broker-logo-fallback">'+broker+'</span>'));
for(const placeholder of ['libertex.webp','xm.webp','exness.webp'])assert.ok(!html.includes('assets/brokers/'+placeholder));
assert.ok(html.includes('assets/brokers/pepperstone.svg'));
assert.ok(fs.existsSync('site1-dark-gradient/assets/brokers/pepperstone.svg'));
assert.ok(css.includes('object-fit:contain'));
assert.ok(css.includes('favicon.svg'));
console.log('Broker logo clarity and site branding checks passed');
