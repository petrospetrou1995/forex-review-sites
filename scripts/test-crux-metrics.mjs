import assert from 'node:assert/strict';
import {normalizeMetric,classifyFieldMetrics} from './crux-metrics.mjs';

assert.equal(normalizeMetric('0.08'),0.08);
for(const value of ['', ' ', 'not-a-number', 'Infinity', -1, null, undefined, {}, []]){
  assert.equal(normalizeMetric(value),null);
}
const complete=classifyFieldMetrics({lcp:2200,inp:150,cls:'0.08'});
assert.equal(complete.fieldDataStatus,'complete');
assert.deepEqual(complete.missingMetrics,[]);
assert.equal(complete.p75.cls,0.08);
assert.equal(complete.ratings.cls,'good');
const partial=classifyFieldMetrics({lcp:3400,inp:null,cls:'0.29'});
assert.equal(partial.fieldDataStatus,'partial');
assert.deepEqual(partial.missingMetrics,['inp']);
assert.equal(partial.ratings.lcp,'needs-improvement');
assert.equal(partial.ratings.cls,'poor');
assert.equal(partial.ratings.inp,undefined);
const none=classifyFieldMetrics({lcp:undefined,inp:'',cls:'not available'});
assert.equal(none.fieldDataStatus,'unavailable');
assert.deepEqual(none.availableMetrics,[]);
console.log('CrUX normalization and partial-data tests passed');
