/**
 * Read aggregated public Chrome UX Report data; no client-side tracking added.
 * When CRUX_API_KEY is provided, query CrUX API's 28-day phone origin data.
 * Otherwise try the public PageSpeed Insights API's PHONE field-data fields.
 * Report missing data honestly, without treating missing samples as passing.
 */
import fs from 'node:fs';

const origin = 'https://brokerproreviews.com';
const key = process.env.CRUX_API_KEY?.trim();
const timeoutMs = 25000;
const medianThresholds = {
  lcp: { good: 2500, poor: 4000, unit: 'ms' },
  inp: { good: 200, poor: 500, unit: 'ms' },
  cls: { good: 0.1, poor: 0.25, unit: '' },
};
const rating = (value, k) =>
  value <= medianThresholds[k].good ? 'good' :
  value > medianThresholds[k].poor ? 'poor' : 'needs-improvement';
const request = async (url, options={}) => {
  const response = await fetch(url,{...options,signal:AbortSignal.timeout(timeoutMs)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
let result;
try {
  if (key) {
    const crux = await request('https://chromeuxreport.googleapis.com/v1/records:queryRecord?key='+encodeURIComponent(key),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        origin,formFactor:'PHONE',
        metrics:['largest_contentful_paint','interaction_to_next_paint','cumulative_layout_shift']
      })
    });
    const metrics=crux.record?.metrics||{};
    const p75 = n => metrics[n]?.percentiles?.p75 ?? null;
    result={
      source:'Chrome UX Report API',origin,device:'PHONE',aggregation:'rolling 28 days',sampledAt:new Date().toISOString(),
      collectionPeriod:crux.record?.collectionPeriod || null,
      p75:{lcp:p75('largest_contentful_paint'),inp:p75('interaction_to_next_paint'),cls:p75('cumulative_layout_shift')},
    };
  } else {
    const u=new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    u.searchParams.set('url',origin+'/');
    u.searchParams.set('strategy','mobile');
    const psi=await request(u.toString());
    const m=psi.originLoadingExperience?.metrics||{};
    result={
      source:'PageSpeed Insights public origin field data',origin,device:'mobile',aggregation:'rolling field-data window',sampledAt:new Date().toISOString(),
      collectionPeriod:null,
      p75:{
        lcp:m.LARGEST_CONTENTFUL_PAINT_MS?.percentile??null,
        inp:m.INTERACTION_TO_NEXT_PAINT?.percentile??null,
        cls:m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile??null,
      },
      note:'PSI field data may become unavailable; use a CRUX_API_KEY repository secret for the direct CrUX API.',
    };
  }
} catch (e) {
  result={
    source:key?'Chrome UX Report API':'PageSpeed Insights public API',
    origin,device:'PHONE',sampledAt:new Date().toISOString(),
    unavailable:true,reason:String(e.message),
    note:'No field-data conclusion can be drawn. Add a repository CRUX_API_KEY secret to enable direct CrUX sampling.',
  };
}
if (!result.unavailable) {
  const present=Object.entries(result.p75).filter(([,v])=>typeof v==='number'&&Number.isFinite(v));
  if(!present.length){
    result.unavailable=true;
    result.reason='No eligible public phone field-data metrics returned (possibly insufficient traffic).';
  }else{
    result.ratings=Object.fromEntries(present.map(([k,v])=>[k,rating(v,k)]));
  }
}
const output=JSON.stringify(result,null,2);
console.log('REAL_USER_CORE_WEB_VITALS');
console.log(output);
fs.writeFileSync('crux-field-data.json',output+'\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const val=k=>typeof result.p75?.[k]==='number'?`${result.p75[k]} (${result.ratings?.[k]})`:'not available';
  const body=[
    '## BrokerProReviews — real-user Core Web Vitals',
    `Source: ${result.source}; checked: ${result.sampledAt}`,
    `Status: ${result.unavailable?'Field data unavailable':'Public field data returned'}`,
    `- Mobile LCP p75: ${val('lcp')}`,
    `- Mobile INP p75: ${val('inp')}`,
    `- Mobile CLS p75: ${val('cls')}`,
    result.reason?`- Reason: ${result.reason}`:'',
    'These are aggregated real-user measurements, not Lighthouse scores. Missing values are unknown, not good.',
  ].filter(Boolean).join('\n')+'\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,body);
}
