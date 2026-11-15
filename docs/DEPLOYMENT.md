# Deployment

## Docker on a server

1. Install Docker with Compose and clone the repository.
2. Create an untracked `.env` with a strong `SESSION_SECRET` and `POSTGRES_PASSWORD`.
3. Run `docker compose up --build -d`. The PostgreSQL volume retains data across app restarts.
4. Verify `curl --fail http://localhost:3000/api/health` reports `{"status":"ok","database":"postgresql"}`.
5. For a remote presentation, place an authenticated HTTPS reverse proxy in front of the app. Set `COOKIE_SECURE=true` when served over HTTPS. Keep PostgreSQL private; restrict access to demo participants.
6. Back up PostgreSQL regularly with `pg_dump`. Never expose demo role switching to real patient data.

The initial compose defaults are for a local demo: loopback bindings, demo roles enabled, no real notifications, and no subscriptions. The image uses Node 22 and runs as the unprivileged `node` user. It retains development dependencies to run the idempotent TypeScript setup script; slimming the image is optional follow-up work.

## Standard Node hosting + managed PostgreSQL

Use a Node-capable host with a PostgreSQL connection (for example, a container service or Node server). Build with `npm ci && npm run build`. Run `node --import tsx scripts/setup.ts` as a one-time release command, then `npm start`. Expose the assigned `PORT` and configure the `/api/health` check.

Set these values through the host's secret manager:

| Variable         | Purpose                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string, including the database provider's required TLS settings         |
| `SESSION_SECRET` | Random signing secret, at least 32 characters                                                 |
| `DEMO_MODE`      | `true` enables the deliberately open demo role picker; `false` blocks new demo staff sessions |
| `COOKIE_SECURE`  | `true` for HTTPS deployments                                                                  |
| `OPENAI_API_KEY` | Optional grounded filter extraction; absent uses the labeled rules demo                       |
| `OPENAI_MODEL`   | Optional model override; default `gpt-4.1-mini`                                               |

The launch scripts enable Node’s environment-proxy support while preserving configured proxy and CA settings. This is needed in the managed Cloud environment; on ordinary hosts without proxy variables it has no routing effect. TLS verification remains enabled.

Do not commit `.env` files. Rotate the signing secret when transitioning away from a demo to invalidate existing demo sessions. Disabling the demo role picker is not a replacement for implementing production identity.

## Current deployment status

Tested in the provided Cloud environment against actual PostgreSQL. The repository contains a Node/Next.js production build, Docker configuration, CI workflow, and local browser-test evidence. The Docker image built successfully, but container startup was blocked by this workspace’s disk limit; see TESTING.md. No persistent production host, domain, managed PostgreSQL account, or deployment credential was provided; no public service or managed database was created. The Sites managed preview relay failed, and its Worker/D1 runtime does not directly host this requested Node/PostgreSQL architecture. No static mock was published as a substitute.

## Remaining dependencies before a real pilot

- Production identity (OIDC or equivalent), clinic membership verification, owner account/recovery flow, session revocation, rate limits, and a deployment access gate. Demo roles are intentional simulations.
- Real clinic agreements and approval of published clinical/cost information. Partnerships, capacity and team schedules are simulated.
- Managed hosting, PostgreSQL backups, monitoring, HTTPS, and reviewed schema migration strategy. Setup is idempotent bootstrap, not a versioned migration framework.
- Provider-approved intake/record-sharing policies, retention and consent workflow, security review, audit identity, and clinical review of urgency messaging. Do not store real patient records in this demo.
- SMS/email/telephony and real call completion integrations. Current messaging is in-app only, and click counts are not completed calls.
- Continuous server-side spreadsheet synchronization if it must run with no administrator browser open. Current polling is visible and opt-in; failed imports leave the last valid data intact.
- Address geocoding and live route/travel-time integration for arbitrary locations. Current locations and coordinates are bounded demo data.
- Optional AI API key and evaluation of extraction behavior. Default rules, conservative red flags, and DB-grounded results work without an AI service. The optional external API path was implemented but not exercised with a live key.
- Real payments/subscriptions, appointment confirmation, file/medical-record uploads, and interoperable clinical-record integrations. The free pilot and planned subscription model are presented; billing is not implemented.
