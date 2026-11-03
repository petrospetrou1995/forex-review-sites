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
console.log('LIGHTHOUSE_MOBILE_SUMMARY');
console.log(JSON.stringify(output, null, 2));
if (report.runtimeError) {
  console.error('Lighthouse runtime error', report.runtimeError);
  process.exitCode = 1;
}
