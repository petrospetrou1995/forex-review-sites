import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const script=path.resolve('scripts/compare-cold-start-lighthouse.mjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bpr-cold-start-'));
try {
  const run=(lcps,tbts,ttfbs)=>{
    const files=lcps.map((lcp,i)=>{
      const file=path.join(dir,'run-'+i+'.json');
      fs.writeFileSync(file,JSON.stringify({
        finalUrl:'https://brokerproreviews.com/',
        categories:{performance:{score:.9}},
        audits:{
          'largest-contentful-paint':{numericValue:lcp},
          'first-contentful-paint':{numericValue:1900},
          'total-blocking-time':{numericValue:tbts[i]},
          'cumulative-layout-shift':{numericValue:0},
          'server-response-time':{numericValue:ttfbs[i]},
          'mainthread-work-breakdown':{details:{items:[]}}
        }
      }));
      return file;
    });
    const result=spawnSync(process.execPath,[script,...files],{cwd:dir,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(fs.readFileSync(path.join(dir,'mobile-cold-start-summary.json'),'utf8'));
  };
  const outlier=run([4683,2131,2093,2157],[564,95,82,80],[93,89,73,80]);
  assert.equal(outlier.flags.firstRunSlowLcp,true);
  assert.equal(outlier.flags.firstRunHighBlocking,true);
  assert.equal(outlier.flags.firstRunTtfbSimilarToLater,true);
  assert.equal(outlier.firstComparedToLaterMedian.deltaLcpMs,2552);
  const normal=run([2210,2130,2100,2140],[90,85,80,83],[300,85,75,80]);
  assert.equal(normal.flags.firstRunSlowLcp,false);
  assert.equal(normal.flags.firstRunHighBlocking,false);
  assert.equal(normal.flags.firstRunTtfbSimilarToLater,false);
  console.log('Cold-start classification tests passed');
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
