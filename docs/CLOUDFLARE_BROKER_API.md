# Cloudflare Pages broker API — opt-in deployment

The API is implemented under `site1-dark-gradient/functions/api` for Cloudflare Pages deployments with that directory as the project root. **No database or production secret has been provisioned by this pull request.** The site stays static until you configure D1.

## Deploy
1. Create a Cloudflare D1 database using your Cloudflare account.
2. Apply `site1-dark-gradient/migrations/0001_brokers.sql` using D1's SQL migration facilities.
3. In Cloudflare Pages project settings, bind the D1 database with variable name `BROKERS_DB`, in production **and** preview if needed.
4. Set an encrypted Pages secret `BROKER_ADMIN_API_KEY` to a randomly generated value at least 32 characters long. Never place this value in browser code, GitHub commits, or public frontend configuration.
5. Deploy from the Pages project whose root is `site1-dark-gradient`. Confirm Functions discovery with the deployment log. If the project builds from a different root, adjust routing or asset directory to match.
6. Test `GET /api/brokers` and `GET /api/brokers?since=<ISO timestamp>`. Use only a server-side trusted client for authenticated writes.

## API
- `GET /api/brokers`: public JSON broker list, max 500 items.
- `GET /api/brokers?since=...`: incremental event updates, max 500 events.
- `POST /api/update`: server-only request with `Content-Type: application/json`, `X-API-Key` secret, and JSON `{"type":"new_broker","payload":{"id":"example","name":"Example","rating":4}}`.
- Also supports `broker_update` (requires existing record) and `delete_broker` (payload `{"id":"example"}`).

## Deliberate boundaries
- No browser admin UI, personal logins, or fine-grained RBAC; one server-to-server credential only.
- The database initially has no brokers. Existing static `data/brokers-db.json` is not automatically imported. Import must be explicitly reviewed and transformed from snake_case to the API schema.
- No WebSocket, SSE, public POST, bulk updates or live admin publishing yet. Polling works, but the shared frontend defaults to offline mode.
- The event log records previous values, time, operation, and generic API actor, not a human identity. A future identity provider is needed for accountable per-user audit.
- D1 and Pages rate limits, API abuse monitoring, retention/backup, data recovery, credential rotation and deployment verification are required before production use.
- Never deploy the root `api-example.js`: it is insecure educational sample code.
