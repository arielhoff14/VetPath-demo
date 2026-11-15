# Current connected-workflow verification

November 15, 2026: production Next.js build against isolated PostgreSQL, using Chromium and separate browser contexts.

- 15 unit tests: activity thresholds, limiting resources, missing/stale/zero capacity, override expiry, separate acceptance, species/subtypes, AI extraction validation/fallback, emergency priority, imports and regional location matching.
- 10 Playwright scenarios: full owner-to-clinic lifecycle with direct PostgreSQL assertions; duplicate/concurrent submissions; resource and workload changes; stale data; species and acceptance restrictions; clinic isolation; owner edits; private notes and messages; handoffs; import deduplication/conflicts; address/ZIP synchronization; comparison, call/directions targets and mobile geolocation.
- The connected lifecycle asserts **50% → 75% → 100% → 50%**, unique submission/arrival/completion events, four stored automatic owner messages, and saved arrival/review/completion timestamps after both browser sessions refresh.
- TypeScript and production build pass. Live AI API calls are unconfigured; model response parsing and fallback are tested with mocks, not a paid live model.

See [connected demonstration instructions](CONNECTED-DEMO.md). Public video and exact release/CI evidence are linked from the pull request and GitHub releases.

The older verification history below describes earlier versions, not additional current test counts.

---

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
- A public Railway deployment with persistent PostgreSQL is now provisioned. Demo authentication is scoped and tested, but intentionally provides simulated staff access rather than real organizational identity.

## Public deployment verification

The live Railway health endpoint returned HTTP 200 and confirmed PostgreSQL connectivity. The six local production workflow scenarios passed again before deployment. `.github/workflows/record-demo.yml` records the actual public application from a clean GitHub Actions Chromium browser, with normal TLS validation and independent owner/clinic sessions. Its manifest records the assertions and source URL.

Local Cloud Chromium did not trust the environment proxy certificate. A persistent trust-store change was rejected by automatic approval review; no certificate checks were disabled. The public-browser recording runs on GitHub Actions to avoid that environment-specific issue.

Public recording verification completed successfully: [workflow run](https://github.com/arielhoff14/VetPath-demo/actions/runs/43674449931). The four-chapter, 55-second MP4 and its assertion manifest are available in the [public video release](https://github.com/arielhoff14/VetPath-demo/releases/tag/demo-verification-v0.1). All recording assertions passed against the public Railway deployment. The current CI workflow also passed all six browser scenarios and six domain tests.

## Regional directory and ZIP regression coverage

- Domain tests validate 28 source rows from both directory tabs, all 27 identified address coordinate records, 569 supported ZIP codes, city/state spellings, ZIP+4, explicit invalid ZIP behavior, and the unfiltered default.
- Browser tests cover the five expected San Jose-area hospitals; 18 city/ZIP pairs spanning all nine Bay Area counties; clearing location; ZIPs in chat; directory ZIP search; and address changes observed in a separate owner session.
- A separate admin session reimports the directory twice to check deduplication and protected address conflicts, then applies the source address and verifies the ZIP and coordinates return together.
- `Verify live regional searches` runs the non-destructive search regression against the public Railway deployment with normal HTTPS verification. It does not edit public provider addresses or reset public data.
