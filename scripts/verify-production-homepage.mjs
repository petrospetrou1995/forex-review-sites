/**
 * Live production smoke test. Requires network access.
 * node scripts/verify-production-homepage.mjs
 * Optional: SITE_URL=https://brokerproreviews.com/ node ...
 */
const url = process.env.SITE_URL || 'https://brokerproreviews.com/';
const expected = [
  /data-broker-id="libertex"/,
  /data-broker-id="xm"/,
  /data-broker-id="exness"/,
  /data-broker-id="pepperstone"/,
  /Varies by entity/,
  /brokerproreviews\.com/i,
];
const forbidden = [/Up to 1:888/, /Up to 1:2000/, /Up to 1:500/];
const maxAttempts = 3;
let lastError;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    const target = new URL(url);
    target.searchParams.set('deployment_check', String(Date.now()));
    const response = await fetch(target, {
      signal: AbortSignal.timeout(15000),
      headers: { 'cache-control': 'no-cache', 'user-agent': 'BrokerProReviews-Production-Check/1.0' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const missing = expected.filter(pattern => !pattern.test(html)).map(String);
    const stale = forbidden.filter(pattern => pattern.test(html)).map(String);
    console.log(JSON.stringify({ url, status: response.status, attempt, bytes: html.length, missing, stale }, null, 2));
    if (missing.length || stale.length) throw new Error('Production content mismatch');
    console.log('Production homepage content verified.');
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`Attempt ${attempt}/${maxAttempts}: ${error.message}`);
    if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 4000 * attempt));
  }
}
console.error('Production verification FAILED:', lastError?.message);
process.exit(1);
