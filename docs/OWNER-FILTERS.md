# Owner distance, price and activity filters

All owner filters are visible beside the clinic results. Open for inquiries is the last control.

- **Search radius:** enter a city/ZIP or use browser location, then choose 1–200 miles. Distances are approximate straight-line distances; some sourced locations use ZIP centroids. With no location entered the default list remains all locations.
- **Maximum exam fee:** restrict to clinics with a listed numeric exam fee at or below the selected amount. Unknown fees are excluded when a price cap is active. This is the initial exam/consultation fee, not the total visit or treatment cost.
- **Activity level:** green/lower activity, yellow/busy, red/high activity, or unconfirmed. This uses the connected clinic activity calculation and temporary overrides. Missing/stale activity is unconfirmed. Activity is not a measured wait-time prediction.
- **Sort results:** recommended, closest first, lowest exam fee or lowest activity. A missing price/activity value sorts last. Clinical emergency guidance overrides distance caps, price caps, activity/acceptance filters and convenience sorting, while preserving species eligibility.
- **Open for inquiries:** remains independent of activity and is last in the control order.

## Fee data and editing

All 34 initial provider records now contain numeric exam fees for demonstration. The original spreadsheet's unnamed exam-fee column is imported as a named Exam fee field; old JSON snapshots remain supported. Explicit published exam/consultation amounts are used where the website audit provides them. Treatment/procedure prices and deposits are never mistaken for exam fees. Bishop Ranch's urgent exam is $110, with its $150 emergency exam qualified in details; Oakvet's weekday fee is $175, with after-hours/weekend $230 qualified in details.

The stored `fee_basis` distinguishes spreadsheet, published, staff and demo values; `fee_checked` and `fee_note` preserve qualifiers internally. Cards, comparison and clinic details show a numeric fee without a source URL. Reported fees have a short label; assumed prices on real public listings say **Demo estimate**, and fictional clinics say **Demo fee**. These assumptions do not represent verified hospital quotes.

Fictional reset fees: Harbor **$110**, Willow **$165**, Valley **$225**. Other initial unknown fees receive labeled demo estimates so the demo supports price filtering across the directory.

Staff edit fees in **Clinic workspace → Availability & services → Exam fee**. Administrators can also edit fees in Directory. Changes persist in PostgreSQL and update owner cards and filter results automatically. Staff fee edits are protected from spreadsheet imports and conflicting values are reviewable. Resetting the fictional clinics restores their baseline fees/resources and archives their previous cases; public provider fees are unaffected by reset.

## Verification

- Fee parsing covers legacy/named headers, decimal/zero fees, published-vs-older spreadsheet amounts, exclusions of procedure ranges, and after-hours qualifiers.
- Domain tests compose distance + maximum fee + fresh activity, check unknown values and sorting, and verify clinical emergencies bypass convenience constraints.
- Separate owner/clinic sessions verify that a clinic fee edit removes/adds its card under the active cap; arrival changes activity filtering; completion reverses it; stale data becomes unconfirmed; both sessions retain fees after refresh.
- Direct PostgreSQL assertions check stored fee values and preservation across conflicting imports. Existing patient counts were unchanged by the upgrade.
- Public-site checks exercise city/ZIP searches, prices, sorting, activity filtering, control order and reset behavior without modifying public clinic records.
