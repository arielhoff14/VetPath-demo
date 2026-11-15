# All-hospital demo inquiry workflow

Every directory listing now has a **Send inquiry** action on its card and details page when `DEMO_MODE=true`. Real nonpartner listings retain their public-source identity and partnership flag. Inquiry access is explicitly a simulated VetPath workspace capability, not an actual hospital partnership or external delivery.

## Demonstrate it

1. Enter a new scenario in the owner guide, for example “My bearded dragon is limping in San Jose for two hours. Please help find urgent care.” Review the species/subtype and select **Veterinary Emergency Group (San Jose)**, or another appropriate hospital.
2. Choose **Send inquiry**, enter fictional owner/pet/contact information and submit. The inquiry is saved under the selected hospital and appears in **Your care requests**.
3. Click **Clinic workspace** in the same browser tab to open that receiving hospital automatically. Alternatively, open an independent browser profile and select the same hospital in the clinic selector to keep both sides visible simultaneously.
4. Open the case in **Incoming inquiries**. Acknowledge it, record arrival, select a clinical assessment and workload, start care and complete the visit. Automatic status messages and custom in-app messages reach the owner. Clinical notes remain staff-only.
5. Refresh both sessions. Completed cases remain in the receiving clinic's **Completed** queue and the owner's care requests. Return to **Find care** to see the original owner's requests in a single-browser presentation.
6. Handoffs can target any enabled clinic workspace in demo mode. The destination clinic reviews and accepts the request. Species mismatches and current intake restrictions are checked at request and acceptance.

## Guardrails and connected behavior

- Server-side provider existence, species/subtype, requested-service and current intake restrictions apply to every inquiry. Unknown species capability requires an explicit acknowledgement. Unknown intake status permits a demo inquiry but never guarantees acceptance or travel suitability.
- Explicit daily closure and fresh legacy **At capacity** status block new inquiries. High activity alone does not block inquiries. A stale tab cannot bypass the server restriction.
- Submission keys and payload hashes protect retries from creating duplicates. Version checks reject stale staff edits. Owners see only their session's cases; clinic sessions see only the selected clinic's records.
- All inquiries, notes, messages, stage changes, arrival/completion timestamps and analytics events are real PostgreSQL writes. No SMS, email, calls or actual hospital notifications are sent.
- Automatic activity calculations remain available for the three configured fictional clinics. Public listings with no resource feed retain unconfirmed activity; receiving an inquiry does not fabricate their resources or wait times.
- With `DEMO_MODE=false`, nonpartner inquiry access remains disabled. This change does not enable an unauthorised real clinic integration.

## Verification

`tests/e2e/all-inquiries.spec.ts` checks card/detail inquiry actions for every listing. It submits a newly worded reptile scenario to nonpartner VEG San Jose in the UI, verifies the correct queue in an independent clinic session, tests acknowledgement, private notes, custom/automatic owner messages, arrival, clinical review, completion and refresh persistence, and checks the same-tab clinic shortcut.

A separate exhaustive test submits and completes one case for every database provider, verifies each provider ID, saved timestamps and exactly-once submission/arrival/completion events directly in PostgreSQL, and retries each original submission to verify idempotency. These mutations run only on isolated local/CI PostgreSQL. The public workflow checks all inquiry actions without creating dozens of public test cases.

The unit tests verify demo vs non-demo access and closure behavior. Existing price/activity/distance filters, species/ZIP discovery, imports, handoffs and mobile tests continue to run in the full suite.

AI extraction remains optional. Without an API key, the interface explicitly discloses its structured fallback; inquiry routing and clinic workflows operate independently of an external AI service.
