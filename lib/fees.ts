import type { PoolClient } from "pg";
export function priceNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\$?\s*\d[\d,]*(?:\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function directoryFeeFields(
  row: Record<string, string>,
  audit?: Record<string, string>,
) {
  // Older exports have an unnamed exam-fee column; support both old retained JSON and named/new exports.
  const raw =
    row["Exam fee"] ||
    row["Exam / consultation fee"] ||
    row["Initial exam fee"] ||
    row[""] ||
    "";
  const published = audit?.["Price evidence / limits"] || "";
  let amount: number | null = null,
    note = "";
  const exam = published.match(
    /(?:urgent exam|emergency exam|new neurology consultation)\s*\$([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (exam) amount = priceNumber(exam[1]);
  if (/urgent exam\s*\$110.*emergency exam\s*\$150/i.test(published))
    note = "Urgent exam $110; emergency exam $150.";
  if (amount !== null)
    return {
      exam_fee: amount,
      fee_basis: "published",
      fee_checked: audit?.["Checked on"] || null,
      fee_note: note,
    };
  amount = priceNumber(raw);
  if (amount === null && /\$175 weekdays/.test(row.Notes || "")) {
    amount = 175;
    note = "Weekday exam $175; weekends and after 8 PM $230.";
  }
  return amount === null
    ? {}
    : {
        exam_fee: amount,
        fee_basis: "spreadsheet",
        fee_checked: row["Fee recorded on"] || null,
        fee_note: note,
      };
}
export function feeAmount(p: { exam_fee: unknown }) {
  return p.exam_fee === null || p.exam_fee === undefined
    ? null
    : priceNumber(p.exam_fee);
}
export function formatFee(value: unknown) {
  const n = feeAmount({ exam_fee: value });
  return n === null
    ? "Not listed"
    : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
export async function upgradeFees(c: PoolClient) {
  const rows = (
    await c.query(
      "SELECT p.*,d.pricing_raw,d.audit_raw FROM providers p LEFT JOIN directory_sources d ON d.provider_id=p.id",
    )
  ).rows;
  for (const p of rows) {
    if (p.exam_fee !== null || p.field_overrides.includes("exam_fee")) continue;
    const imported = p.pricing_raw
      ? directoryFeeFields(p.pricing_raw, p.audit_raw)
      : {};
    const demoFees: Record<string, number> = {
      "demo-harbor": 110,
      "demo-willow": 165,
      "demo-valley": 225,
      "public-alum-rock": 95,
      "public-archvet-winchester": 145,
      "sf-vet": 95,
    };
    const fields =
      "exam_fee" in imported
        ? imported
        : {
            exam_fee: demoFees[p.id] ?? 180,
            fee_basis: "demo",
            fee_checked: null,
            fee_note: "",
          };
    await c.query(
      "UPDATE providers SET exam_fee=$2,fee_basis=$3,fee_checked=$4,fee_note=$5,version=version+1,updated_at=now() WHERE id=$1",
      [
        p.id,
        fields.exam_fee,
        fields.fee_basis,
        fields.fee_checked,
        fields.fee_note,
      ],
    );
  }
  await c.query(
    "UPDATE clinic_operations SET verified_at=now(),updated_at=now(),version=version+1 WHERE provider_id IN (SELECT id FROM providers WHERE fictional=true)",
  );
  await c.query(
    "INSERT INTO audit(entity,entity_id,action,actor) VALUES('directory','fees-v4','Imported exam fees and labeled demo fee assumptions','migration')",
  );
}
