# Hero gradient LCP isolation — 2026-11-04

## Question
Could the homepage's CSS gradient text clipping cause occasional 4-second Largest Contentful Paint for the hero heading?

## Design
Use identical homepage assets and markup in two local test servers. The baseline retains the gradient text. The alternative changes only the heading to a flat cyan color in an **experiment-only** copy. Each arm was tested with simulated mobile Lighthouse.

The original test (PR #61) ran baseline first and reported one slow initial baseline sample at 4,541 ms while the remaining samples were around 2,177 ms. That result was susceptible to cold-first-run ordering.

The replacement test (PR #62) warmed **both** arms with Lighthouse first and then reversed the interleaved measurement order.

| Metric | Existing gradient | Experimental flat color |
| --- | ---: | ---: |
| Performance scores | 98, 98, 99 | 98, 98, 99 |
| Median Performance | 98 | 98 |
| Individual LCP (ms) | 2,102 / 2,102 / 2,102 | 2,178 / 2,177 / 2,103 |
| Median LCP | 2,102 ms | 2,177 ms |
| Median FCP-to-LCP gap | 750 ms | 825 ms |
| Median TBT | 100 ms | 95 ms |

## Decision
**Do not change the production gradient.** There is no evidence that replacing it improves LCP. In the warmed comparison, the gradient arm was slightly faster; the 75 ms difference is too small and the samples too limited for a causal claim.

The old first-run outlier disappearing after warmup suggests testing order may have contributed, but this does **not** establish the cause of intermittent slow real production runs. Continue synthetic outlier diagnostics and real-user CrUX field data when available. A local test cannot reproduce all CDN/network/browser conditions.

Result: https://github.com/petrospetrou1995/forex-review-sites/actions/runs/41809988125
