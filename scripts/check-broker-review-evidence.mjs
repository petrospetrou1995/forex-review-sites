import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const slug of ['exness','libertex','xm-group','pepperstone','ic-markets']){
 const file='site1-dark-gradient/brokers/'+slug+'-review/index.html';
 const html=fs.readFileSync(file,'utf8');
 assert.match(html,new RegExp('id="research-checklist-'+slug+'"'));
 for(const term of ['Legal entity and oversight','Real trading costs','Deposits and withdrawals','Independent verification','review methodology'])
  assert.ok(html.includes(term),file+' missing '+term);
 assert.match(html,/rel="canonical" href="https:\/\/brokerproreviews\.com\//);
}
console.log('All five broker review verification sections present.');
