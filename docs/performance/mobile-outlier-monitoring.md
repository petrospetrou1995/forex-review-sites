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

## Main-thread breakdown and data minimization

Each 3-run capture also compares the slowest and fastest LCP samples for script evaluation groups, per-script bootup time and long tasks. These are Lighthouse-attributed synthetic measurements, not conclusive proof of root cause or real-user experience. Look for repeated differences across runs before applying changes.

Network and JavaScript URLs in generated diagnostics contain **origin and pathname only**. Query strings and fragments are removed to avoid saving analytics client/session identifiers or access tokens in public GitHub Actions logs and artifacts. The full Lighthouse JSON artifacts can contain request metadata: restrict artifact access and retention as appropriate to repository privacy, and avoid sharing raw reports externally without review.

The workflow runs a synthetic redaction regression test before measuring production.

## First-run versus subsequent samples

The scheduled three-run monitor now stores `firstRunComparison` in `mobile-outlier-diagnostics.json`, including the first-versus-later-median differences for LCP and total blocking time. Heuristic flags mark a first-run LCP above 2,500 ms and over 1,000 ms slower than the subsequent median, or first-run blocking above 200 ms and over 150 ms higher. These flags do **not** remove the slow run from median or worst-run reports and do not fail CI.

Each Lighthouse CLI run launches a fresh Chrome process: the comparison must not be presented as a browser-cache warmup test or a real-user regression. Treat repeated patterns as an investigation cue, inspect script execution and network attribution, and consult CrUX field data when available before changing production behavior.
