import { addressLocation, applySourceFields } from "./directory";
import { parse } from "csv-parse/sync";
import type { PoolClient } from "pg";
import { normalizedPhone } from "./domain";
export function parseSheet(csv: string) {
  const rows: string[][] = parse(csv, {
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  });
  const header = rows.findIndex(
    (r) => r.includes("Hospital") && r.includes("Interview ID"),
  );
  if (header < 0)
    throw new Error(
      "Expected the interview tracker columns: Interview ID and Hospital.",
    );
  return rows
    .slice(header + 1)
    .filter((r) => r[rows[header].indexOf("Hospital")]?.trim())
    .map((row) =>
      Object.fromEntries(rows[header].map((k, i) => [k, row[i]?.trim() || ""])),
    );
}
const known: Record<string, [number, number]> = {
  "PVES-001": [37.893, -122.118],
  "RVS-002": [37.772, -122.415],
  "MVSV-004": [37.232, -121.774],
  "MVSV-005": [37.232, -121.774],
};
export async function importSheet(
  client: PoolClient,
  csv: string,
  source: string,
) {
  await client.query("SELECT pg_advisory_xact_lock(746381)");
  const rows = parseSheet(csv);
  if (!rows.length || rows.length > 2000)
    throw new Error("Import must contain 1–2000 hospital rows.");
  let merged = 0;
  for (const row of rows) {
    const sid = row["Interview ID"];
    if (!sid) throw new Error("Every hospital needs an Interview ID.");
    const phone = normalizedPhone(row["Hospital phone"] || "");
    const existing = await client.query(
      `SELECT p.* FROM providers p LEFT JOIN interviews i ON i.provider_id=p.id WHERE i.source_id=$1 OR ($2<>'' AND regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')=$2) OR (lower(p.name)=lower($3) AND lower(p.city)=lower($4)) LIMIT 1`,
      [sid, phone, row.Hospital, row.City],
    );
    const prev = existing.rows[0];
    const id = prev?.id || sid.toLowerCase();
    if (prev) merged++;
    const scope = row["Capability / scope"];
    const cat = /specialty only/i.test(row["Accepts unscheduled emergencies?"])
      ? "Specialty"
      : /emergency/i.test(row["Hospital type"])
        ? "Emergency"
        : "General practice";
    const services = [
      "Emergency",
      "Surgery",
      "Ultrasound",
      "Neurology",
      "Internal medicine",
      "Radiography",
      "Oxygen support",
    ].filter(
      (s) =>
        scope.toLowerCase().includes(s.toLowerCase()) ||
        (s === "Neurology" && /neuro/i.test(scope)),
    );
    const fields: Record<string, unknown> = {
      name: row.Hospital,
      city: row.City,
      category: cat,
    };
    if (phone.length === 10) fields.phone = phone;
    if (
      row["Hospital street address"] &&
      !/not verified/i.test(row["Hospital street address"])
    )
      fields.address = row["Hospital street address"];
    if (scope) {
      fields.scope = scope;
      fields.services = services;
    }
    if (row["ER access / hours"]) fields.hours = row["ER access / hours"];
    if (row["Pricing approach"])
      fields.cost_note =
        row["Pricing approach"] +
        " · Interview-reported; not a current quote. Confirm with the clinic.";
    fields.source_url = row["Contact source"];
    fields.website = row["Contact source"];
    fields.source_checked = row["Contact checked"] || null;
    fields.source_notes = row["Contact verification notes"];
    fields.source_kind = "spreadsheet";
    if (!prev) {
      const coords = known[sid];
      await client.query(
        `INSERT INTO providers(id,name,city,category,lat,lng) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          id,
          row.Hospital,
          row.City,
          cat,
          coords?.[0] ?? null,
          coords?.[1] ?? null,
        ],
      );
    }
    if (fields.address)
      Object.assign(fields, addressLocation(String(fields.address)));
    if (prev && id !== sid.toLowerCase()) delete fields.name;
    await applySourceFields(client, id, prev, fields);
    await client.query(
      `INSERT INTO interviews(source_id,provider_id,raw) VALUES($1,$2,$3) ON CONFLICT(source_id) DO UPDATE SET raw=$3,imported_at=now()`,
      [sid, id, row],
    );
  }
  await client.query(
    `INSERT INTO imports(source,rows_count,merged_count) VALUES($1,$2,$3)`,
    [source, rows.length, merged],
  );
  await client.query(
    `INSERT INTO audit(entity,entity_id,action,actor,detail) VALUES('import','sheet','Spreadsheet imported','admin',$1)`,
    [{ rows: rows.length, merged }],
  );
  return { rows: rows.length, merged, providers: rows.length - merged };
}
