import { chromium } from 'playwright';
import fs from 'node:fs';

const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
let errors = [];
const sizes = [
  {name:'desktop',width:1440,height:900,columns:4},
  {name:'tablet',width:820,height:1000,columns:2},
  {name:'mobile',width:390,height:844,columns:1},
];
for(const size of sizes){
 const page=await browser.newPage({viewport:{width:size.width,height:size.height}, deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:8123/',{waitUntil:'networkidle',timeout:45000});
 await page.locator('.featured-brokers .broker-card').first().scrollIntoViewIfNeeded();
 const result=await page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.featured-brokers .brokers-grid > .broker-card')];
   const grid=document.querySelector('.featured-brokers .brokers-grid');
   const columns=getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
   const logos=cards.map(c=>{
     const img=c.querySelector('img.featured-broker-logo');
     const rect=img?.getBoundingClientRect();
     return {id:c.dataset.brokerId,loaded:!!img&&img.complete&&img.naturalWidth>0,visible:!!rect&&rect.width>0&&rect.height>0,src:img?.currentSrc};
   });
   return {columns,logos,documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
 });
 console.log(size.name,JSON.stringify(result));
 if(result.columns!==size.columns)errors.push(size.name+': '+result.columns+' columns, expected '+size.columns);
 for(const logo of result.logos){
   if(!logo.loaded || !logo.visible) errors.push(size.name+': '+logo.id+' logo not loaded or invisible');
 }
 if(result.documentWidth>result.viewportWidth+2)errors.push(size.name+': horizontal page overflow');
 fs.mkdirSync('broker-logo-screenshots',{recursive:true});
 await page.locator('.featured-brokers .brokers-grid').screenshot({path:'broker-logo-screenshots/'+size.name+'.png'});
 await page.close();
}
await browser.close();
if(errors.length){ console.error('Responsive logo check failed:\n'+errors.join('\n'));process.exitCode=1; }
else console.log('Broker logos loaded and cards arranged correctly at desktop/tablet/mobile');
