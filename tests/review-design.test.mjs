import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root='site1-dark-gradient';
const groups=['brokers','compare'];
test('review and comparison pages have consistent decision context',()=>{
  let total=0;
  for(const group of groups){
    const start=path.join(root,group);
    for(const d of fs.readdirSync(start,{withFileTypes:true})){
      if(!d.isDirectory())continue;
      const target=path.join(start,d.name,'index.html');
      if(!fs.existsSync(target)) continue;
      const html=fs.readFileSync(target,'utf8');
      assert.match(html,/class="review-decision-panel"/,target);
      assert.match(html,/href="\.\.\/\.\.\/methodology\/"/,target);
      assert.match(html,/<link rel="canonical"/,target);
      total++;
    }
  }
  assert.ok(total>=15,'expected published detail pages');
});
test('generators preserve the design panels',()=>{
  for(const p of ['scripts/generate-broker-review-pages.mjs','scripts/generate-compare-pages.mjs']){
    const source=fs.readFileSync(p,'utf8');
    assert.match(source,/const TRUST_PANEL =/);
    assert.match(source,/site\.key === 'site1' \? TRUST_PANEL/);
  }
});
