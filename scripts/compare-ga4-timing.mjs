import fs from 'node:fs';
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
const results={};
for(const arm of ['baseline','delayed']){
 const samples=[1,2,3].map(n=>{
  const r=JSON.parse(fs.readFileSync(`${arm}-${n}.json`,'utf8'));
  if(r.runtimeError)throw Error(r.runtimeError.message);
  const req=r.audits?.['network-requests']?.details?.items||[];
  return {
   score:Math.round(r.categories.performance.score*100),
   lcpMs:Math.round(r.audits['largest-contentful-paint'].numericValue),
   fcpMs:Math.round(r.audits['first-contentful-paint'].numericValue),
   tbtMs:Math.round(r.audits['total-blocking-time'].numericValue),
   cls:r.audits['cumulative-layout-shift'].numericValue,
   gaScriptFetched:req.some(q=>q.url?.includes('googletagmanager.com/gtag/js')),
   gaScriptBootupMs:Math.round((r.audits['bootup-time']?.details?.items||[]).filter(x=>x.url?.includes('googletagmanager.com/gtag/js')).reduce((a,x)=>a+(x.total||0),0)),
   gaLongTasksMs:Math.round((r.audits['long-tasks']?.details?.items||[]).filter(x=>x.url?.includes('googletagmanager.com/gtag/js')).reduce((a,x)=>a+(x.duration||0),0))
  };
 });
 results[arm]={
  score:samples.map(x=>x.score),medianScore:median(samples.map(x=>x.score)),
  lcp:samples.map(x=>x.lcpMs),medianLcpMs:median(samples.map(x=>x.lcpMs)),
  tbt:samples.map(x=>x.tbtMs),medianTbtMs:median(samples.map(x=>x.tbtMs)),
  gaScriptFetched:samples.map(x=>x.gaScriptFetched),
  gaScriptBootupMs:samples.map(x=>x.gaScriptBootupMs),
  gaLongTasksMs:samples.map(x=>x.gaLongTasksMs)
 };
}
console.log('GA4_TIMING_EXPERIMENT');
console.log(JSON.stringify(results,null,2));
console.log('Diagnostic only; delayed GA4 may miss short visits, even when Lighthouse improves. Do not deploy without analytics coverage verification.');
