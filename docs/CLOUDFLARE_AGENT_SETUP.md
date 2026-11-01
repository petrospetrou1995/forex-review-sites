# Cloudflare agent connection instructions

Cloudflare's setup guides: https://developers.cloudflare.com/agent-setup/cursor/ and https://developers.cloudflare.com/agent-setup/codex/ .

## Cursor
1. Open this repository in Cursor on the audit branch.
2. Run `/add-plugin cloudflare` inside Cursor (or install the official Cloudflare plugin via Cursor Marketplace). This installs Cloudflare skills and registers Cloudflare MCP servers.
3. `.cursor/mcp.json` provides Cloudflare Documentation MCP and Cloudflare API MCP endpoints. Verify the servers in Cursor Settings and avoid duplicate connections created by the plugin.
4. Approve Cloudflare OAuth permissions interactively when prompted. Use least privilege and never paste credentials into GitHub.
5. Ask Cursor to inspect `brokerproreviews` and `brokercompare` Pages deployments and review `docs/RELEASE_GATES.md`; avoid altering production.

## Codex (alternative)
Open your project with Codex, run `/plugins`, install Cloudflare, and complete the interactive OAuth authorization.

## Staging prerequisites
Cloudflare D1 binding `BROKERS_DB`, encrypted `BROKER_ADMIN_API_KEY`, and Zero Trust Access variables `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are not supplied by the GitHub configuration. Configure and verify them separately in an authorized preview environment. Protect `/admin/*` and `/api/admin/*` with Access policies.

## Important
This configuration does **not** authorize access, create databases, change DNS/WAF, or deploy code. All production updates require separate review and approval.
