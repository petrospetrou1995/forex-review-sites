import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = process.argv.slice(2);
assert(files.length >= 3, 'Provide at least three independent Lighthouse JSON reports');
const reports = files.map(file => JSON.parse(fs.readFileSync(file,'utf8')));
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
  assert.equal(sorted.length, values.length,'Metrics must be present for all runs');
  return sorted[Math.floor(sorted.length/2)];
};
const score = category => median(reports.map(r => Math.round((r.categories?.[category]?.score ?? -1)*100)));
const ms = key => median(reports.map(r => r.audits?.[key]?.numericValue ?? NaN));
const result = {
  runCount:reports.length,
  testUrl:reports[0].finalUrl,
  lighthouseVersion:reports[0].lighthouseVersion,
  medianScores:{ performance:score('performance'),accessibility:score('accessibility'),bestPractices:score('best-practices'),seo:score('seo') },
  medianLabMetrics:{ LCPms:ms('largest-contentful-paint'),TBTms:ms('total-blocking-time'),CLS:ms('cumulative-layout-shift'),FCPms:ms('first-contentful-paint') },
  individualPerformanceScores:reports.map(r=>Math.round((r.categories?.performance?.score??0)*100)),
  performanceScoreRange:null,
  consistency:null,
};
const sampleScores=result.individualPerformanceScores;
const scoreRange=Math.max(...sampleScores)-Math.min(...sampleScores);
result.performanceScoreRange=scoreRange;
result.consistency=scoreRange>20?'high-variance: investigate network, main-thread or third-party timing':'within 20-point three-run spread';
console.log('LIGHTHOUSE_THREE_RUN_MEDIAN');
console.log(JSON.stringify(result,null,2));
