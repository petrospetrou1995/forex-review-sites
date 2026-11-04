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

## Independent repeat on the documentation commit

The full test reran and exposed a larger first-run outlier. Scores were **67, 97, 97, 97**; LCP was **4,683 / 2,131 / 2,093 / 2,157 ms**; TBT was **564 / 95 / 82 / 80 ms**. First-run script evaluation was **823 ms**, versus **294–301 ms** on later samples. Initial HTML server response stayed **73–93 ms** in all four runs.

The repeat supports investigating first-run environment/JavaScript/rendering behavior rather than simply blaming slow initial HTML responses, but does not isolate a root cause. The first-to-later-median LCP gap was 2,552 ms on the repeat, versus 186 ms on the first test. These results further demonstrate that a three-run median can conceal significant outlier variation.

Repeat test: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41816861462

## Interpretation and decision
**No production change is warranted on this evidence alone.** Each Lighthouse CLI invocation launches a new Chrome process; tests do **not** share a warm browser HTTP cache. The first-vs-following difference may reflect runner warmup, CPU scheduling, Chrome/tool startup, temporary third-party execution, network variation, or unrelated factors. Four synthetic measurements do not establish a real-user cold-start penalty, a persistent site defect, or a causal optimization.

The prior Lighthouse runs with LCP over 4 seconds are not explained by this single batch. Continue the existing twice-weekly three-run monitor with slowest-LCP and worst-TBT attribution, and evaluate 28-day CrUX phone p75 once data is accessible. If user-facing performance suffers, investigate repeatable page render behavior rather than suppressing first-run results.

Test: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41816602194
