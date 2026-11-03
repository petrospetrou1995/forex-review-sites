import fs from 'node:fs';
const median = xs => xs.slice().sort((a,b)=>a-b)[1];
const samples = arm => [1,2,3].map(n => {
 const x=JSON.parse(fs.readFileSync(`${arm}-${n}.json`, 'utf8'));
 if(x.runtimeError)throw new Error(x.runtimeError.message);
 return {
  score:Math.round(x.categories.performance.score*100),
  lcp:Math.round(x.audits['largest-contentful-paint'].numericValue),
  fcp:Math.round(x.audits['first-contentful-paint'].numericValue),
  tbt:Math.round(x.audits['total-blocking-time'].numericValue),
  cls:x.audits['cumulative-layout-shift'].numericValue
 };
});
const summarize = values => ({
 scores:values.map(x=>x.score),medianScore:median(values.map(x=>x.score)),
 lcpMs:values.map(x=>x.lcp),medianLcpMs:median(values.map(x=>x.lcp)),
 medianTbtMs:median(values.map(x=>x.tbt)),
 medianCls:median(values.map(x=>x.cls))
});
const results={baseline:summarize(samples('baseline')),noBlur:summarize(samples('no-blur'))};
console.log('HERO_BLUR_EXPERIMENT');console.log(JSON.stringify(results,null,2));
console.log('These are small lab samples on localhost, not proof of a production outcome.');
