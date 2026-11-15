import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import type { PoolClient } from "pg";
import type { Session } from "./auth";
import { allowedStage } from "./domain";
import {
  allSpeciesValues,
  normalizeSpecies,
  speciesMatch,
  speciesLabel,
  exoticTypes,
  farmTypes,
} from "./species";
import { calculateActivity, localDay } from "./activity";
export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function activityFor(
  c: Pick<PoolClient, "query">,
  clinic: string,
) {
  const row = (
    await c.query("SELECT * FROM clinic_activity_inputs WHERE provider_id=$1", [
      clinic,
    ])
  ).rows[0];
  return row
    ? {
        ...calculateActivity({
          ...row,
          verified_at: row.verified_at?.toISOString(),
          updated_at: row.activity_updated_at?.toISOString(),
          override_until: row.override_until?.toISOString(),
        }),
        version: row.version,
        rooms: row.rooms,
        doctors: row.doctors,
        support: row.support,
        closed_on: row.closed_on,
      }
    : null;
}
const inquirySchema = z.object({
  providerId: z.string().min(1),
  ownerName: z.string().trim().min(1).max(120),
  petName: z.string().trim().min(1).max(80),
  species: z.string().refine((s) => allSpeciesValues.includes(s)),
  speciesSubtype: z.string().trim().max(80).default(""),
  concern: z.string().trim().min(5).max(3000),
  duration: z.string().max(120),
  contact: z.string().trim().min(5).max(150),
  requestedService: z.string().max(80).default("Any care"),
  submissionKey: z.string().min(8).max(100).optional(),
  allowUnknownSpecies: z.boolean().default(false),
});
export async function createInquiry(raw: unknown, s: Session) {
  const b = inquirySchema.parse(raw);
  const animal = normalizeSpecies(b.species, b.speciesSubtype);
  if (
    (animal.species === "Exotics" && !exoticTypes.includes(animal.subtype)) ||
    (animal.species === "Farm animals" &&
      !farmTypes.includes(animal.subtype)) ||
    (animal.species === "Other species" && !animal.subtype)
  )
    throw new WorkflowError(
      "Choose the animal type so the clinic can confirm appropriate care.",
    );
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        b.providerId,
        b.ownerName,
        b.petName,
        animal.species,
        animal.subtype,
        b.concern,
        b.duration,
        b.contact,
        b.requestedService,
      ]),
    )
    .digest("hex");
  const key = b.submissionKey || hash;
  return transaction(async (c) => {
    // Provider lock serializes acceptance changes and concurrent inquiry retries.
    const p = (
      await c.query("SELECT * FROM providers WHERE id=$1 FOR UPDATE", [
        b.providerId,
      ])
    ).rows[0];
    const existing = (
      await c.query(
        "SELECT * FROM intakes WHERE owner_session=$1 AND (submission_key=$2 OR (payload_hash=$3 AND archived_at IS NULL AND created_at>now()-interval '10 minutes')) ORDER BY created_at DESC LIMIT 1",
        [s.id, key, hash],
      )
    ).rows[0];
    if (existing) {
      if (existing.payload_hash !== hash)
        throw new WorkflowError(
          "This submission was already used for different details. Start a new inquiry.",
          409,
        );
      return { ...existing, duplicate: true };
    }
    if (!p?.partner)
      throw new WorkflowError(
        "This clinic does not receive online demo inquiries. Contact the clinic directly.",
        409,
      );
    const activity = await activityFor(c, p.id);
    if (activity && !activity.accepting)
      throw new WorkflowError(
        "This clinic is not accepting new patients today. Choose another clinic.",
        409,
      );
    const match = speciesMatch(p, animal.species, animal.subtype);
    if (match === "mismatch")
      throw new WorkflowError(
        "This clinic does not list care for this species. Choose an appropriate clinic.",
        422,
      );
    if (match === "unknown" && !b.allowUnknownSpecies)
      throw new WorkflowError(
        "Species eligibility is unconfirmed. Call the clinic and acknowledge this before sending an inquiry.",
        422,
      );
    if (
      b.requestedService !== "Any care" &&
      p.services.length &&
      !p.services.includes(b.requestedService) &&
      p.category !== b.requestedService
    )
      throw new WorkflowError(
        "The requested service is not listed at this clinic. Update your selection or contact the clinic.",
        422,
      );
    const summary = `Owner-reported inquiry for ${b.petName} (${speciesLabel(animal.species, animal.subtype)}). Concern: ${b.concern} Duration: ${b.duration || "Not supplied — ask the owner"}. Requested service: ${b.requestedService}. Species eligibility: ${match}. Not yet arrived; clinical urgency has not been assessed. Veterinary staff must review the original report.`;
    const r = (
      await c.query(
        `INSERT INTO intakes(provider_id,owner_session,owner_name,pet_name,species,species_subtype,concern,duration,contact,submission_key,payload_hash,requested_service,receiving_summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          p.id,
          s.id,
          b.ownerName,
          b.petName,
          animal.species,
          animal.subtype,
          b.concern,
          b.duration,
          b.contact,
          key,
          hash,
          b.requestedService,
          summary,
        ],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO events(kind,provider_id,metadata) VALUES('intake_submitted',$1,$2)",
      [
        p.id,
        { intakeId: r.id, species: animal.species, subtype: animal.subtype },
      ],
    );
    return { ...r, duplicate: false };
  });
}
const stageSchema = z.object({
  version: z.number().int(),
  stage: z.enum([
    "New",
    "Reviewing",
    "Expected",
    "Arrived",
    "In care",
    "Discharged",
    "Transferred",
  ]),
  urgency: z.enum(["Unassessed", "Routine", "Urgent", "Critical"]),
  workload: z.enum(["Light", "Standard", "Intensive"]).optional(),
  clinicalReviewed: z.boolean().optional(),
});
const stageMessages: Record<string, string> = {
  Reviewing:
    "The clinic has acknowledged your inquiry. You are not checked in yet. Call before travelling.",
  Expected:
    "The clinic is expecting you. Call to confirm travel instructions; this is not an appointment guarantee.",
  Arrived:
    "The clinic has recorded your arrival. Veterinary staff will assess clinical urgency.",
  "In care": "The veterinary team has reviewed your case and started care.",
  Discharged:
    "The clinic has marked this visit complete. Follow the veterinary team's instructions.",
};
export async function updatePatient(id: string, raw: unknown, s: Session) {
  const b = stageSchema.parse(raw);
  return transaction(async (c) => {
    const i = (
      await c.query("SELECT * FROM intakes WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (
      !i ||
      (s.role === "clinic" && i.provider_id !== s.clinicId) ||
      s.role === "owner"
    )
      throw new WorkflowError("You do not have access to this record.", 403);
    if (i.version !== b.version || i.archived_at)
      throw new WorkflowError(
        "This record changed in another session. Reload the latest values.",
        409,
      );
    if (!allowedStage(i.stage, b.stage))
      throw new WorkflowError(
        "Acknowledge the inquiry, record arrival, and review the patient before completing care.",
      );
    if (b.stage === "In care" && b.urgency === "Unassessed")
      throw new WorkflowError(
        "A veterinary professional must record a clinical assessment before starting care.",
      );
    const result = (
      await c.query(
        `UPDATE intakes SET stage=$1,urgency=$2,workload=$3,clinical_reviewed_at=CASE WHEN $4 THEN now() ELSE clinical_reviewed_at END,arrived_at=CASE WHEN $1='Arrived' THEN COALESCE(arrived_at,now()) ELSE arrived_at END,completed_at=CASE WHEN $1='Discharged' THEN COALESCE(completed_at,now()) ELSE completed_at END,updated_at=now(),version=version+1 WHERE id=$5 RETURNING *`,
        [
          b.stage,
          b.urgency,
          b.workload || i.workload,
          b.clinicalReviewed === true || b.urgency !== "Unassessed",
          id,
        ],
      )
    ).rows[0];
    if (i.stage !== b.stage) {
      if (stageMessages[b.stage])
        await c.query(
          "INSERT INTO messages(intake_id,body,sender) VALUES($1,$2,'clinic')",
          [id, stageMessages[b.stage]],
        );
      const event =
        b.stage === "Reviewing"
          ? "inquiry_acknowledged"
          : b.stage === "Arrived"
            ? "confirmed_arrival"
            : b.stage === "Discharged"
              ? "visit_completed"
              : null;
      if (event && !i.demo_seed)
        await c.query(
          "INSERT INTO events(kind,provider_id,metadata) VALUES($1,$2,$3)",
          [event, i.provider_id, { intakeId: id, species: i.species }],
        );
    }
    if (b.workload && b.workload !== i.workload)
      await c.query(
        "INSERT INTO events(kind,provider_id,metadata) VALUES('workload_changed',$1,$2)",
        [i.provider_id, { intakeId: id, from: i.workload, to: b.workload }],
      );
    await c.query(
      "INSERT INTO audit(entity,entity_id,action,actor,detail) VALUES('intake',$1,'Patient workflow updated',$2,$3)",
      [id, s.role, b],
    );
    return result;
  });
}
export async function updateOperations(clinic: string, raw: unknown) {
  const b = z
    .object({
      version: z.number().int(),
      rooms: z.number().int().min(0).max(100).optional(),
      doctors: z.number().int().min(0).max(100).optional(),
      support: z.number().int().min(0).max(100).optional(),
      closed: z.boolean().optional(),
      confirm: z.boolean().optional(),
      override: z
        .object({
          tone: z.enum(["green", "yellow", "red"]),
          reason: z.string().trim().min(5).max(300),
          minutes: z.number().int().min(5).max(120),
        })
        .nullable()
        .optional(),
    })
    .parse(raw);
  return transaction(async (c) => {
    await c.query("SELECT id FROM providers WHERE id=$1 FOR UPDATE", [clinic]);
    const current = (
      await c.query(
        "SELECT * FROM clinic_operations WHERE provider_id=$1 FOR UPDATE",
        [clinic],
      )
    ).rows[0];
    if (!current)
      throw new WorkflowError(
        "Activity resources have not been configured for this clinic.",
        404,
      );
    if (current.version !== b.version)
      throw new WorkflowError(
        "Resources changed in another session. Reload and try again.",
        409,
      );
    for (const [type, number] of [
      ["doctor", b.doctors],
      ["clinical_support", b.support],
    ] as const) {
      if (number === undefined) continue;
      const staff = (
        await c.query(
          "SELECT * FROM coverage WHERE provider_id=$1 AND role_type=$2 ORDER BY on_duty DESC,name,id",
          [clinic, type],
        )
      ).rows;
      for (let n = 0; n < Math.max(number, staff.length); n++) {
        if (staff[n])
          await c.query("UPDATE coverage SET on_duty=$1 WHERE id=$2", [
            n < number,
            staff[n].id,
          ]);
        else
          await c.query(
            "INSERT INTO coverage(provider_id,name,role,role_type,shift) VALUES($1,$2,$3,$4,'Demo shift')",
            [
              clinic,
              `Demo ${type} ${n + 1}`,
              type === "doctor" ? "Veterinarian" : "Clinical technician",
              type,
            ],
          );
      }
    }
    const verified =
      b.confirm ||
      b.rooms !== undefined ||
      b.doctors !== undefined ||
      b.support !== undefined;
    const ov = b.override;
    await c.query(
      `UPDATE clinic_operations SET rooms=$1,closed_on=$2,verified_at=CASE WHEN $3 THEN now() ELSE verified_at END,override_tone=$4,override_reason=$5,override_until=$6,updated_at=now(),version=version+1 WHERE provider_id=$7`,
      [
        b.rooms ?? current.rooms,
        b.closed === undefined
          ? current.closed_on
          : b.closed
            ? localDay()
            : null,
        !!verified,
        ov === undefined ? current.override_tone : ov?.tone || null,
        ov === undefined ? current.override_reason : ov?.reason || null,
        ov === undefined
          ? current.override_until
          : ov
            ? new Date(Date.now() + ov.minutes * 60000)
            : null,
        clinic,
      ],
    );
    await c.query(
      "INSERT INTO audit(entity,entity_id,action,actor,detail) VALUES('activity',$1,'Clinic resources, acceptance or override updated','clinic',$2)",
      [clinic, b],
    );
    return activityFor(c, clinic);
  });
}
