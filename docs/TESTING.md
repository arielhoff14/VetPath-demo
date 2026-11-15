# Verification evidence

Verified in the provided Cloud workspace on November 14, 2026 (Pacific time), using real PostgreSQL 17 and Chromium through Playwright.

## Automated checks

- TypeScript: `npm run typecheck` — passed.
- Domain tests: `npm test` — 6 passed. Emergency-first ranking, stale availability, species uncertainty, legal stage transitions, five-row tracker parsing, invalid import rejection.
- Production compilation: `npm run build` — passed. Next.js server API routes and owner application generated successfully.
- Dependency audit: `npm audit --audit-level=moderate` — 0 vulnerabilities in the installed dependency graph at verification time.
- Playwright: 6 scenarios passed against the production server and an independent PostgreSQL test database, using separate owner/clinic/admin browser contexts.

| Scenario                 | Verified behavior                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner discovery          | Chat emergency handling; comparison; real tel/Google Maps URLs; intake submission; unrelated owner denied access                                                                                                 |
| Mobile                   | 390×844 layout has no horizontal document overflow; simulated location permission produces coordinate-based discovery                                                                                            |
| Clinic workflow          | Owner intake arrives in another session; assessment and stage updates; private clinical notes; owner-visible messages; staff-confirmed arrival; capacity propagates to discovery; staff coverage updates         |
| Data management          | Five original interviews retained; repeated import does not duplicate hospitals; protected staff edit becomes a conflict; applying source value propagates; stale version rejected; owner cannot edit directory  |
| Handoff                  | Admin enables simulated receiving partner; receiving clinic accepts; patient ownership moves; sending clinic loses record access; owner retains access                                                           |
| Mutations and validation | Owner edits reach clinic; clinic species edit reaches directory; hospital creation reaches owner results; duplicate hospital rejected; invalid intake and illegal stage rejected; cross-origin mutation rejected |

The first five scenarios were run together against the production build (5/5, 23.3 seconds). The additional mutation scenario passed separately (1/1, 7 seconds). Tests are repeatable in CI and use a disposable database. `BASE_URL=http://127.0.0.1:3001 npm run test:e2e` was used for production browser checks. Later packaging verification is recorded in the pull request and CI run.

## Docker packaging

The Docker image compiled successfully using Node 22. The managed environment required a temporary BuildKit CA secret for npm installation; the CA was not committed or added to the image. Starting the built container was blocked by the workspace disk limit (`ENOSPC`) before application startup, so container runtime verification is incomplete. The built image/cache was removed to recover disk space; the PostgreSQL volume and application files were retained.

## Live source check

A live Google Sheets sync returned HTTP 200 with `{ "rows": 5, "merged": 5, "providers": 0 }`. The original snapshot is also retained as `data/hospitals.csv` for offline repeatability. The Cloud environment requires Node's environment-proxy support; launcher scripts enable it without disabling TLS verification.

## Visual inspection

Screenshots are in `docs/screenshots/` for owner desktop, owner mobile, clinic, and insights. Supporting text was enlarged after the first visual pass, and fonts are self-hosted to avoid a browser dependency on Google Fonts.

## Limits

- Optional external AI extraction has no live API key and was not exercised against the AI service; the default rule-based assistant was tested.
- Link targets were verified, but no real clinic was called, no SMS/email was sent, and no actual veterinary visit occurred.
- Maps are working outbound Google Maps links; approximate distance calculations are not live route estimates.
- No persistent production hosting was provisioned. Demo authentication is scoped and tested, but intentionally provides simulated staff access rather than real organizational identity.
