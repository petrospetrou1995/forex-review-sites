import fs from 'node:fs';
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
const result={};
for(const arm of ['baseline','flat']){
 const samples=[1,2,3].map(i=>{
  const r=JSON.parse(fs.readFileSync(`${arm}-${i}.json`,'utf8'));
  if(r.runtimeError)throw Error(r.runtimeError.message);
  return {
    score:Math.round(r.categories.performance.score*100),
    lcpMs:Math.round(r.audits['largest-contentful-paint'].numericValue),
    fcpMs:Math.round(r.audits['first-contentful-paint'].numericValue),
    tbtMs:Math.round(r.audits['total-blocking-time'].numericValue),
    cls:r.audits['cumulative-layout-shift'].numericValue
  };
 });
 result[arm]={
  scores:samples.map(x=>x.score),
  medianScore:median(samples.map(x=>x.score)),
  lcpMs:samples.map(x=>x.lcpMs),
  medianLcpMs:median(samples.map(x=>x.lcpMs)),
  lcpMinusFcpMs:samples.map(x=>x.lcpMs-x.fcpMs),
  medianGapMs:median(samples.map(x=>x.lcpMs-x.fcpMs)),
  medianTbtMs:median(samples.map(x=>x.tbtMs))
 };
}
console.log('HERO_LCP_PAINT_ISOLATION');
console.log(JSON.stringify(result,null,2));
console.log('Test-only flat heading changes visual design and is not intended for automatic production release. Three samples per condition cannot establish causality.');
