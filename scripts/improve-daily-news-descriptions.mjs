import fs from 'node:fs';
import path from 'node:path';

const ROOT='site1-dark-gradient/news/daily';
const LEGACY='Original summaries with links to the source. Always verify the regulated entity for your country and read the primary source before acting. Built for LATAM.';
const write=process.argv.includes('--write');
function decode(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function escape(s){return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
const outcomes={scanned:0,eligible:0,changed:0,skipped:[],examples:[]};
for(const folder of fs.readdirSync(ROOT,{withFileTypes:true})){
 if(!folder.isDirectory()||!/^20\d{2}-\d{2}-\d{2}$/.test(folder.name))continue;
 const filename=path.join(ROOT,folder.name,'index.html');
 if(!fs.existsSync(filename))continue;
 outcomes.scanned++;
 const html=fs.readFileSync(filename,'utf8');
 const meta=html.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i);
 if(!meta||meta[1]!==LEGACY){outcomes.skipped.push({date:folder.name,reason:'non-legacy-description'});continue}
 const source=[...html.matchAll(/<h3[^>]*>\s*<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
   .map(([,url,text])=>({url,title:decode(text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())}))
   .find(x=>x.title.length>=18&&!x.url.includes('brokerproreviews.com'));
 if(!source){outcomes.skipped.push({date:folder.name,reason:'no-credible-external-headline'});continue}
 const title=source.title.replace(/[\r\n\t]+/g,' ').slice(0,85).trim();
 const desc=escape(('LATAM forex and broker news '+folder.name+': '+title+'. Read original sources and check local trading rules.').slice(0,155));
 const next=html.replace(meta[0],meta[0].replace(meta[1],desc));
 outcomes.eligible++;
 if(outcomes.examples.length<10)outcomes.examples.push({date:folder.name,description:desc,source:source.url});
 if(write){fs.writeFileSync(filename,next);outcomes.changed++}
}
console.log(JSON.stringify(outcomes,null,2));
