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


// Preserve the worst sample rather than hiding intermittent regressions behind a median.
const samples=reports.map((r,i)=>({
  run:i+1,
  performance:Math.round((r.categories?.performance?.score??0)*100),
  lcpMs:Math.round(r.audits?.['largest-contentful-paint']?.numericValue??NaN),
  tbtMs:Math.round(r.audits?.['total-blocking-time']?.numericValue??NaN),
  fcpMs:Math.round(r.audits?.['first-contentful-paint']?.numericValue??NaN),
  cls:r.audits?.['cumulative-layout-shift']?.numericValue??null,
}));
for(const sample of samples) {
  assert(Number.isFinite(sample.lcpMs)&&Number.isFinite(sample.fcpMs)&&Number.isFinite(sample.tbtMs),
    'Lighthouse diagnostics must be numeric for every sample');
}
const slowest=samples.slice().sort((a,b)=>b.lcpMs-a.lcpMs)[0];
const worstScore=samples.slice().sort((a,b)=>a.performance-b.performance)[0];
const thresholdBreaches={
  anyLcpOver4000ms:samples.some(x=>x.lcpMs>4000),
  anyPerformanceBelow80:samples.some(x=>x.performance<80),
  twoOrMoreLcpOver2500ms:samples.filter(x=>x.lcpMs>2500).length>=2,
  highScoreVariance:scoreRange>20
};
const relevant=reports[slowest.run-1];
const reqs=relevant.audits?.['network-requests']?.details?.items||[];
// Exclude URL query strings and fragments: analytics URLs can contain client/session identifiers.
const publicUrl=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return '';}};
const requestOrigin=url=>{try{return new URL(url).origin;}catch{return 'unknown';}};
const topSlowRequests=reqs.map(x=>({
  origin:requestOrigin(x.url||''),
  url:publicUrl(x.url),
  resourceType:x.resourceType||'',
  durationMs:Math.round((x.networkEndTime??NaN)-(x.networkRequestTime??NaN)),
  transferBytes:x.transferSize??null
})).filter(x=>Number.isFinite(x.durationMs)).sort((a,b)=>b.durationMs-a.durationMs).slice(0,8);
const lcpDetail=relevant.audits?.['largest-contentful-paint-element']?.details?.items?.[0];

// Extract JavaScript activity from the *same* Lighthouse reports; avoid unstable raw traces.
const finite=n=>Number.isFinite(n)?Math.round(n):null;
const extractMainThread=r=>{
  const groups=(r.audits?.['mainthread-work-breakdown']?.details?.items||[])
    .map(x=>({group:x.groupLabel||x.group||'other',durationMs:finite(x.duration)}))
    .filter(x=>x.durationMs!==null).sort((a,b)=>b.durationMs-a.durationMs);
  const boot=(r.audits?.['bootup-time']?.details?.items||[])
    .map(x=>({script:publicUrl(x.url),totalMs:finite(x.total),scriptingMs:finite(x.scripting),parseMs:finite(x.scriptParseCompile)}))
    .filter(x=>x.script && x.totalMs!==null).sort((a,b)=>b.totalMs-a.totalMs).slice(0,10);
  const tasks=(r.audits?.['long-tasks']?.details?.items||[])
    .map(x=>({script:publicUrl(x.url),durationMs:finite(x.duration),startMs:finite(x.startTime)}))
    .filter(x=>x.durationMs!==null).sort((a,b)=>b.durationMs-a.durationMs).slice(0,8);
  return {mainThreadGroups:groups,scriptExecution:boot,longTasks:tasks};
};
const mainThreadByRun=reports.map((r,i)=>({run:i+1,...extractMainThread(r)}));
const bestLcp=samples.slice().sort((a,b)=>a.lcpMs-b.lcpMs)[0];
const worstBlocking=samples.slice().sort((a,b)=>b.tbtMs-a.tbtMs)[0];
const mainThreadComparison={
  slowestLcpRun:slowest.run,
  fastestLcpRun:bestLcp.run,
  worstBlockingRun:worstBlocking.run,
  slowestLcp:mainThreadByRun[slowest.run-1],
  fastestLcp:mainThreadByRun[bestLcp.run-1],
  worstBlocking:mainThreadByRun[worstBlocking.run-1],
  note:'Lighthouse main-thread totals cover the audit window and need not overlap with the heading LCP. High TBT and delayed LCP are distinct symptoms.'
};
const detail={
  sampledAt:new Date().toISOString(),
  testUrl:relevant.finalUrl,
  samples,
  medianScore:result.medianScores.performance,
  scoreRange,
  lcpToFcpGapMsByRun:samples.map(x=>({run:x.run,gapMs:x.lcpMs-x.fcpMs})),
  slowest,
  worstScore,
  thresholdBreaches,
  slowestLcpElement:lcpDetail?.node?.selector||lcpDetail?.items?.[0]?.node?.selector||null,
  slowestNetworkRequests:topSlowRequests,
  mainThreadComparison
};
fs.writeFileSync('mobile-outlier-diagnostics.json',JSON.stringify(detail,null,2)+'\n');
console.log('LIGHTHOUSE_OUTLIER_DIAGNOSTICS');
console.log(JSON.stringify(detail,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const status=Object.values(thresholdBreaches).some(Boolean)?'Needs attention':'Within configured monitoring thresholds';
 const table=['| Run | Performance | LCP (ms) | TBT (ms) |','|---|---:|---:|---:|',
   ...samples.map(x=>`| ${x.run} | ${x.performance} | ${x.lcpMs} | ${x.tbtMs} |`)].join('\n');
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 `## BrokerProReviews mobile Lighthouse monitoring\n\n**${status}** — median ${detail.medianScore}, worst ${worstScore.performance}, spread ${scoreRange} points.\n\n${table}\n\nFlags: ${Object.entries(thresholdBreaches).filter(([,v])=>v).map(([k])=>k).join(', ')||'none'}.\n\nThis is synthetic lab sampling, not real-user CrUX. The JSON artifact includes redacted network paths and JavaScript main-thread attribution.\n`);
 if(Object.values(thresholdBreaches).some(Boolean))console.log('::warning::Mobile Lighthouse outlier threshold breached. Inspect mobile-outlier-diagnostics.json artifact.');
}
