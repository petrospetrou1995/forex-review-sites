/** Normalize CrUX numeric strings (notably CLS) and classify complete/partial field data. */
export const thresholds = {
  lcp: {good:2500,poor:4000},
  inp: {good:200,poor:500},
  cls: {good:0.1,poor:0.25}
};
export const normalizeMetric = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
export const classifyFieldMetrics = raw => {
  const p75 = Object.fromEntries(Object.keys(thresholds).map(k=>[k,normalizeMetric(raw?.[k])]));
  const ratings = Object.fromEntries(Object.entries(p75).filter(([,v])=>v!==null).map(([k,v])=>[
    k, v<=thresholds[k].good?'good':v>thresholds[k].poor?'poor':'needs-improvement'
  ]));
  const available=Object.keys(ratings);
  return {
    p75,ratings,
    fieldDataStatus:available.length===0?'unavailable':available.length===3?'complete':'partial',
    availableMetrics:available,
    missingMetrics:Object.keys(thresholds).filter(k=>!available.includes(k))
  };
};
