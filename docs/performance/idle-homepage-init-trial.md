# Browser-idle initialization trial — November 4, 2026

**Change:** The homepage initializes its language immediately, but waits for `requestIdleCallback` (timeout 1,500 ms; `setTimeout` fallback of 250 ms) to prepare below-the-fold review counts, review expanders, headlines ordering, daily-news controls and relative-time formatting. No analytics behavior or main hero styling changes.

**Local Lighthouse tests:** Two independent interleaved six-run experiments compared the exact same homepage, three samples per arm each.

| Experiment | Immediate initialization scores | Idle initialization scores | Immediate median LCP | Idle median LCP |
| --- | --- | --- | ---: | ---: |
| First | 63, 98, 99 | 98, 98, 99 | 2,101 ms | 2,177 ms |
| Second | 61, 98, 98 | 98, 98, 99 | 2,178 ms | 2,103 ms |

The two slow baseline runs had LCP around 4.8s and 4.76s. The idle variant did not have such a run in these six trials. Performance medians were 98 for both variants. The evidence is directional and does **not** establish a causal improvement in real-user experience.

**Regression checks:** Browser checks verify four visible logos and responsive 4/2/1 columns, local Inter font, continued GA4 presence, language switching, and working review toggle controls after idle initialization.

**Next verification:** Production three-run Lighthouse and browser smoke after Cloudflare deployment, alongside independent real-user CrUX trends once an API key is connected. If interactions regress, revert the initialization change without touching logos and visual styling.

- First test: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41784571903
- Second test: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41784860200
