import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBroker, authorized } from '../site1-dark-gradient/functions/api/_shared.js';
import { onRequestPost } from '../site1-dark-gradient/functions/api/update.js';
import { onRequestGet } from '../site1-dark-gradient/functions/api/brokers.js';

test('validates broker attributes', () => {
  assert.equal(validateBroker({ id:'broker_1',name:'Broker',rating:4.2 }).name,'Broker');
  assert.throws(()=>validateBroker({id:'x',name:'A',rating:10}),/rating/);
  assert.throws(()=>validateBroker({id:'x',name:'A',evil:'injected'}),/Unknown/);
  assert.throws(()=>validateBroker({id:'x',name:'A',spreads:{EURUSD:-1}}),/spreads/);
});
test('rejects missing or incorrect secrets', async () => {
  const env={BROKER_ADMIN_API_KEY:'a'.repeat(40)};
  assert.equal(await authorized(new Request('https://example.com',{headers:{'X-API-Key':'b'.repeat(40)}}),env),false);
  assert.equal(await authorized(new Request('https://example.com'),env),false);
  assert.equal(await authorized(new Request('https://example.com',{headers:{'X-API-Key':'a'.repeat(40)}}),env),true);
});
test('write requests fail closed without D1',async()=>{
  const response=await onRequestPost({request:new Request('https://example.com/api/update',{method:'POST'}),env:{}});
  assert.equal(response.status,503);
});
test('public reads fail closed without D1',async()=>{
  const response=await onRequestGet({request:new Request('https://example.com/api/brokers'),env:{}});
  assert.equal(response.status,503);
});
test('write requests reject unauthorized callers',async()=>{
  const response=await onRequestPost({request:new Request('https://example.com/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env:{BROKERS_DB:{prepare(){}},BROKER_ADMIN_API_KEY:'a'.repeat(40)}});
  assert.equal(response.status,401);
});
