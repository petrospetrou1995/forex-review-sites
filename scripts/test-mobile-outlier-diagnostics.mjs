import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bpr-lighthouse-'));
const summary=path.resolve('scripts/median-lighthouse.mjs');
try{
 const reports=[5000,2100,2150].map((lcp,i)=>({
  finalUrl:'https://brokerproreviews.com/',
  lighthouseVersion:'12.8.2',
  categories:Object.fromEntries(['performance','accessibility','best-practices','seo'].map(k=>[k,{score:k==='performance'?(i===0?0.65:0.98):1}])),
  audits:{
   'largest-contentful-paint':{numericValue:lcp},
   'first-contentful-paint':{numericValue:1800+i*50},
   'total-blocking-time':{numericValue:100+i*20},
   'cumulative-layout-shift':{numericValue:0},
   'network-requests':{details:{items:[{url:'https://www.google-analytics.com/g/collect?cid=PRIVATE-CID&sid=SECRET',networkEndTime:400,networkRequestTime:200,transferSize:500,resourceType:'Other'}]}},
   'largest-contentful-paint-element':{details:{items:[{node:{selector:'h1.hero-title'}}]}},
   'mainthread-work-breakdown':{details:{items:[{groupLabel:'Script Evaluation',duration:700-i*200}]}},
   'bootup-time':{details:{items:[{url:'https://www.googletagmanager.com/gtag/js?id=TRACKING-SECRET',total:450,scripting:320,scriptParseCompile:60}]}},
   'long-tasks':{details:{items:[{url:'https://brokerproreviews.com/translations.js?token=SECRET',duration:91,startTime:255}]}},
  }
 }));
 const files=reports.map((report,i)=>{const file=path.join(directory,'sample-'+i+'.json');fs.writeFileSync(file,JSON.stringify(report));return file;});
 const result=spawnSync(process.execPath,[summary,...files],{cwd:directory,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const out=fs.readFileSync(path.join(directory,'mobile-outlier-diagnostics.json'),'utf8');
 assert(!out.includes('PRIVATE-CID')&&!out.includes('TRACKING-SECRET')&&!out.includes('token=SECRET'),'Query parameter leaked to artifact');
 const json=JSON.parse(out);
 assert.equal(json.slowest.lcpMs,5000);
 assert.equal(json.mainThreadComparison.slowest.mainThreadGroups[0].group,'Script Evaluation');
 assert.equal(json.mainThreadComparison.slowest.scriptExecution[0].script,'https://www.googletagmanager.com/gtag/js');
 assert.equal(json.mainThreadComparison.slowest.longTasks[0].script,'https://brokerproreviews.com/translations.js');
 assert.equal(json.slowestNetworkRequests[0].url,'https://www.google-analytics.com/g/collect');
 console.log('Mobile outlier main-thread comparison and URL redaction test passed');
} finally {
 fs.rmSync(directory,{recursive:true,force:true});
}
