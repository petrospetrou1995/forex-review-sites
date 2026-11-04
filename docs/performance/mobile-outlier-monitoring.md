# Mobile Lighthouse outlier monitoring

The goal is to identify **intermittent slow loads**, not just the median score.

The existing Lighthouse workflow continues to sample production three times per run. In addition to category medians, it now records all three Performance, LCP, FCP, TBT and CLS values, the worst Performance run, the run with the highest LCP, and slow network requests from that run.

Runs automatically on Tuesdays and Fridays at 07:40 UTC and can be manually triggered. Pull requests touching the monitor also execute it. Each run uploads `mobile-outlier-diagnostics.json` alongside the full Lighthouse reports and adds a concise GitHub Actions job summary.

Warnings are emitted for any of these conditions:

- Any LCP above 4,000 milliseconds
- Any Performance score below 80
- Two or more LCP samples above 2,500 milliseconds
- Performance score spread above 20 points

Warnings are **not** CI failures because three simulated samples are not statistically sufficient to declare a persistent real-user regression. A warning should trigger investigation and a comparison with previous runs; it does not authorize changing analytics, cookies, financial content or website behavior automatically.

For actual 28-day Chrome field data, use the separate `Real-user Core Web Vitals snapshot` workflow. Direct CrUX access requires the repository secret `CRUX_API_KEY` and a Google API project with the CrUX API enabled. Missing field data is not a passing score.

Actions: https://github.com/petrospetrou1995/forex-review-sites/actions/workflows/mobile-lighthouse-baseline.yml

Site: https://brokerproreviews.com
