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
