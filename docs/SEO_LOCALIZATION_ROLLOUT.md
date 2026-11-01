# Next rollout: design, localization, SEO and AI search

## Complete in this branch
- Comparison-first flagship homepage, decision panels on detail pages and responsive styling.
- Structured data no longer claims unverified aggregate customer ratings on the flagship homepage or in the schema generator.
- Regression tests for schema, homepage, broker pages and comparison pages.

## Before creating indexable Spanish URLs
Translate **all substantive body content** and navigation (not just toggles), create independent paths, add reciprocal hreflang with self canonicals and preserve English links. Do not deploy blank or duplicate /es/ templates. Google recommends language-specific URLs: https://developers.google.com/search/docs/advanced/crawling/managing-multi-regional-sites

## Before expanding the remaining sites
Confirm the real production canonical origin for each theme. Site2 currently points at a pages.dev path and sites3–10 may represent demos. Do not mass-index duplicate designs with identical underlying broker content. Select which domains are actual independently useful publishers, and noindex demo themes as appropriate.

## Editorial prerequisites
- Ratings provenance and formula, dated source capture, per-entity jurisdictional sources, disclosed commercial relationships.
- User-visible author information only where real credentials are verified.
- Content freshness must reflect material updates, not just cron rebuilds.
- Test for accidental thin / repetitive news archives and duplicate canonicals.

## Operational measurements
- Run Lighthouse mobile/desktop on real preview and production origin.
- Audit Core Web Vitals with field data and compare baseline.
- Connect Search Console, Bing Webmaster Tools, GA4 and AI-search referral monitoring where available.
- Track impressions, indexed pages, qualified clicks, conversions and verified citations; do not promise traffic increases.

Google guidance for AI features: https://developers.google.com/search/docs/appearance/ai-features . No special `llms.txt` or AI markup is required for Google.
