import { upgradeFees } from "../lib/fees";
import { upgradeSpeciesDirectory } from "../lib/species-upgrade";
import { seedFictionalClinics } from "../lib/demo";
import { readFileSync } from "node:fs";
import { pool } from "../lib/db";
import {
  importDirectory,
  applySourceFields,
  addressLocation,
} from "../lib/directory";
import { importSheet } from "../lib/importer";
async function main() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(readFileSync("data/schema.sql", "utf8"));
    if (!(await c.query("SELECT id FROM providers LIMIT 1")).rowCount) {
      await importSheet(
        c,
        readFileSync("data/hospitals.csv", "utf8"),
        "Original Google Sheets snapshot · 2026-11-14",
      );
      const local = [
        {
          id: "sage-sf",
          name: "SAGE Veterinary Centers",
          category: "Emergency",
          phone: "4155660540",
          address: "600 Alabama Street, San Francisco, CA 94110",
          lat: 37.7613,
          lng: -122.412,
          services: ["Emergency", "Specialty"],
          species: [],
          hours: "24/7 emergency care",
          scope:
            "Emergency and specialty hospital. Specific specialty and species availability must be confirmed by phone.",
          source: "https://www.sagecenters.com/locations",
        },
        {
          id: "ocean-avenue",
          name: "Ocean Avenue Veterinary Hospital",
          category: "Emergency",
          phone: "4155865327",
          address: "1001 Ocean Avenue, San Francisco, CA 94112",
          lat: 37.7233,
          lng: -122.4534,
          services: ["Emergency", "General practice"],
          species: ["Dog", "Cat"],
          hours: "24/7 emergency care",
          scope:
            "Emergency and routine care for dogs and cats. Veterinarian on site around the clock according to the hospital website.",
          source: "https://oceanavevethosp.com/",
        },
        {
          id: "sf-vet",
          name: "SF Veterinary Hospital",
          category: "General practice",
          phone: null,
          address: "2001 Harrison Street, San Francisco, CA",
          lat: 37.7643,
          lng: -122.4133,
          services: ["Urgent care", "General practice"],
          species: ["Dog", "Cat"],
          hours: "Same-day urgent care during clinic hours; call to confirm",
          scope:
            "Same-day urgent care for dogs and cats during opening hours. Critical and after-hours emergencies referred to a 24-hour hospital.",
          source: "https://sfvethospital.com/faqs/",
        },
      ];
      for (const p of local)
        await c.query(
          `INSERT INTO providers(id,name,city,category,phone,address,lat,lng,species,services,hours,scope,source_url,website,source_checked,source_notes) VALUES($1,$2,'San Francisco, CA',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,'2026-11-14','Public website listing. Live intake and current pricing not verified.')`,
          [
            p.id,
            p.name,
            p.category,
            p.phone,
            p.address,
            p.lat,
            p.lng,
            p.species,
            p.services,
            p.hours,
            p.scope,
            p.source,
          ],
        );
      // Partnership and intake statuses are explicitly simulated, never statements about actual clinics.
      await c.query(
        `UPDATE providers SET partner=true, simulated=true, availability='Accepting',availability_at=now() WHERE id='sage-sf'`,
      );
      for (const p of [
        {
          pet: "Milo",
          owner: "Alex Morgan",
          species: "Dog",
          concern: "Vomiting since this morning; alert and drinking water",
          stage: "New",
          urgency: "Unassessed",
        },
        {
          pet: "Luna",
          owner: "Jordan Lee",
          species: "Cat",
          concern: "Limping on left front leg",
          stage: "Reviewing",
          urgency: "Urgent",
        },
        {
          pet: "Oliver",
          owner: "Sam Chen",
          species: "Dog",
          concern: "Follow-up after overnight observation",
          stage: "In care",
          urgency: "Routine",
        },
      ]) {
        await c.query(
          `INSERT INTO intakes(provider_id,owner_session,owner_name,pet_name,species,concern,contact,stage,urgency) VALUES('sage-sf','demo-seed',$1,$2,$3,$4,'demo@example.test',$5,$6)`,
          [p.owner, p.pet, p.species, p.concern, p.stage, p.urgency],
        );
      }
      await c.query(
        `INSERT INTO coverage(provider_id,name,role,shift) VALUES('sage-sf','Dr. Taylor Kim','Emergency veterinarian','8:00 AM – 6:00 PM'),('sage-sf','Jamie Rivera','Registered veterinary technician','8:00 AM – 4:00 PM'),('sage-sf','Casey Brooks','Client care coordinator','10:00 AM – 6:00 PM')`,
      );
    }
    await c.query("SELECT pg_advisory_xact_lock(746381)");
    if (
      !(
        await c.query(
          "SELECT id FROM data_migrations WHERE id='regional-directory-v1'",
        )
      ).rowCount
    ) {
      await importDirectory(
        c,
        readFileSync("data/pricing-comparison.csv", "utf8"),
        readFileSync("data/website-audit.csv", "utf8"),
        "Regional directory · Pricing Comparison + Website Audit · 2026-11-15",
      );
      const sf = (await c.query("SELECT * FROM providers WHERE id='sf-vet'"))
        .rows[0];
      if (sf) {
        const address = "2001 Harrison Street, San Francisco, CA 94110";
        await applySourceFields(c, sf.id, sf, {
          address,
          ...addressLocation(address),
          address_checked: "2026-11-15",
        });
      }
      await c.query(
        "INSERT INTO data_migrations(id) VALUES('regional-directory-v1')",
      );
    }
    if (
      !(
        await c.query(
          "SELECT id FROM data_migrations WHERE id='connected-workflows-v2'",
        )
      ).rowCount
    ) {
      await c.query(
        `UPDATE providers SET species_subtypes=ARRAY(SELECT s FROM unnest(species) s WHERE s IN ('Rabbit','Bird','Reptile')),species=ARRAY(SELECT DISTINCT CASE WHEN s IN ('Rabbit','Bird','Reptile') THEN 'Exotics' ELSE s END FROM unnest(species) s)`,
      );
      await c.query(
        `UPDATE intakes SET species_subtype=species,species='Exotics' WHERE species IN ('Rabbit','Bird','Reptile')`,
      );
      await c.query(
        `UPDATE coverage SET role_type=CASE WHEN role ILIKE '%veterinarian%' THEN 'doctor' WHEN role ILIKE '%technician%' THEN 'clinical_support' ELSE 'nonclinical' END`,
      );
      await seedFictionalClinics(c);
      await c.query(
        "INSERT INTO data_migrations(id) VALUES('connected-workflows-v2')",
      );
    }
    if (
      !(
        await c.query(
          "SELECT id FROM data_migrations WHERE id='species-directory-v3'",
        )
      ).rowCount
    ) {
      await upgradeSpeciesDirectory(c);
      await c.query(
        "INSERT INTO data_migrations(id) VALUES('species-directory-v3')",
      );
    }
    if (
      !(
        await c.query(
          "SELECT id FROM data_migrations WHERE id='owner-filters-fees-v4'",
        )
      ).rowCount
    ) {
      await upgradeFees(c);
      await c.query(
        "INSERT INTO data_migrations(id) VALUES('owner-filters-fees-v4')",
      );
    }
    await c.query("COMMIT");
    console.log("PostgreSQL schema and sourced demo data ready.");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
main();
