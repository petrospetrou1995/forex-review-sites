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
 const cards=page.locator('.featured-brokers .broker-card');
 for(let i=0;i<await cards.count();i++){
   const img=cards.nth(i).locator('img.featured-broker-logo');
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(async el=>{
     if(el.complete) return;
     await new Promise(resolve=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true});setTimeout(resolve,10000);});
   });
 }
 const tracker=await page.evaluate(()=>{
   const el=document.querySelector('script[src*="www.googletagmanager.com/gtag/js"]');
   return {present:!!el,async:!!el?.async,priority:el?.getAttribute('fetchpriority'),gtag:typeof window.gtag==='function'};
 });
 if(!tracker.present || !tracker.async || tracker.priority!=='low' || !tracker.gtag)errors.push(size.name+': Google Analytics integration/priority regression');
 const fontStatus=await page.evaluate(async()=>{
   const loaded=await document.fonts.load('400 16px Inter');
   const fetched=performance.getEntriesByType('resource').map(x=>x.name);
   return {loaded:loaded.length>0,external:fetched.filter(url=>/fonts\\.(googleapis|gstatic)\\.com/.test(url)),
     local:fetched.some(url=>url.includes('/assets/fonts/inter-latin-variable.woff2'))};
 });
 if(!fontStatus.loaded || !fontStatus.local || fontStatus.external.length) {
   errors.push(size.name+': local Inter font failed or Google Fonts external request detected '+JSON.stringify(fontStatus));
 }
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
   if(!logo.src?.startsWith('http://127.0.0.1:8123/assets/brokers/')) errors.push(size.name+': '+logo.id+' still depends on external image origin');
 }
 if(result.documentWidth>result.viewportWidth+2)errors.push(size.name+': horizontal page overflow');
 fs.mkdirSync('broker-logo-screenshots',{recursive:true});
 await page.locator('.featured-brokers .brokers-grid').screenshot({path:'broker-logo-screenshots/'+size.name+'.png'});
 if(size.name==='mobile'){
   await page.locator('#langToggle').click();
   const spanish=await page.evaluate(()=>({lang:document.documentElement.lang,heading:document.querySelector('.hero-title')?.textContent?.trim(),toggle:document.querySelector('#langToggle')?.textContent?.trim()}));
   if(spanish.lang!=='es'||!spanish.heading?.includes('Reseñas Confiables')||spanish.toggle!=='EN')errors.push('Spanish translation toggle did not update heading and language');
   await page.locator('#langToggle').click();
   const english=await page.evaluate(()=>({lang:document.documentElement.lang,heading:document.querySelector('.hero-title')?.textContent?.trim(),toggle:document.querySelector('#langToggle')?.textContent?.trim()}));
   if(english.lang!=='en'||!english.heading?.includes('Trusted Forex')||english.toggle!=='ES')errors.push('English translation toggle did not restore heading and language');
 }
 await page.close();
}
await browser.close();
if(errors.length){ console.error('Responsive logo check failed:\n'+errors.join('\n'));process.exitCode=1; }
else console.log('Broker logos loaded and cards arranged correctly at desktop/tablet/mobile');
