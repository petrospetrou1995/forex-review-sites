import { chromium } from 'playwright';
const origin='https://brokerproreviews.com/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failures=[];
for(const size of [{name:'desktop',width:1440,height:900,cols:4},{name:'tablet',width:820,height:1000,cols:2},{name:'mobile',width:390,height:844,cols:1}]){
 const page=await browser.newPage({viewport:{width:size.width,height:size.height}});
 const failedRequests=[];
 page.on('requestfailed',r=>failedRequests.push(r.url()));
 const response=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:45000});
 if(response?.status()!==200)failures.push(size.name+': homepage returned '+response?.status());
 const logos=page.locator('.featured-brokers .broker-card img.featured-broker-logo');
 for(let i=0;i<await logos.count();i++){
   const img=logos.nth(i);
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(async el=>{
      if(el.complete)return;
      await Promise.race([
        new Promise(resolve=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true});}),
        new Promise(resolve=>setTimeout(resolve,10000)),
      ]);
   });
 }
 const font=await page.evaluate(async()=>{
   await document.fonts.load('400 16px Inter');
   const resources=performance.getEntriesByType('resource').map(x=>x.name);
   const cards=[...document.querySelectorAll('.featured-brokers .broker-card')];
   const logoResults=cards.map(c=>{const i=c.querySelector('img.featured-broker-logo');return {
     id:c.dataset.brokerId, loaded:!!i?.complete&&i.naturalWidth>0,
     src:i?.currentSrc||'',visible:!!i&&i.getBoundingClientRect().width>0
   }});
   const grid=document.querySelector('.featured-brokers .brokers-grid');
   const analytics=document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
   return {
     localFont:resources.some(s=>s.includes('/assets/fonts/inter-latin-variable.woff2')),
     remoteFonts:resources.filter(s=>/fonts\.(googleapis|gstatic)\.com/.test(s)),
     columns:grid?getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length:null,
     logos:logoResults,overflow:document.documentElement.scrollWidth>innerWidth+2,
     analyticsPresent:!!analytics&&analytics.async&&typeof window.gtag==='function'
   };
 });
 console.log(size.name,JSON.stringify(font));
 if(!font.localFont||font.remoteFonts.length)failures.push(size.name+': font not local');
 if(font.columns!==size.cols)failures.push(size.name+': wrong columns');
 if(font.logos.length!==4||font.logos.some(l=>!l.loaded||!l.visible||!l.src.startsWith('https://brokerproreviews.com/assets/brokers/')))failures.push(size.name+': missing or remote broker logo');
 if(font.overflow)failures.push(size.name+': horizontal overflow');
 if(!font.analyticsPresent)failures.push(size.name+': GA tag missing');
 if(size.name==='mobile'){
  await page.locator('#langToggle').click();
  if((await page.locator('html').getAttribute('lang'))!=='es')failures.push('Spanish language not switched');
  await page.locator('#langToggle').click();
  if((await page.locator('html').getAttribute('lang'))!=='en')failures.push('English language not restored');
 }
 if(failedRequests.some(s=>s.startsWith('https://brokerproreviews.com/assets/')))failures.push(size.name+': local asset request failure');
 await page.close();
}
await browser.close();
if(failures.length){console.error('Production smoke failed',failures);process.exitCode=1;}
else console.log('Production browser smoke passed for all three viewports');
