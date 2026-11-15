import type { PoolClient } from "pg";
import { directorySpeciesFields } from "./species-import";
import { applySourceFields, addressLocation } from "./directory";
import additions from "../data/san-jose-species-evidence.json";
import { demoClinics } from "./demo";
export async function upgradeSpeciesDirectory(c: PoolClient) {
  // Upgrade the records actually imported into this database, preserving newer source edits.
  const sources = (await c.query("SELECT * FROM directory_sources")).rows;
  for (const source of sources) {
    const previous = (
      await c.query("SELECT * FROM providers WHERE id=$1", [source.provider_id])
    ).rows[0];
    await applySourceFields(
      c,
      source.provider_id,
      previous,
      directorySpeciesFields(source.pricing_raw, source.audit_raw),
    );
  }
  for (const listing of additions) {
    const previous = (
      await c.query(
        "SELECT * FROM providers WHERE id=$1 OR regexp_replace(coalesce(phone,''),'[^0-9]','','g')=$2 LIMIT 1",
        [listing.id, listing.phone],
      )
    ).rows[0];
    const id = previous?.id || listing.id;
    if (!previous)
      await c.query(
        "INSERT INTO providers(id,name,city,category) VALUES($1,$2,$3,$4)",
        [id, listing.name, "San Jose, CA", listing.category],
      );
    const { id: unused, checked, ...fields } = listing;
    await applySourceFields(c, id, previous, {
      ...fields,
      city: "San Jose, CA",
      ...addressLocation(listing.address),
      address_checked: checked,
      website: listing.source_url,
      source_checked: checked,
      source_kind: "public",
      species_list_complete: false,
    });
  }
  // Reposition existing fictional clinics without deleting or archiving any patient cases.
  for (const p of demoClinics)
    await c.query(
      "UPDATE providers SET city=$2,lat=$3,lng=$4,species=$5,species_subtypes=$6,coordinate_source='Fictional demo location; not a care destination',version=version+1,updated_at=now() WHERE id=$1 AND fictional=true",
      [p.id, p.city, p.lat, p.lng, p.species, p.subtypes],
    );
  await c.query(
    "INSERT INTO audit(entity,entity_id,action,actor,detail) VALUES('directory','species-v3','Species source audit and San Jose demo balance applied','migration',$1)",
    [
      {
        reviewed: sources.length,
        additionalPublicProviders: additions.length,
        fictionalClinics: demoClinics.map((p) => p.id),
      },
    ],
  );
}
