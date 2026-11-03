/**
 * Compare the slowest and fastest of three existing Lighthouse reports.
 * Uses diagnostic timing from the same Lighthouse runs, with no additional
 * production network requests, tracking, or site changes.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const paths = process.argv.slice(2);
assert(paths.length >= 3, 'Provide at least three Lighthouse JSON reports');
const reports = paths.map(path => ({path, report: JSON.parse(fs.readFileSync(path, 'utf8'))}));
const auditNumber = (r, id) => r.audits?.[id]?.numericValue ?? null;
const resources = r => r.audits?.['network-requests']?.details?.items ?? [];
const round = n => Number.isFinite(n) ? Math.round(n) : null;
const origin = url => { try { return new URL(url).origin; } catch { return 'unknown'; } };
const pct = n => Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
const rows = reports.map(({path, report:r}) => {
  assert(!r.runtimeError, path + ': Lighthouse runtimeError');
  const reqs = resources(r);
  const byOrigin = Object.values(Object.groupBy(reqs, q => origin(q.url || '')))
    .map(items => ({
      origin: origin(items[0]?.url),
      count: items.length,
      transferKB:round(items.reduce((n,x) => n + (x.transferSize || 0), 0) / 1024),
      latestEndMs:round(Math.max(...items.map(x => x.endTime || 0))),
    })).sort((a,b) => (b.latestEndMs || 0) - (a.latestEndMs || 0)).slice(0, 12);
  const slowRequests = reqs
    .map(q => ({url:q.url || '', type:q.resourceType || '', status:q.statusCode ?? null,
      durationMs:round((q.endTime ?? NaN) - (q.startTime ?? NaN)),
      startMs:round(q.startTime), endMs:round(q.endTime),
      transferKB:round((q.transferSize || 0)/1024)}))
    .sort((a,b) => (b.durationMs || 0) - (a.durationMs || 0)).slice(0, 12);
  const element = r.audits?.['largest-contentful-paint-element'];
  return {
    path, score:round((r.categories?.performance?.score ?? 0) * 100),
    LCPms:round(auditNumber(r,'largest-contentful-paint')),
    FCPms:round(auditNumber(r,'first-contentful-paint')),
    TBTms:round(auditNumber(r,'total-blocking-time')),
    TTFBms:round(auditNumber(r,'server-response-time')),
    CLS:pct(auditNumber(r,'cumulative-layout-shift')),
    totalNetworkRequests:reqs.length,
    lcpElement:(element?.details?.items || []).slice(0,3).map(i => ({
      selector:i.node?.selector || i.node?.snippet || i.node?.nodeLabel || '',
      url:i.url || '',
      outerHTML:i.node?.snippet?.slice(0,220) || ''
    })),
    slowRequests, byOrigin
  };
});
rows.sort((a,b) => b.LCPms - a.LCPms);
const worst=rows[0],best=rows[rows.length-1];
const output={
  slowest:worst,
  fastest:best,
  others:rows.slice(1,-1).map(({path,score,LCPms,FCPms,TBTms,TTFBms,CLS})=>({path,score,LCPms,FCPms,TBTms,TTFBms,CLS})),
  difference:{lcpMs:worst.LCPms-best.LCPms, fcpMs:worst.FCPms-best.FCPms,
    tbtMs:worst.TBTms-best.TBTms,
    ttfbMs:worst.TTFBms===null || best.TTFBms===null?null:worst.TTFBms-best.TTFBms},
  caveat:'Simulated lab samples, not 28-day real-user Core Web Vitals; network timings and CDN conditions can vary.',
};
console.log('LIGHTHOUSE_SLOW_VS_FAST_DIAGNOSTICS');
console.log(JSON.stringify(output,null,2));
fs.writeFileSync('lighthouse-slow-fast-diagnostics.json',JSON.stringify(output,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY) {
 const short = x=>`Score ${x.score}; LCP ${x.LCPms}ms; FCP ${x.FCPms}ms; TBT ${x.TBTms}ms; server-response ${x.TTFBms ?? 'n/a'}ms`;
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `## Lighthouse slowest vs fastest\n\n- Slowest: ${short(worst)}\n- Fastest: ${short(best)}\n- LCP gap: ${output.difference.lcpMs}ms\n- See artifact for origins, request durations and LCP candidates.\n\n${output.caveat}\n`);
}
