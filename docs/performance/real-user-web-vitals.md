# Real-user Core Web Vitals monitoring

This workflow runs on Wednesdays at 08:25 UTC and on manual dispatch, and also tests script changes in pull requests.

It queries aggregated phone field data for `https://brokerproreviews.com`. No tracking JavaScript, cookies, per-visitor telemetry, or client-side events are added to the site by this workflow.

By default it attempts to read public **PageSpeed Insights** origin-level field data. This API can be rate limited or may stop returning CrUX field data. For a more reliable direct data source, configure a restricted `CRUX_API_KEY` as a GitHub Actions repository secret with the **Chrome UX Report API** enabled in Google Cloud. The script uses the direct CrUX API when that secret exists.

- LCP p75 good at or below 2,500 ms; poor above 4,000 ms.
- INP p75 good at or below 200 ms; poor above 500 ms.
- CLS p75 good at or below 0.1; poor above 0.25.

The job uploads `crux-field-data.json` and writes a summary to the GitHub Actions run. It **does not mark missing data as passing**, fabricate measurements, or fail website deployments because a public Google API is unavailable. Pages/sites without enough traffic may legitimately have no CrUX result.

Use alongside the 3-run Lighthouse workflow: Lighthouse is reproducible lab simulation; CrUX is a rolling aggregate of opted-in eligible Chrome-user visits over roughly 28 days. CrUX metrics may lag changes by weeks. Other browsers and regions are not completely represented.

References:
- https://developer.chrome.com/docs/crux/api
- https://developers.google.com/speed/docs/insights/v5/get-started
