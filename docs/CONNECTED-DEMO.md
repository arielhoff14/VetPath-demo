# Connected care demonstration

This demo uses real PostgreSQL writes with fictional cases. It is not a live intake service.

## Present without coaching

1. Open **Demo tools → Reset fictional clinic workflows**, check the confirmation and reset. Public hospital records remain intact. Previous practice-clinic cases are archived, preserving messages and audit history.
2. In an owner browser profile, enter a new scenario such as “My dog has been limping after a walk for two hours near 95112. I need urgent care.” Review the editable filters and factual match reasons. Choose **Harbor Pet Urgent Care → Send inquiry**. Use a unique fictional pet name and an `example.test` contact.
3. In a separate browser profile or incognito session, open **Clinic workspace**. Harbor is the default practice clinic. The inquiry appears in **Incoming inquiries**; activity is still 50%.
4. Open **Review → Acknowledge inquiry → Record arrival**. The owner's request updates automatically. Arrival changes activity to 75%. Choose **Urgent** as the fictional staff assessment and **Intensive** workload, then **Record clinical review & start care**. Activity becomes 100%.
5. Select **Complete visit**. Activity returns to 50%; the owner sees **Visit complete**. Refresh both sessions. The completed case remains under **Completed** and in the owner's care requests.
6. **Review resources & acceptance** opens editable rooms and on-duty staffing, a separate intake closure, and overrides with mandatory reasons and expiry. The Team coverage tab edits the same staffing records. A confirmation older than 60 minutes shows unconfirmed activity.
7. Try Willow in San Jose for rabbits/birds/reptiles, or Valley in San Jose for farm animals. Dog/Cat clinics reject an exotic inquiry. The server rejects closed-clinic inquiries even if a stale browser still shows a button.

Every view polls at four-second intervals. Two tabs sharing one browser profile also share the role cookie; use independent profiles for a two-sided presentation.

## Demonstration assumptions

| Practice clinic | Rooms | Doctors | Clinical support | Baseline workload | Effective capacity | Activity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Harbor | 4 | 2 | 4 | 4 | 8 | 50%, green |
| Willow | 3 | 3 | 3 | 4 | 6 | 67%, yellow |
| Valley | 6 | 2 | 4 | 8 | 8 | 100%, red |

Capacity = min(rooms × 2, doctors × 4, clinical support × 2). Arrived/in-care patients contribute Light=1, Standard=2, Intensive=4. Inquiries contribute zero. Green is below 60%, yellow is 60–84%, red is 85% or higher. Overrides do not change the underlying calculation and cannot make stale/zero-capacity resources confirmed. Closure lasts through the current Pacific calendar day. Activity does not establish clinical urgency, waiting time, appointment availability, or fitness for travel.

## Verification and video

```sh
# Use an isolated test database, not a live clinic database.
export DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/vetpath_test
npm run db:setup
npm test
npm run build
npm start -- --port 3010
# In another terminal with the same DATABASE_URL:
BASE_URL=http://127.0.0.1:3010 npm run test:e2e
```

`tests/e2e/connected.spec.ts` queries PostgreSQL directly: intake identity and routing, species, arrival/review/completion timestamps, workload, staff counts, messages and exactly-once workflow events. It also checks concurrent duplicate submissions, mismatched species, clinic restrictions, optimistic conflicts, expired overrides, stale data, resource recalculation and clinic isolation. Other browser tests cover source import conflicts, addresses/ZIPs, owner edits, messaging, handoffs and mobile discovery.

To record an actual local walkthrough, install Playwright Chromium/ffmpeg and system ffmpeg, then run:

```sh
CHROMIUM_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")" \
BASE_URL=http://127.0.0.1:3010 node scripts/record-connected-demo.mjs
node scripts/render-demo.mjs
```

The six chronological chapters are cut from continuous Playwright videos of independent owner and clinic sessions. Captions are added as overlays; product data is not simulated in the DOM. The recording starts before a unique inquiry is created. Its manifest stores record IDs, timestamps, calculation results and event deltas. The GitHub **Verify and record public demo** workflow repeats this against the public Railway deployment and publishes MP4/manifest release assets. It resets only the three fictional practice clinics before recording.

## Genuine limitations

- The live deployment has no OpenAI API key. It explicitly shows a structured rule-based helper; it is not presented as a working LLM. Optional OpenAI extraction is implemented with validated output, missing-information prompts and emergency-preserving fallback. Configured responses and failure behavior are tested with mocks; live model quality is not verified. Receiving summaries are structured from owner-supplied fields and remain subject to veterinary review.
- Demo staff access is intentionally selectable. Real authentication, clinic identity verification and account recovery are not implemented. Owner access is tied to a 24-hour session cookie.
- No real SMS, email, calls, appointment booking, payment, live clinic capacity feed or travel-time service is connected. Real listings have callable phone and Google Maps links; fictional practice clinics deliberately have neither.
- The three practice clinics have invented resources and cases, clearly labeled. Public hospitals retain sourced facts and explicit unknowns. Historical source checks are not current operational confirmation.
- Google Sheet synchronization is admin-initiated or polls while the admin page is open; no continuous background job is provisioned. Protected edits use explicit conflict resolution.
- The logo asset is a cleaned rendering of the supplied inline logo; an original vector/source asset would improve exact brand fidelity.
- The judging rubric attachment was not available in this workspace. Usability, execution, AI honesty and demonstration quality were reviewed against the user's stated goals; no rubric feature was added.

The [species audit](SPECIES-AUDIT.md) details source corrections, real San Jose providers, and fictional clinic species coverage.
