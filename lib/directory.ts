import { directoryFeeFields } from "./fees";
import { directorySpeciesFields } from "./species-import";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { PoolClient } from "pg";
import addressEvidence from "../data/address-evidence.json";
import { locate } from "./locations";
import { normalizedPhone } from "./domain";

export function parseDirectoryCsv(csv: string, kind: "pricing" | "audit") {
  const rows: string[][] = parse(csv, {
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  });
  const key =
    kind === "pricing"
      ? "Hospital street address"
      : "Official website / location";
  const h = rows.findIndex((r) => r.includes(key));
  if (h < 0)
    throw new Error(
      `Expected ${kind === "pricing" ? "Pricing Comparison" : "Website Audit"} columns including ${key}.`,
    );
  const headers = [...rows[h]];
  // Google visualization CSV can combine preamble cells into its first header.
  headers[0] = kind === "pricing" ? "Hospital" : "Hospital / source-row label";
  if (kind === "pricing" && headers[3] === "Animals Treated") {
    if (!headers[2]) headers[2] = "Fee recorded on";
    if (!headers[4]) headers[4] = "Exam fee";
  }
  const result = rows
    .slice(h + 1)
    .filter((r) => r[0]?.trim())
    .map((r) =>
      Object.fromEntries(headers.map((k, i) => [k, r[i]?.trim() || ""])),
    );
  if (!result.length || result.length > 2000)
    throw new Error("Import must contain 1–2000 hospital rows.");
  return result;
}
const canonical = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const urlKey = (s: string) => s.trim().replace(/\/$/, "");
const cleanNames: Record<string, string> = {
  "North Penninsula Veterinary Emergency Clinic":
    "San Mateo Veterinary Emergency (formerly North Peninsula)",
  "Solan-Napa Pet Specialty & ER": "Solano-Napa Pet Emergency Clinic",
  "Pet Emergency & Specialty Center or Marin":
    "Pet Emergency & Specialty Center of Marin",
  "VCA Antioch": "VCA East Bay Veterinary Emergency",
  "VCA Encina (in Walnut Creek)": "VCA Encina Veterinary Medical Center",
  "Omega Veterinary Specialists": "Omega Veterinary Group",
};
export function addressLocation(address: string) {
  const evidence = addressEvidence.find(
    (e) => canonical(e.address) === canonical(address),
  );
  const coords = evidence ? [evidence.lat, evidence.lng] : locate(address);
  return {
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
    coordinate_source:
      evidence?.coordinate_source ||
      (coords ? "GeoNames ZIP centroid (approximate)" : "Location unverified"),
    address_checked: evidence?.checked || null,
  };
}
export async function applySourceFields(
  c: PoolClient,
  id: string,
  prev: any,
  fields: Record<string, unknown>,
) {
  for (const [field, value] of Object.entries(fields)) {
    // Location coordinates must describe the retained address, not an incoming conflicting address.
    if (
      ["lat", "lng", "coordinate_source", "address_checked"].includes(field) &&
      prev?.field_overrides.includes("address") &&
      prev.address !== fields.address
    )
      continue;
    if (
      prev?.field_overrides.includes(field) &&
      JSON.stringify(
        Array.isArray(prev[field]) ? [...prev[field]].sort() : prev[field],
      ) !== JSON.stringify(Array.isArray(value) ? [...value].sort() : value)
    ) {
      await c.query(
        `INSERT INTO conflicts(provider_id,field,current_value,incoming_value) SELECT $1,$2,$3::jsonb,$4::jsonb WHERE NOT EXISTS(SELECT 1 FROM conflicts WHERE provider_id=$1 AND field=$2 AND status IN ('pending','kept') AND incoming_value=$4::jsonb AND current_value=$3::jsonb)`,
        [id, field, JSON.stringify(prev[field]), JSON.stringify(value)],
      );
    } else {
      await c.query(`UPDATE providers SET ${field}=$1 WHERE id=$2`, [
        value,
        id,
      ]);
    }
  }
  await c.query(
    "UPDATE providers SET version=version+1,updated_at=now() WHERE id=$1",
    [id],
  );
}
export async function importDirectory(
  c: PoolClient,
  pricingCsv: string,
  auditCsv: string | undefined,
  source: string,
) {
  await c.query("SELECT pg_advisory_xact_lock(746381)");
  const rows = parseDirectoryCsv(pricingCsv, "pricing");
  const audits = auditCsv ? parseDirectoryCsv(auditCsv, "audit") : [];
  let merged = 0;
  for (const row of rows) {
    const name = row.Hospital;
    const key = canonical(name);
    const phone = normalizedPhone(row["Hospital phone"] || "");
    const url = row["Contact source"];
    if (!/^https?:\/\//.test(url))
      throw new Error(`Missing public contact source for ${name}`);
    const address = /not verified/i.test(row["Hospital street address"])
      ? null
      : row["Hospital street address"] || null;
    const city = address?.match(/,\s*([^,]+),\s*CA\s*\d{5}/)?.[1]?.trim();
    let audit = audits.find(
      (a) => canonical(a["Hospital / source-row label"]) === key,
    );
    const existing = await c.query(
      `SELECT p.* FROM providers p LEFT JOIN directory_sources ds ON ds.provider_id=p.id WHERE ds.source_key=$1 OR ($2<>'' AND regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')=$2) OR rtrim(p.source_url,'/')=$3 OR lower(p.name)=lower($4) ORDER BY p.id LIMIT 1`,
      [key, phone.length === 10 ? phone : "", urlKey(url), name],
    );
    const prev = existing.rows[0];
    if (!audit && prev)
      audit = (
        await c.query(
          "SELECT audit_raw FROM directory_sources WHERE source_key=$1 AND provider_id=$2",
          [key, prev.id],
        )
      ).rows[0]?.audit_raw;

    const id =
      prev?.id ||
      "directory-" +
        createHash("sha256").update(key).digest("hex").slice(0, 12);
    if (prev) merged++;
    const scope =
      audit?.["Services found"] ||
      row["Hospital type"] ||
      "Capabilities require confirmation.";
    const category =
      (/specialty/i.test(row["Hospital type"]) &&
        !/emergency/i.test(row["Hospital type"])) ||
      /Remedy/.test(name)
        ? "Specialty"
        : /Bishop Ranch/.test(name)
          ? "Urgent care"
          : /emergency/i.test(scope + row["Hospital type"])
            ? "Emergency"
            : "Specialty";
    const fields: Record<string, unknown> = {
      category,
      source_url: audit?.["Official website / location"] || url,
      website: audit?.["Official website / location"] || url,
      source_kind: "directory",
      source_checked: row["Contact checked"] || null,
      source_notes: `${row["Contact verification notes"]} Pricing Comparison and Website Audit spreadsheet sources; current intake is unknown. ${audit?.["Coverage and identity caveats"] || ""}`,
    };
    // Preserve established identities while adding current names for formerly mislabeled hospitals.
    if (!prev) fields.name = cleanNames[name] || name;
    if (phone.length === 10) fields.phone = phone;
    if (address)
      Object.assign(fields, { address, ...addressLocation(address) });
    if (city) fields.city = city + ", CA";
    Object.assign(fields, directorySpeciesFields(row, audit));
    if (!prev?.field_overrides.includes("exam_fee"))
      Object.assign(fields, directoryFeeFields(row, audit));
    else {
      const fee = directoryFeeFields(row, audit);
      if ("exam_fee" in fee) fields.exam_fee = fee.exam_fee;
    }
    if (audit) {
      fields.scope = `${scope}\nSpecies: ${audit["Species evidence / limits"]} Call to confirm current capability.`;
      fields.services = [
        "Emergency",
        "Urgent care",
        "Specialty",
        "Neurology",
        "Surgery",
        "Ultrasound",
        "General practice",
        "Internal medicine",
        "Radiography",
        "Oxygen support",
      ].filter(
        (s) => scope.toLowerCase().includes(s.toLowerCase()) || s === category,
      );
      fields.cost_note = `${audit["Price evidence / limits"]} Public-page audit dated ${audit["Checked on"] || "unknown"}; not a current quote. Ask the clinic for an estimate.`;
    }
    if (!prev) {
      await c.query(
        "INSERT INTO providers(id,name,city,category,hours) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          fields.name,
          city ? city + ", CA" : "Sacramento, CA · branch unconfirmed",
          category,
          /24\/7/.test(row["Hospital type"] + scope)
            ? "24/7 emergency care · published listing; call to confirm"
            : "Call to confirm hours",
        ],
      );
    }

    await applySourceFields(c, id, prev, fields);
    await c.query(
      `INSERT INTO directory_sources(source_key,provider_id,pricing_raw,audit_raw) VALUES($1,$2,$3,$4) ON CONFLICT(source_key) DO UPDATE SET pricing_raw=$3,audit_raw=COALESCE($4,directory_sources.audit_raw),imported_at=now()`,
      [key, id, row, audit || null],
    );
  }
  await c.query(
    "INSERT INTO imports(source,rows_count,merged_count) VALUES($1,$2,$3)",
    [source, rows.length, merged],
  );
  await c.query(
    "INSERT INTO audit(entity,entity_id,action,actor,detail) VALUES('import','directory','Regional directory imported','admin',$1)",
    [{ rows: rows.length, merged, auditRows: audits.length }],
  );
  return {
    rows: rows.length,
    merged,
    providers: rows.length - merged,
    auditRows: audits.length,
  };
}
