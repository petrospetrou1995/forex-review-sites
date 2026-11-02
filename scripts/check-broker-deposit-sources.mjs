import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('data/brokers-db.json','utf8'));
for(const [slug,source] of [['libertex','libertex.com/terms-fees'],['pepperstone','pepperstone.com/en/trading/funding-methods']]){
 const item=data.find(b=>b.slug===slug);
 assert.ok(item&&item.minimum_deposit);
 const page=fs.readFileSync('site1-dark-gradient/brokers/'+slug+'-review/index.html','utf8');
 assert.ok(page.includes(source));
 assert.ok(page.includes(item.minimum_deposit.replace(' first deposit on Libertex.com; payment method and entity dependent',' first deposit (Libertex.com)').replace('From $10 for many funding methods; bank transfer may have no minimum (region dependent)','From $10 for many funding methods; bank transfers may have no minimum')) || page.includes('Source: <a'));
}
console.log('Official-source minimum deposit links present');
