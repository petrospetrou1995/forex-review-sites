import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const [country,authority] of [['mexico','condusef.gob.mx'],['colombia','superfinanciera.gov.co']]){
 const html=fs.readFileSync('site1-dark-gradient/latam/'+country+'/index.html','utf8');
 assert.ok(html.includes(country+'-official-risk'));
 assert.ok(html.includes(authority));
 assert.ok(html.includes('Regulatory requirements and guidance can change'));
 assert.doesNotMatch(html,/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i);
}
console.log('Primary source sections and canonical indexability verified');
