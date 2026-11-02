import fs from 'node:fs';
import path from 'node:path';
const root='site1-dark-gradient/news';
const pages=[];
function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,d.name);if(d.isDirectory())walk(f);else if(d.name==='index.html')pages.push(f)}}
walk(root);
const groups=new Map(),issues=[];
function attr(html,name){return (html.match(new RegExp('<meta[^>]+name=["\\x27]'+name+'["\\x27][^>]+content=["\\x27]([^"\\x27]*)','i'))||[])[1]||''}
for(const file of pages){
 const html=fs.readFileSync(file,'utf8');
 const title=(html.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'';
 const desc=attr(html,'description').trim();
 const canonical=(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)||[])[1]||'';
 const robots=attr(html,'robots');
 const sourceLinks=(html.match(/<a[^>]+href=["']https?:\/\/(?!brokerproreviews\.com)[^"']+/gi)||[]).length;
 const key=desc.toLowerCase().replace(/\s+/g,' ');
 if(key){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(file)}
 const problems=[];
 if(!title)problems.push('missing_title');
 if(!desc)problems.push('missing_description');
 if(!canonical.startsWith('https://brokerproreviews.com/'))problems.push('noncanonical_url');
 if(!/noindex/i.test(robots)&&sourceLinks===0)problems.push('no_external_source_links');
 if(problems.length)issues.push({file,problems});
}
const repeated=[...groups.entries()].filter(([,files])=>files.length>1).sort((a,b)=>b[1].length-a[1].length).map(([description,files])=>({count:files.length,description:description.slice(0,140),examples:files.slice(0,5)}));
const report={generatedAt:new Date().toISOString(),pages:pages.length,uniqueDescriptions:groups.size,repeatedDescriptions:repeated.slice(0,20),issues:issues.slice(0,100),issueCount:issues.length};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&issues.some(x=>x.problems.includes('noncanonical_url')||x.problems.includes('missing_title')))process.exitCode=1;
