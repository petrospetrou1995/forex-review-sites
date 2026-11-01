import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('admin API endpoints use exact route comparisons',()=>{
 const source=fs.readFileSync('site1-dark-gradient/functions/api/admin/[[path]].js','utf8');
 for(const p of ['/api/admin/brokers','/api/admin/events','/api/admin/update']) assert.ok(source.includes("route==='"+p+"'"));
 assert.doesNotMatch(source,/route\.endsWith\(/);
});
test('update API rejects unknown attributes before database writes',()=>{
 const source=fs.readFileSync('site1-dark-gradient/functions/api/update.js','utf8');
 assert.match(source,/Unknown broker field/);
 assert.match(source,/return reply\(\{error:error\.message\},400\)/);
});
