import fs from 'node:fs';
const brokers=JSON.parse(fs.readFileSync('data/brokers-db.json','utf8'));
const evidence=JSON.parse(fs.readFileSync('data/broker-research-evidence.json','utf8'));
const bySlug=new Map(evidence.brokers.map(b=>[b.slug,b]));
const rows=brokers.map(b=>{
 const e=bySlug.get(b.slug);
 return {
  broker:b.broker_name,slug:b.slug,
  published:{rating:b.rating,spreads:b.spreads,minimum_deposit:b.minimum_deposit,regulation:b.regulation},
  researchStatus:e?.evidenceStatus||'missing',
  verifiedNumericalScore:e?.numericalScore??null,
  documentedSources:e?.sources?.length||0,
  reviewRequired:!(e?.evidenceStatus==='verified'&&e.numericalScore!==null)
 };
});
const report={generatedAt:new Date().toISOString(),scope:'Published source database values requiring factual editorial verification',count:rows.length,unverified:rows.filter(x=>x.reviewRequired).length,rows};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&report.unverified)process.exitCode=1;
