# Species directory audit — November 15, 2026

The live API and original stored spreadsheet records were compared with the current Pricing Comparison and Website Audit tabs. The importer recognized individual animal words but silently dropped the broad label **exotics**. For example, VEG San Jose's spreadsheet cell is `dogs, cats, exotics`; the previous stored list was Dog/Cat. Website-audit species evidence was displayed as free text but did not enrich searchable species.

## Corrections

- Import generic exotics, rabbits, birds/avians, reptiles/lizards, pocket pets/small mammals and affirmative farm animal labels into the canonical groups/subtypes.
- Enrich species from affirmative branch-specific website-audit statements. Never infer local exotic care from a national menu, staff interests or a statement that evidence was not found.
- Preserve the complete original Animals Treated text and website species limitations in `species_evidence`, visible in owner provider details. Conditional stabilization is not guaranteed intake.
- Keep incomplete public lists distinct from exhaustive lists. A missing subtype on a non-exhaustive list is unconfirmed; an explicit Dog/Cat-only source excludes exotic matching. Generic Exotics searches do not require choosing a subtype.
- Negative clauses such as `No large animals like cows, horses, or giraffes` remain evidence and do not create accepted farm species.
- Upgrade existing databases from their own retained `directory_sources` rows, preserving newer source data and staff-protected edits. Full and pricing-only imports retain the audited species data and do not duplicate providers.

## San Jose public listings

| Provider | Evidence | Published species scope |
| --- | --- | --- |
| VEG San Jose | Original spreadsheet; [official branch page](https://www.veg.com/locations/california/san-jose) | Dog, Cat, Exotics; audit specifically names avians/reptiles. Other exotic subtypes require confirmation. |
| ARCHVET — Winchester | [Official services/emergency page](https://archvet.com/emergencies); [branch locations](https://archvet.com/locations) | Dogs, cats, rabbits, birds, reptiles and small mammals. Winchester is open during published hours, not 24/7. No exotic-care assumption is applied to Santa Teresa. |
| Alum Rock Animal Hospital | [Official homepage](https://alumrockanimalhospital.com/) | Dogs, cats, birds, pocket pets and exotics; urgent visits advertised. Other subtype capability and current acceptance require a call. |

ARCHVET and Alum Rock are new, separately sourced public listings, not invented spreadsheet records or partners. They have public phone/address/ZIP and source dates; no current intake feed is connected. Coordinates use labeled ZIP centroids rather than fabricated street-level precision. MedVet Silicon Valley, Mountain View and Campbell remain Dog/Cat-only per the spreadsheet; national exotics pages are not treated as local admission evidence.

Regional corrections also cover VEG Sacramento's broad group (branch address still unknown), VEG San Ramon (Dog/Cat and exotic subtypes without importing its excluded large animals), VEG Larkspur's conditional stabilization statement, Pacific's conditional exotic care, PETS rabbits, Bishop Ranch's published exotic service, and Solano-Napa's Dog/Cat statement.

## Fictional San Jose balance

All three existing practice clinics are now located in San Jose. The migration moves clinic records and broadens the declared demo species without deleting, archiving, or reassigning any patient cases.

| Fictional clinic | Exotic subtypes | Other species | Reset baseline activity |
| --- | --- | --- | --- |
| Harbor | Rabbit, Bird | Dog, Cat | 50%, green |
| Willow | Rabbit, Bird, Reptile, Small mammal | Dog, Cat | 67%, yellow |
| Valley | Reptile, Small mammal | Dog, Cat, Farm animals | 100%, red |

These are explicitly fictional practice locations with no real telephone or travel destination. Use **Demo tools → Reset fictional clinic workflows** to restore their resource/workload baselines. Existing public provider records are unaffected by that reset.

## Verification

- 18 unit tests, including all 28 source rows, negative clauses, branch limitations and generic/subtype matching.
- Production browser suite includes San Jose / 95112 / 95131 exotic filters, real-vs-fictional flags, original evidence, subtype mismatches and PostgreSQL records.
- A full import followed by a pricing-only import was compared directly in PostgreSQL: species groups, subtypes, evidence and provider count were unchanged.
- The migration was run on an existing database containing patient cases; intake count was identical before/after.
