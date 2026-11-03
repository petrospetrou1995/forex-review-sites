import fs from 'node:fs';
const samples={production:[],preview:[]};
for(const variant of Object.keys(samples)){
 for(let n=1;n<=3;n++)samples[variant].push(JSON.parse(fs.readFileSync(`${variant}-${n}.json`,'utf8')));
}
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
const extract=(reports,metric)=>reports.map(x=>Math.round(x.audits?.[metric]?.numericValue??NaN));
const score=r=>Math.round((r.categories?.performance?.score??0)*100);
const result=Object.fromEntries(Object.entries(samples).map(([variant,reports])=>[variant,{
  url:reports[0].finalUrl,
  scores:reports.map(score),
  scoreMedian:median(reports.map(score)),
  lcpMs:extract(reports,'largest-contentful-paint'),
  lcpMedianMs:median(extract(reports,'largest-contentful-paint')),
  tbtMs:extract(reports,'total-blocking-time'),
  tbtMedianMs:median(extract(reports,'total-blocking-time')),
  clsMedian:median(reports.map(x=>x.audits?.['cumulative-layout-shift']?.numericValue??NaN)),
}]));
console.log('PRIORITY_HINT_PREVIEW_COMPARISON');
console.log(JSON.stringify(result,null,2));
console.log('Compare cautiously: different hostnames/CDN cache states and only three runs per arm can confound outcomes; validate production after any release.');
