import fs from 'node:fs';

const variants = [
  ['baseline', ['baseline-1.json','baseline-2.json']],
  ['without-analytics', ['without-analytics-1.json','without-analytics-2.json']],
  ['without-google-fonts', ['without-google-fonts-1.json','without-google-fonts-2.json']],
];
const median2 = nums => nums.reduce((a,b)=>a+b,0)/nums.length;
const rows = variants.map(([variant,paths])=>{
  const reports=paths.map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
  for(const r of reports) {
    if(r.runtimeError) throw new Error(variant+': Lighthouse runtime error '+r.runtimeError.message);
    if(r.finalUrl && !r.finalUrl.startsWith('https://brokerproreviews.com/')) throw new Error('Unexpected URL '+r.finalUrl);
  }
  const metric=id=>reports.map(r=>Math.round(r.audits[id]?.numericValue||0));
  const score=reports.map(r=>Math.round((r.categories.performance.score||0)*100));
  return {
    variant, performanceScores:score, scoreAverage:median2(score),
    LCPms:metric('largest-contentful-paint'), FCPms:metric('first-contentful-paint'),
    TBTms:metric('total-blocking-time'), CLS:reports.map(r=>r.audits['cumulative-layout-shift']?.numericValue??null),
    LCPmeanMs:median2(metric('largest-contentful-paint')),
    TBTmeanMs:median2(metric('total-blocking-time')),
    blockedPatterns:reports[0].configSettings?.blockedUrlPatterns||[],
  };
});
console.log('LIGHTHOUSE_CONTROLLED_EXPERIMENT');
console.log(JSON.stringify(rows,null,2));
console.log('NOTE: Blocking URLs is diagnostic only; no production analytics/font changes were made. Two samples per arm and variable lab conditions do not establish causation.');
