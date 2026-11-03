import fs from 'node:fs';
const rows={external:[],local:[]};
for(const variant of Object.keys(rows)) {
  for(let i=1;i<=3;i++){
    const x=JSON.parse(fs.readFileSync(`${variant}-${i}.json`,'utf8'));
    if(x.runtimeError) throw Error('Lighthouse failed for '+variant+' '+i);
    const a=x.audits;
    rows[variant].push({
      score:Math.round(x.categories.performance.score*100),
      lcpMs:Math.round(a['largest-contentful-paint'].numericValue),
      fcpMs:Math.round(a['first-contentful-paint'].numericValue),
      tbtMs:Math.round(a['total-blocking-time'].numericValue),
      cls:a['cumulative-layout-shift'].numericValue,
      fonts:(a['network-requests']?.details?.items||[])
        .filter(q=>q.resourceType==='Font'||q.url?.includes('fonts.googleapis.com'))
        .map(q=>q.url),
    });
  }
}
const median=xs=>xs.slice().sort((a,b)=>a-b)[1];
const summary=Object.fromEntries(Object.entries(rows).map(([name,reports])=>[name,{
  scores:reports.map(x=>x.score),
  medianScore:median(reports.map(x=>x.score)),
  lcpMs:reports.map(x=>x.lcpMs),
  medianLCPms:median(reports.map(x=>x.lcpMs)),
  medianFCPms:median(reports.map(x=>x.fcpMs)),
  medianTBTms:median(reports.map(x=>x.tbtMs)),
  fonts:reports.map(x=>x.fonts),
}]));
if(rows.local.some(x=>x.fonts.some(u=>u.includes('fonts.googleapis.com')||u.includes('fonts.gstatic.com')))) {
 throw Error('Local Inter variant unexpectedly depends on Google Fonts');
}
if(rows.local.some(x=>!x.fonts.some(u=>u.includes('/assets/fonts/inter-latin-variable.woff2')))) {
 throw Error('Local Inter font was not fetched');
}
console.log('MATCHED_CONTENT_INTER_FONT_COMPARISON');
console.log(JSON.stringify(summary,null,2));
console.log('Simulated local-origin data. Does not prove Cloudflare production improvement.');
