import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('never emit unsupported aggregate rating review counts',()=>{
 const home=fs.readFileSync('site1-dark-gradient/index.html','utf8');
 const gen=fs.readFileSync('scripts/ensure-structured-data.mjs','utf8');
 assert.doesNotMatch(home,/"@type":\s*"AggregateRating"/);
 assert.doesNotMatch(gen,/aggregateRating\s*:/);
});
test('SEO landing page is canonical and discoverable',()=>{
 const home=fs.readFileSync('site1-dark-gradient/index.html','utf8');
 assert.match(home,/<link rel="canonical" href="https:\/\/brokerproreviews\.com\/"/);
 assert.match(home,/id="find-broker"/);
 const robots=fs.readFileSync('site1-dark-gradient/robots.txt','utf8');
 assert.match(robots,/https:\/\/brokerproreviews\.com\/sitemap\.xml/);
});

test('broker editorial structured data cannot claim merchant product offers',()=>{
 const home=fs.readFileSync('site1-dark-gradient/index.html','utf8');
 const generator=fs.readFileSync('scripts/ensure-structured-data.mjs','utf8');
 const blocks=[...home.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g)];
 for(const [,body] of blocks) {
   const data=JSON.parse(body);
   const nodes=[];const walk=v=>{if(!v||typeof v!=='object')return;nodes.push(v);Object.values(v).forEach(walk)};walk(data);
   assert.equal(nodes.some(x=>x['@type']==='Product'||x['@type']==='Offer'),false);
 }
 assert.doesNotMatch(generator,/'@type': 'Product'/);
 assert.doesNotMatch(generator,/'@type': 'Offer'/);
});


test('flagship review and comparison JSON-LD contains no merchant types',()=>{
  for(const section of ['brokers','compare']){
    const root='site1-dark-gradient/'+section;
    for(const dir of fs.readdirSync(root,{withFileTypes:true})){
      if(!dir.isDirectory())continue;
      const path=root+'/'+dir.name+'/index.html';
      if(!fs.existsSync(path))continue;
      const html=fs.readFileSync(path,'utf8');
      for(const [,json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
        const nodes=[];
        const walk=x=>{if(!x||typeof x!=='object')return;nodes.push(x);Object.values(x).forEach(walk)};
        walk(JSON.parse(json));
        assert.equal(nodes.some(x=>['Product','Offer'].includes(x['@type'])),false,path);
      }
    }
  }
});
