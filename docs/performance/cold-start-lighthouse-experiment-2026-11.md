# Sequential mobile Lighthouse cold-start investigation — 2026-11-04

## Purpose
Previous production synthetic Lighthouse batches intermittently show a slow first sample, even when subsequent samples are fast. This experiment explicitly separates the first run from the following three **in one GitHub Actions job**.

Four chronological Lighthouse v12 mobile performance runs against `https://brokerproreviews.com/`:

| Metric | First | Second | Third | Fourth |
| --- | ---: | ---: | ---: | ---: |
| Performance | 81 | 98 | 98 | 98 |
| LCP (ms) | 2,221 | 2,025 | 2,039 | 2,035 |
| FCP (ms) | 2,035 | 1,844 | 1,851 | 1,844 |
| Total Blocking Time (ms) | 613 | 41 | 42 | 41 |
| Script evaluation (ms) | 915 | 218 | 222 | 219 |
| Server response (ms) | 76 | 92 | 74 | 70 |

The first run showed heavy script evaluation (915 ms) and TBT (613 ms), but its LCP (2.22 s) was not severely delayed. The subsequent median LCP was 2.035 s, with only 14 ms between the three samples. This demonstrates that LCP and TBT can vary independently, and some Lighthouse score volatility can be specific to the test sequence.

## Interpretation and decision
**No production change is warranted on this evidence alone.** Each Lighthouse CLI invocation launches a new Chrome process; tests do **not** share a warm browser HTTP cache. The first-vs-following difference may reflect runner warmup, CPU scheduling, Chrome/tool startup, temporary third-party execution, network variation, or unrelated factors. Four synthetic measurements do not establish a real-user cold-start penalty, a persistent site defect, or a causal optimization.

The prior Lighthouse runs with LCP over 4 seconds are not explained by this single batch. Continue the existing twice-weekly three-run monitor with slowest-LCP and worst-TBT attribution, and evaluate 28-day CrUX phone p75 once data is accessible. If user-facing performance suffers, investigate repeatable page render behavior rather than suppressing first-run results.

Test: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41816602194
