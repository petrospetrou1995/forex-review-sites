import fs from 'node:fs';
import path from 'node:path';

const root='site1-dark-gradient/brokers';
const pages=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.endsWith('-review')).map(d=>path.join(root,d.name,'index.html')).filter(fs.existsSync);
const output=[];
for(const file of pages){
 const html=fs.readFileSync(file,'utf8');
 const head=(html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)||[])[1]||'';
 const text=html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 const checks={
  uniqueDescription: !!(head.match(/<meta\s+name="description"\s+content="([^"]+)"/i)||[])[1],
  canonical: /<link[^>]+rel="canonical"[^>]+href="https:\/\/brokerproreviews\.com\/brokers\/[^"]+"/i.test(head),
  methodology: /href="[^"]*methodology/i.test(html),
  explicitAffiliateDisclosure: /affiliate (?:disclosure|links?|commission)|earn (?:a )?commission|compensated for referrals/i.test(text),
  explicitRiskWarning: /risk warning|capital at risk|lose (?:all|some|money)|high risk of losing/i.test(text),
  identifiedReviewerOrEditor: /reviewed by|written by|editorial team|author/i.test(text),
  datedReview: /last (?:reviewed|updated)|dateModified|reviewed on/i.test(html),
  regulatoryEntityGuidance: /regulated entity|contracting entity|regulator|regulatory entity/i.test(text),
 };
 output.push({file,checks,missing:Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key)});
}
console.log(JSON.stringify({total:pages.length,results:output},null,2));
if(process.argv.includes('--strict')&&output.some(x=>!x.checks.canonical||!x.checks.uniqueDescription))process.exitCode=1;
