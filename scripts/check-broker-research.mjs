import fs from 'node:fs';
import assert from 'node:assert/strict';

const data=JSON.parse(fs.readFileSync('data/broker-research-evidence.json','utf8'));
assert.equal(data.schemaVersion,1);
assert.equal(data.criteria.reduce((sum,x)=>sum+x.weight,0),100);
assert.equal(new Set(data.criteria.map(x=>x.id)).size,data.criteria.length);
assert.equal(new Set(data.brokers.map(x=>x.slug)).size,data.brokers.length);
for(const b of data.brokers){
  assert.match(b.slug,/^[a-z0-9-]+$/);
  assert.ok(['not_verified','partial','verified'].includes(b.evidenceStatus));
  assert.ok(Array.isArray(b.sources));
  assert.ok(b.sources.every(s=>typeof s.url==='string'&&s.url.startsWith('https://')&&typeof s.checkedAt==='string'&&typeof s.claim==='string'));
  if(b.numericalScore!==null){
    assert.equal(b.evidenceStatus,'verified',b.slug+' must be verified before publishing score');
    assert.ok(b.reviewedAt&&b.reviewer&&b.entity&&b.sources.length>=2,b.slug+' requires reviewer, entity, date, and sources');
    for(const c of data.criteria)assert.ok(typeof b.criteria[c.id]==='number'&&b.criteria[c.id]>=0&&b.criteria[c.id]<=5);
    const score=data.criteria.reduce((sum,c)=>sum+b.criteria[c.id]*c.weight/100,0);
    assert.ok(Math.abs(score-b.numericalScore)<0.011,b.slug+' score must match weights');
  }
}
console.log('Research evidence gate passed; no unsupported ratings introduced.');
