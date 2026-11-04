import fs from 'node:fs';
const median=a=>a.slice().sort((x,y)=>x-y)[1];
const data={};
for(const arm of ['baseline','optimized']){
 const rows=[1,2,3].map(i=>{
  const report=JSON.parse(fs.readFileSync(`${arm}-${i}.json`,'utf8'));
  if(report.runtimeError)throw new Error(report.runtimeError.message);
  const audits=report.audits;
  return {score:Math.round(report.categories.performance.score*100),
   lcp:Math.round(audits['largest-contentful-paint'].numericValue),
   fcp:Math.round(audits['first-contentful-paint'].numericValue),
   tbt:Math.round(audits['total-blocking-time'].numericValue),
   cls:audits['cumulative-layout-shift'].numericValue};
 });
 data[arm]={scores:rows.map(x=>x.score),medianScore:median(rows.map(x=>x.score)),
   lcpMs:rows.map(x=>x.lcp),medianLcpMs:median(rows.map(x=>x.lcp)),
   medianTbtMs:median(rows.map(x=>x.tbt)),medianCls:median(rows.map(x=>x.cls))};
}
console.log('HOMEPAGE_INIT_EXPERIMENT');console.log(JSON.stringify(data,null,2));
console.log('Three localhost lab samples per variant; production conditions can differ.');
