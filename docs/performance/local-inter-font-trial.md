# Self-hosted Inter font trial (2026-11-03)

**Purpose:** Remove reliance on externally hosted Google Fonts without altering the site's Inter typeface, analytics, or broker content.

The homepage's Latin subset of the Inter variable font is bundled at `site1-dark-gradient/assets/fonts/inter-latin-variable.woff2` and loaded with `font-display:swap`. The upstream Google Fonts Inter binary is covered by the SIL Open Font License 1.1, preserved verbatim at `site1-dark-gradient/assets/fonts/OFL-Inter.txt`. The pinned font file originates from `fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2`.

**Browser QA:** Local font resource loads successfully on desktop (1440px), tablet (820px), and mobile (390px) with no requests to `fonts.googleapis.com` or `fonts.gstatic.com`. Existing logo and English/Spanish tests pass.

**Measured performance:** A matched-content localhost experiment (three Lighthouse simulated mobile samples per variant, interleaved) yielded:

| Metric | External Google Fonts | Local Inter |
| --- | ---: | ---: |
| Median Lighthouse Performance | 98 | 98 |
| Median LCP | 2043 ms | 2102 ms |
| Median FCP | 1353 ms | 1352 ms |
| Median TBT | 99 ms | 100 ms |

The result is approximately neutral for simulated mobile performance. No sustained LCP improvement can be claimed. Fewer external requests can reduce dependency on the Google Fonts service and potential cross-origin privacy exposure.

The production Lighthouse monitor and future field data should continue to be checked after deployment. If there are visual regressions or a measurable performance deterioration, revert the font change and preserve the rest of the release.

Experiment reference: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41663184048

Notes: the comparison ran on localhost instead of the Cloudflare preview because the preview deployments remained queued; local results do not prove equivalent production behavior.
