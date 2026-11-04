# GA4 load-timing experiment — 2026-11-04

We tested the current `async fetchpriority="low"` GA4 loader against an experiment-only variant that inserts the same GA4 script after the `window.load` event. Both arms used the same HTML content and site assets on two localhost origins, with analytics collection beacon requests blocked only inside Lighthouse so tests would not send sample pageviews to the live analytics property.

Three interleaved Lighthouse mobile samples per arm:

| Measure | Current asynchronous GA4 | After-load GA4 |
| --- | --- | --- |
| Performance scores | 96, 97, 98 | 97, 97, 97 |
| Median Performance | 97 | 97 |
| Median LCP | 2,104 ms | 2,177 ms |
| Median Total Blocking Time | 147 ms | 134 ms |
| GA4 script fetched in all samples | yes | yes |
| GA4 script bootup time (samples) | 306, 260, 252 ms | 242, 257, 244 ms |

**Outcome: do not ship delayed GA4.** The performance difference is negligible in a small synthetic benchmark. Loading GA4 after `load` creates potential loss of short-visit pageviews, with no clear benefit. Keep the current async low-priority loader in production; do not disable analytics or remove the script.

The test isolates page-load timing on localhost, not real-world analytics coverage or browser behavior across every network. Test results are directional and do not establish a sustained production improvement. Real-user Chrome UX Report measurements are tracked by the separate `real-user-web-vitals.yml` workflow, subject to available samples and a configured API key.

Test report: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41807957066
