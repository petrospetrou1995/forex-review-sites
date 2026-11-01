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

## Automated preview smoke test

Run the GitHub Action **Read-only preview smoke test** manually from the branch and enter the full HTTPS URL of a protected Cloudflare preview. This check only performs GET requests; it verifies homepage and robots availability, canonical presence, expected admin access denial/redirect, and public broker API response. It never mutates production broker data. It does **not** replace authenticated browser testing, Cloudflare Access configuration or D1 migrations.

### Preview access findings (2026-10-26)
- Latest pre-change GitHub validation and both Cloudflare Pages checks succeeded.
- Public homepage remains the old live design, as expected because PR #1 is unmerged.
- `/admin/`, `/api/admin/brokers`, and `/api/brokers` on the public production hostname were not accessible from the external page inspection tool; this is **not** a verified HTTP status or authorization test.
- Preview smoke checks now accept only a full HTTPS **deployment or branch** `*.pages.dev` hostname containing a preview prefix (e.g. `branch.project.pages.dev`). They reject bare project/production domains.
- Obtain the exact Cloudflare preview URL from the deployment detail for the PR commit and run the manually triggered GitHub `Read-only preview smoke test` workflow. Protected preview origins may require configuring CI access; never insert a Cloudflare Access token into a public workflow input.
