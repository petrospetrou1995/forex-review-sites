# Production hardening roadmap

This document tracks the staged audit work. Do not treat the example server `api-example.js` as a production API.

## Phase 1 — Security and correctness
- [x] Escape API-supplied broker content in the dashboard HTML renderer and clamp displayed ratings.
- [x] Do not report failed broker updates as successful browser-local persistence.
- [x] Add baseline HTTP security headers for site1 and site2 when hosted on a platform that honors `_headers`.
- [ ] Implement server-side authorization on all broker write endpoints before production deployment.
- [ ] Enforce runtime schema validation and review external data feeds.
- [ ] Design and test Content Security Policy; account for TradingView, GA, and Google Fonts.
- [ ] Deploy audit logging and change-approval workflows.

## Phase 2 — SEO and publishing reliability
- [x] Correct site1 robots sitemap hostname.
- [x] Serialize the four publishing GitHub Actions workflows using a shared concurrency group.
- [x] Add a non-mutating static validation workflow for pull requests.
- [ ] Resolve site2 production domain and sitemap canonical configuration.
- [ ] Inventory `hreflang`, translations and translated indexable URLs.
- [ ] Verify broker ratings, review counts, license jurisdictions and source provenance.
- [ ] Set authoritative publication and modification dates rather than filesystem mtime.
- [ ] Test real redirects, response headers, structured-data and Core Web Vitals on production.

## Phase 3 — Platform and maintainability
- [ ] Select persistent storage and an authenticated broker-admin API.
- [ ] Introduce one versioned broker-data schema across every frontend; migrate the site10 dashboard SSE path and update cursor conventions.
- [ ] Add access roles, audit trail, versioned imports, validation, moderation and publish approval.
- [ ] Adopt deployment previews, browser E2E tests and observability.
- [ ] Revisit image, CSS and JavaScript budget with production Lighthouse measurements.

## Deployment warnings
The checked-in `api-example.js` is documentation-only, has commented-out auth, and uses in-memory data. Never expose its write endpoint publicly. The repository-level `package.json` specifies ESM and does not contain the example's Express/ws dependencies, so this is **not** a working deployable backend.

The current static websites do not automatically receive data updates from a production API; configure, implement and test an authenticated service before enabling live data ingestion.

GitHub Actions concurrency coordinates new runs after these workflow changes reach a branch that executes them, but remote API failures, rebases, deployment behavior and untested pages still require additional validation.
