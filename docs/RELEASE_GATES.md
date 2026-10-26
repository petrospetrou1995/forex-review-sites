# Release gate for draft PR #1

## Status (2026-10-26)
This branch contains multiple security, backend, design and SEO changes. **Do not merge based on passing syntax tests alone.**

## Required checks before merge
- [ ] GitHub `validate` conclusion is success on the final head SHA.
- [ ] Cloudflare Pages build/deployment conclusion is success on the final head SHA.
- [ ] Verify hosting functions and static asset paths on preview. The Cloudflare project root and Functions discovery must be confirmed.
- [ ] Test /admin/ and /api/admin/* for unauthenticated 401 and valid signed Cloudflare Access identity; protect both using Cloudflare Zero Trust.
- [ ] Configure D1 binding, migration and encrypted `BROKER_ADMIN_API_KEY`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` in preview only.
- [ ] Test create, update, read, delete and invalid JSON against a temporary D1 database.
- [ ] Confirm no service key reaches browser responses, HTML or JavaScript.
- [ ] Mobile and desktop visual QA at 360px/768px/1440px, including focus navigation and comparison-table scrolling.
- [ ] Real Lighthouse/Core Web Vitals, response headers, crawl checks and canonical verification.
- [ ] Validate licensing, rating methodology, aggregate-review data and author claims against documented sources.
- [ ] Ensure sitemap URL and robots URL resolve to production canonical hostname.

## Release blockers
- Cloudflare Access policies, persistent database configuration and secret provisioning need privileged Cloudflare access.
- The administration interface is a foundation, not a production-ready multi-user moderation console.
- No verified Search Console, Bing performance or field-Lighthouse reports have been provided.
- Spanish crawlable pages and redesign of nine additional sites should only follow verified translation, production domain and content differentiation.

## Safe release sequence
1. Approve the PR's scope and review its diff.
2. Configure protected preview service, secret, D1 and a test Access policy.
3. Run CI and integration/browser checks. Fix identified failures on this branch.
4. Merge only after explicit sign-off and production backup/rollback plan.
5. Monitor Cloudflare errors, organic search indexing and analytics after publishing.
