/**
 * Print reliable, comparable Lighthouse lab metrics from a saved mobile report.
 * Lighthouse lab metrics are not equivalent to 28-day CrUX field data.
 */
import fs from 'node:fs';
const file = process.argv[2] || 'lighthouse-mobile.json';
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const score = category => Math.round((report.categories?.[category]?.score ?? 0) * 100);
const metric = (id) => {
  const a = report.audits?.[id];
  return { display: a?.displayValue ?? 'n/a', numericValue: a?.numericValue ?? null };
};
const output = {
  testedUrl: report.finalUrl,
  fetchTime: report.fetchTime,
  lighthouseVersion: report.lighthouseVersion,
  userAgent: report.userAgent,
  formFactor: report.configSettings?.formFactor,
  scores: {
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    seo: score('seo'),
  },
  metrics: {
    FCP: metric('first-contentful-paint'),
    LCP: metric('largest-contentful-paint'),
    TBT: metric('total-blocking-time'),
    CLS: metric('cumulative-layout-shift'),
    speedIndex: metric('speed-index'),
  },
};
// Lighthouse audit details help identify layout shifts and heavy main-thread tasks.
const describeNode = item => {
  const node = item?.node || item?.element || {};
  return {
    selector: node.selector || node.snippet || node.nodeLabel || '',
    score: item?.score ?? item?.total ?? item?.wastedMs ?? null,
  };
};
const diagnostics = {};
for (const name of ['layout-shifts', 'layout-shift-elements', 'mainthread-work-breakdown', 'long-tasks', 'render-blocking-resources']) {
  const audit = report.audits?.[name];
  if (!audit) continue;
  diagnostics[name] = {
    displayValue: audit.displayValue || '',
    items: (audit.details?.items || []).slice(0, 8).map(item => ({
      ...describeNode(item),
      duration: item.duration ?? item.total ?? item.wastedMs ?? null,
      name: item.groupLabel || item.url || item.subItems?.items?.[0]?.node?.selector || '',
    })),
  };
}
console.log('LIGHTHOUSE_DIAGNOSTICS');
console.log(JSON.stringify(diagnostics, null, 2));

// Report actionable accessibility audits, not just the category score.
const failedAccessibility = (report.categories?.accessibility?.auditRefs || [])
  .filter(ref => (ref.weight || 0) > 0)
  .map(ref => ({ id: ref.id, audit: report.audits?.[ref.id] }))
  .filter(({ audit }) => audit && typeof audit.score === 'number' && audit.score < 1)
  .map(({ id, audit }) => ({
    id,
    title: audit.title,
    score: audit.score,
    nodes: (audit.details?.items || []).slice(0, 6).map(item => ({
      selector: item.node?.selector || '',
      snippet: item.node?.snippet || '',
      explanation: item.node?.explanation || '',
    })),
  }));
console.log('LIGHTHOUSE_ACCESSIBILITY_FINDINGS');
console.log(JSON.stringify(failedAccessibility, null, 2));

// Capture Lighthouse LCP candidates and failed Best Practices checks.
const lcpDetails = {};
for(const id of ['largest-contentful-paint-element','lcp-breakdown-insight','lcp-discovery-insight','network-dependency-tree-insight','font-display-insight']){
  const audit=report.audits?.[id];
  if(!audit)continue;
  lcpDetails[id]={
    score:audit.score,
    displayValue:audit.displayValue || '',
    details:(audit.details?.items || []).slice(0,6).map(item=>({
      url:item.url || '',
      node:item.node?.selector || item.node?.snippet || '',
      timing:item.timing || item.lcpBreakdown || item.duration || item.total || null,
      phase:item.phase || '',
      wastedMs:item.wastedMs ?? null
    }))
  };
}
console.log('LIGHTHOUSE_LCP_DETAILS');
console.log(JSON.stringify(lcpDetails,null,2));
const failedBestPractices=(report.categories?.['best-practices']?.auditRefs || [])
  .filter(ref=>(ref.weight||0)>0)
  .map(ref=>({id:ref.id, audit:report.audits?.[ref.id]}))
  .filter(({audit})=>audit&&typeof audit.score==='number'&&audit.score<1)
  .map(({id,audit})=>({
    id,title:audit.title,score:audit.score,description:audit.description,
    items:(audit.details?.items||[]).slice(0,6).map(item=>({
      url:item.url||'',node:item.node?.selector||item.node?.snippet||'',
      description:item.description || item.explanation || ''
    }))
  }));
console.log('LIGHTHOUSE_BEST_PRACTICES_FINDINGS');
console.log(JSON.stringify(failedBestPractices,null,2));
console.log('LIGHTHOUSE_MOBILE_SUMMARY');
console.log(JSON.stringify(output, null, 2));
if (report.runtimeError) {
  console.error('Lighthouse runtime error', report.runtimeError);
  process.exitCode = 1;
}
