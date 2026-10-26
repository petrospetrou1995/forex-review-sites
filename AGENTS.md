# AI agent instructions for forex-review-sites

- This repository hosts Cloudflare Pages static sites and an experimental Cloudflare Pages Functions/D1 broker API.
- Consult official Cloudflare documentation through the `cloudflare-docs` MCP connection before changing Cloudflare-related code.
- Use `cloudflare-api` MCP only after the user authorizes it through OAuth; inspect resources read-only before making account-level changes.
- Treat `main` and production Cloudflare infrastructure as protected. Keep changes on draft PR #1 until the user explicitly approves merge/deployment.
- Never place API tokens, Access client credentials or D1 secrets in Git, prompts, or client-side JavaScript.
- Read `docs/RELEASE_GATES.md` and `docs/CLOUDFLARE_BROKER_API.md` before adjusting deployment or authentication.
- Validate staging with protected access tests and D1 integration tests, not only successful Cloudflare build checks.
- Do not publish fabricated broker ratings, source references or untranslated SEO pages.
