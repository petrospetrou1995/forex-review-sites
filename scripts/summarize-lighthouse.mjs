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
console.log('LIGHTHOUSE_MOBILE_SUMMARY');
console.log(JSON.stringify(output, null, 2));
if (report.runtimeError) {
  console.error('Lighthouse runtime error', report.runtimeError);
  process.exitCode = 1;
}
