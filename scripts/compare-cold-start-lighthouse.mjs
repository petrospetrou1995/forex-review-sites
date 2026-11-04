import fs from 'node:fs';
import assert from 'node:assert/strict';
const files=process.argv.slice(2);
assert.equal(files.length,4,'Pass four chronological Lighthouse JSON files');
const samples=files.map((file,index)=>{
 const r=JSON.parse(fs.readFileSync(file,'utf8'));
 assert(!r.runtimeError,'Lighthouse failed for '+file);
 assert(r.finalUrl?.startsWith('https://brokerproreviews.com/'),'Unexpected destination: '+r.finalUrl);
 const a=r.audits;
 const metric=id=>Math.round(a[id]?.numericValue??NaN);
 const m={
  sequence:index+1,
  score:Math.round(r.categories.performance.score*100),
  lcpMs:metric('largest-contentful-paint'),
  fcpMs:metric('first-contentful-paint'),
  tbtMs:metric('total-blocking-time'),
  cls:a['cumulative-layout-shift']?.numericValue??null,
  ttfbMs:metric('server-response-time'),
  jsEvalMs:Math.round((a['mainthread-work-breakdown']?.details?.items||[]).find(x=>x.groupLabel==='Script Evaluation')?.duration??0)
 };
 assert(Number.isFinite(m.lcpMs)&&Number.isFinite(m.fcpMs)&&Number.isFinite(m.tbtMs),'Missing key performance metrics');
 return {...m,lcpAfterFirstPaintMs:m.lcpMs-m.fcpMs};
});
const later=samples.slice(1);
const median=x=>x.slice().sort((a,b)=>a-b)[Math.floor(x.length/2)];
const summary={
  samples,
  firstComparedToLaterMedian:{
    firstLcpMs:samples[0].lcpMs,
    laterMedianLcpMs:median(later.map(x=>x.lcpMs)),
    deltaLcpMs:samples[0].lcpMs-median(later.map(x=>x.lcpMs)),
    firstScore:samples[0].score,
    laterMedianScore:median(later.map(x=>x.score)),
    firstFcpMs:samples[0].fcpMs,
    laterMedianFcpMs:median(later.map(x=>x.fcpMs)),
    firstTbtMs:samples[0].tbtMs,
    laterMedianTbtMs:median(later.map(x=>x.tbtMs)),
    laterLcpRangeMs:Math.max(...later.map(x=>x.lcpMs))-Math.min(...later.map(x=>x.lcpMs))
  },
  flags:{
    firstRunSlowLcp:samples[0].lcpMs>2500 && samples[0].lcpMs-median(later.map(x=>x.lcpMs))>1000,
    firstRunHighBlocking:samples[0].tbtMs>200 && samples[0].tbtMs-median(later.map(x=>x.tbtMs))>150,
    firstRunTtfbSimilarToLater:Number.isFinite(samples[0].ttfbMs) && later.every(x=>Number.isFinite(x.ttfbMs)) && Math.abs(samples[0].ttfbMs-median(later.map(x=>x.ttfbMs)))<=200,
    interpretation:'Heuristic signals only: no proven cause, browser-cache effect, user-facing regression or live metric from four synthetic samples.'
  },
  importantLimitations:'Each invocation launches a fresh Chrome; this tests sequential CI runner/tool startup and possible CDN or scheduling effects, not browser cache warming or real-user cold navigations. Four Lighthouse lab samples cannot establish causation.'
};
fs.writeFileSync('mobile-cold-start-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('MOBILE_COLD_START_SEQUENCE');
console.log(JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const d=summary.firstComparedToLaterMedian;
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `## Cold-start Lighthouse diagnostic\n\n| Sample | Score | LCP ms | FCP ms | TBT ms |\n|---|---:|---:|---:|---:|\n${samples.map(x=>`| ${x.sequence} | ${x.score} | ${x.lcpMs} | ${x.fcpMs} | ${x.tbtMs} |`).join('\n')}\n\nFirst LCP minus subsequent median: ${d.deltaLcpMs} ms.\n\n${summary.importantLimitations}\n`);
}
