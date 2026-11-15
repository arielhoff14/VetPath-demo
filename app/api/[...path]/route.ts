import { allSpeciesValues, providerSpecies } from "@/lib/species";
import {
  activityFor,
  createInquiry,
  updatePatient,
  updateOperations,
  WorkflowError,
  transaction,
} from "@/lib/workflows";
import { calculateActivity, ownerActivity } from "@/lib/activity";
import { seedFictionalClinics } from "@/lib/demo";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query } from "@/lib/db";
import { session, setSession } from "@/lib/auth";
import { importDirectory, addressLocation } from "@/lib/directory";
import { importSheet } from "@/lib/importer";
import { allowedStage } from "@/lib/domain";
import { organizeRequest } from "@/lib/assistant";
export const dynamic = "force-dynamic";
const text = z.string().trim().min(1).max(3000);
const edit = z
  .object({
    version: z.number().int(),
    name: text.optional(),
    city: text.optional(),
    category: z
      .enum(["Emergency", "Urgent care", "Specialty", "General practice"])
      .optional(),
    phone: z
      .string()
      .regex(/^\d{10}$/)
      .nullable()
      .optional(),
    address: text.optional(),
    species: z
      .array(z.string().refine((s) => allSpeciesValues.includes(s)))
      .max(10)
      .optional(),
    species_subtypes: z
      .array(z.string().trim().min(1).max(80))
      .max(20)
      .optional(),
    services: z
      .array(
        z.enum([
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
        ]),
      )
      .max(20)
      .optional(),
    hours: text.optional(),
    scope: text.optional(),
    cost_note: text.optional(),
    exam_fee: z.number().min(0).nullable().optional(),
    partner: z.boolean().optional(),
    availability: z
      .enum(["Accepting", "Limited", "At capacity", "Unknown"])
      .optional(),
  })
  .strict();
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const path = (await ctx.params).path;
  const [area, id, sub] = path;
  const method = req.method;
  try {
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      if (
        origin &&
        origin !== new URL(req.url).origin &&
        new URL(origin).host !== req.headers.get("host")
      )
        return NextResponse.json(
          { error: "Cross-origin request rejected" },
          { status: 403 },
        );
      if (Number(req.headers.get("content-length") || 0) > 2000000)
        return NextResponse.json(
          { error: "Payload too large" },
          { status: 413 },
        );
    }
    if (area === "health" && method === "GET") {
      await query("SELECT 1");
      return NextResponse.json({ status: "ok", database: "postgresql" });
    }
    let s = await session();
    if (area === "session") {
      if (method === "GET")
        return NextResponse.json({
          session: s,
          demo: process.env.DEMO_MODE === "true",
        });
      const body = z
        .object({
          role: z.enum(["owner", "clinic", "admin"]),
          clinicId: z.string().optional(),
        })
        .parse(await req.json());
      if (body.role !== "owner" && process.env.DEMO_MODE !== "true")
        return NextResponse.json(
          {
            error:
              "Demo staff access is disabled. Configure production identity before enabling staff access.",
          },
          { status: 403 },
        );
      if (
        body.role === "clinic" &&
        !(await query("SELECT id FROM providers WHERE id=$1", [body.clinicId]))
          .rowCount
      )
        return NextResponse.json(
          { error: "Select a valid clinic" },
          { status: 400 },
        );
      return NextResponse.json({
        session: await setSession(body.role, body.clinicId),
      });
    }
    if (!s) {
      s = await setSession("owner");
    }
    const isStaff = s.role === "clinic" || s.role === "admin";
    const mustStaff = () => {
      if (!isStaff) throw new Error("Forbidden");
    };
    const mustAdmin = () => {
      if (s!.role !== "admin") throw new Error("Forbidden");
    };
    const ownClinic = (clinicId: string) => {
      mustStaff();
      if (s!.role === "clinic" && s!.clinicId !== clinicId)
        throw new Error("Forbidden");
    };
    if (area === "providers" && method === "GET") {
      const providers = (
        await query(
          `SELECT id,name,city,category,phone,address,postal_code,coordinate_source,address_checked,website,lat,lng,species,species_subtypes,services,hours,scope,cost_note,exam_fee,source_url,source_checked,source_kind,source_notes,partner,fictional,availability,availability_at,updated_at,version,simulated,field_overrides FROM providers ORDER BY name`,
        )
      ).rows;
      const operations = (await query("SELECT * FROM clinic_activity_inputs"))
        .rows;
      return NextResponse.json(
        providers.map((p) => {
          const row = operations.find((o) => o.provider_id === p.id);
          return {
            ...p,
            activity: row
              ? ownerActivity(
                  calculateActivity({
                    ...row,
                    verified_at: row.verified_at?.toISOString(),
                    updated_at: row.activity_updated_at?.toISOString(),
                    override_until: row.override_until?.toISOString(),
                  }),
                )
              : null,
          };
        }),
      );
    }
    if (area === "activity") {
      ownClinic(id);
      if (method === "GET")
        return NextResponse.json(await activityFor(pool, id));
      if (method === "PATCH")
        return NextResponse.json(await updateOperations(id, await req.json()));
    }
    if (area === "demo" && id === "reset" && method === "POST") {
      mustAdmin();
      if (process.env.DEMO_MODE !== "true")
        throw new WorkflowError("Demo reset is disabled.", 403);
      const b = z
        .object({
          confirmation: z.literal("RESET FICTIONAL CLINICS"),
          requestKey: z.string().uuid(),
        })
        .parse(await req.json());
      return NextResponse.json(
        await transaction(async (c) => {
          await c.query("SELECT pg_advisory_xact_lock(746382)");
          if (
            (
              await c.query(
                "SELECT request_key FROM demo_resets WHERE request_key=$1",
                [b.requestKey],
              )
            ).rowCount
          )
            return { ok: true, duplicate: true };
          await seedFictionalClinics(c, true);
          await c.query("INSERT INTO demo_resets(request_key) VALUES($1)", [
            b.requestKey,
          ]);
          await c.query(
            "INSERT INTO audit(entity,entity_id,action,actor) VALUES('demo','fictional-clinics','Fictional clinic demo reset; previous cases archived','admin')",
          );
          return { ok: true };
        }),
      );
    }
    if (area === "providers" && method === "PATCH") {
      ownClinic(id);
      const body = edit.parse(await req.json());
      if (s.role !== "admin" && body.partner !== undefined)
        throw new Error("Forbidden");
      const { version, ...changes } = body;
      const updates: Record<string, unknown> = { ...changes };
      if (changes.species)
        Object.assign(updates, providerSpecies(changes.species), {
          species_subtypes:
            changes.species_subtypes ||
            providerSpecies(changes.species).species_subtypes,
        });
      if (changes.address)
        Object.assign(updates, addressLocation(changes.address));
      const fields = Object.keys(updates);
      if (!fields.length) throw new Error("No changes supplied");
      const vals = Object.values(updates);
      const sets = fields.map((f, i) => `${f}=$${i + 1}`);
      if (body.availability !== undefined)
        sets.push("availability_at=now()", "simulated=true");
      const protectedFields = fields.filter(
        (f) =>
          ![
            "availability",
            "partner",
            "lat",
            "lng",
            "coordinate_source",
            "address_checked",
          ].includes(f),
      );
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await c.query(
          `UPDATE providers SET ${sets.join(",")},version=version+1,updated_at=now(),field_overrides=ARRAY(SELECT DISTINCT unnest(field_overrides||$${vals.length + 1}::text[])) WHERE id=$${vals.length + 2} AND version=$${vals.length + 3} RETURNING *`,
          [...vals, protectedFields, id, version],
        );
        if (!result.rowCount) {
          await c.query("ROLLBACK");
          return NextResponse.json(
            {
              error:
                "Someone updated this clinic. Reload the latest values before saving.",
            },
            { status: 409 },
          );
        }
        await c.query(
          `INSERT INTO audit(entity,entity_id,action,actor,detail) VALUES('provider',$1,'Clinic updated',$2,$3)`,
          [id, s.role, changes],
        );
        await c.query("COMMIT");
        return NextResponse.json(result.rows[0]);
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    if (area === "assistant" && method === "POST") {
      const { message } = z.object({ message: text }).parse(await req.json());
      const result = await organizeRequest(message);
      await query(`INSERT INTO events(kind,metadata) VALUES('search',$1)`, [
        {
          species: result.species || "Unspecified",
          service: result.service || "Any care",
          location: result.location || "All locations",
          emergency: result.emergency,
        },
      ]);
      return NextResponse.json({
        ...result,
        reply: result.emergency
          ? "These signs may need immediate veterinary attention. Contact the nearest emergency hospital now. Do not wait for a reply here or an intake confirmation. I’m showing emergency hospitals first; species and live capacity still need confirmation."
          : "I’ve organized what you shared into the filters below. These matches use listed capabilities and location. A clinic must confirm that it can care for your pet.",
      });
    }
    if (area === "events" && method === "POST") {
      const b = z
        .object({
          kind: z.enum([
            "call_click",
            "directions_click",
            "comparison",
            "filter_change",
          ]),
          providerId: z.string().optional(),
          metadata: z
            .record(
              z.string(),
              z.union([z.string().max(200), z.number(), z.boolean()]),
            )
            .optional(),
        })
        .parse(await req.json());
      await query(
        "INSERT INTO events(kind,provider_id,metadata) VALUES($1,$2,$3)",
        [b.kind, b.providerId || null, b.metadata || {}],
      );
      return NextResponse.json({ ok: true });
    }
    if (area === "intakes") {
      if (method === "GET" && !id) {
        const result = await query(
          `SELECT i.*,p.name AS provider_name FROM intakes i JOIN providers p ON p.id=i.provider_id WHERE i.archived_at IS NULL AND ${s.role === "admin" ? "true" : s.role === "clinic" ? "i.provider_id=$1" : "i.owner_session=$1"} ORDER BY i.created_at DESC`,
          s.role === "admin" ? [] : [s.role === "clinic" ? s.clinicId : s.id],
        );
        return NextResponse.json(result.rows);
      }
      if (method === "POST" && !id) {
        const result = await createInquiry(await req.json(), s);
        return NextResponse.json(result, {
          status: result.duplicate ? 200 : 201,
        });
      }
      const intake = (await query("SELECT * FROM intakes WHERE id=$1", [id]))
        .rows[0];
      if (!intake)
        return NextResponse.json(
          { error: "Intake not found" },
          { status: 404 },
        );
      if (s.role === "owner" && intake.owner_session !== s.id)
        throw new Error("Forbidden");
      if (s.role === "clinic") ownClinic(intake.provider_id);
      if (method === "GET") {
        const messages = (
          await query(
            "SELECT * FROM messages WHERE intake_id=$1 ORDER BY created_at",
            [id],
          )
        ).rows;
        const notes = isStaff
          ? (
              await query(
                "SELECT * FROM notes WHERE intake_id=$1 ORDER BY created_at",
                [id],
              )
            ).rows
          : [];
        return NextResponse.json({ ...intake, messages, notes });
      }
      if (sub === "messages" && method === "POST") {
        const b = z.object({ body: text }).parse(await req.json());
        await query(
          "INSERT INTO messages(intake_id,body,sender) VALUES($1,$2,$3)",
          [id, b.body, isStaff ? "clinic" : "owner"],
        );
        await query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('message',$1,'In-app message sent',$2)`,
          [id, s.role],
        );
        return NextResponse.json({ ok: true });
      }
      if (method === "PATCH" && s.role === "owner") {
        const b = z
          .object({
            version: z.number().int(),
            owner_name: z.string().trim().min(1).max(120),
            pet_name: z.string().trim().min(1).max(80),
            concern: text,
            duration: z.string().max(120),
            contact: z.string().trim().min(5).max(150),
          })
          .parse(await req.json());
        const r = await query(
          `UPDATE intakes SET owner_name=$1,pet_name=$2,concern=$3,duration=$4,contact=$5,receiving_summary='Updated owner report for ' || $2 || ': ' || $3 || '. Duration: ' || $4 || '. Veterinary staff must review the original report; clinical urgency is unassessed.',version=version+1,updated_at=now() WHERE id=$6 AND version=$7 AND stage IN ('New','Reviewing') RETURNING *`,
          [
            b.owner_name,
            b.pet_name,
            b.concern,
            b.duration,
            b.contact,
            id,
            b.version,
          ],
        );
        if (!r.rowCount)
          return NextResponse.json(
            {
              error:
                "The clinic has updated this intake. Refresh, or send the team a message.",
            },
            { status: 409 },
          );
        await query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('intake',$1,'Owner updated intake','owner')`,
          [id],
        );
        return NextResponse.json(r.rows[0]);
      }
      mustStaff();
      if (sub === "notes" && method === "POST") {
        const b = z.object({ body: text }).parse(await req.json());
        await query(
          "INSERT INTO notes(intake_id,body,author) VALUES($1,$2,$3)",
          [id, b.body, "Demo clinical staff"],
        );
        await query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('intake',$1,'Clinical note added',$2)`,
          [id, s.role],
        );
        return NextResponse.json({ ok: true });
      }
      if (method === "PATCH")
        return NextResponse.json(await updatePatient(id, await req.json(), s));
      if (sub === "handoff" && method === "POST") {
        const b = z
          .object({ toProvider: text, summary: text })
          .parse(await req.json());
        if (b.toProvider === intake.provider_id)
          throw new Error("Choose another provider");
        if (
          !(
            await query(
              "SELECT id FROM providers WHERE id=$1 AND partner=true",
              [b.toProvider],
            )
          ).rowCount
        )
          throw new Error(
            "Receiving clinic must join the demo partnership first.",
          );
        await query(
          "INSERT INTO handoffs(intake_id,from_provider,to_provider,summary) VALUES($1,$2,$3,$4)",
          [id, intake.provider_id, b.toProvider, b.summary],
        );
        await query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('handoff',$1,'Handoff requested',$2)`,
          [id, s.role],
        );
        return NextResponse.json({ ok: true });
      }
    }
    if (area === "handoffs") {
      mustStaff();
      if (method === "GET")
        return NextResponse.json(
          (
            await query(
              `SELECT h.*,i.pet_name,p.name from_name FROM handoffs h JOIN intakes i ON i.id=h.intake_id JOIN providers p ON p.id=h.from_provider ${s.role === "clinic" ? "WHERE h.to_provider=$1 OR h.from_provider=$1" : ""} ORDER BY h.created_at DESC`,
              s.role === "clinic" ? [s.clinicId] : [],
            )
          ).rows,
        );
      const b = z
        .object({ status: z.enum(["Accepted", "Declined"]) })
        .parse(await req.json());
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const h = (
          await c.query("SELECT * FROM handoffs WHERE id=$1 FOR UPDATE", [id])
        ).rows[0];
        if (!h) throw new Error("Handoff not found");
        ownClinic(h.to_provider);
        if (h.status !== "Requested")
          throw new Error("Handoff already resolved");
        if (b.status === "Accepted") {
          const updated = await c.query(
            `UPDATE intakes SET provider_id=$1,stage='New',version=version+1,updated_at=now() WHERE id=$2 AND provider_id=$3 RETURNING id`,
            [h.to_provider, h.intake_id, h.from_provider],
          );
          if (!updated.rowCount)
            throw new Error("Patient was already transferred.");
          await c.query(
            `INSERT INTO messages(intake_id,body,sender) VALUES($1,$2,'clinic')`,
            [
              h.intake_id,
              "Demo transfer accepted. Your intake has been handed to the receiving team. Call before travelling.",
            ],
          );
        }
        await c.query("UPDATE handoffs SET status=$1 WHERE id=$2", [
          b.status,
          id,
        ]);
        await c.query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('handoff',$1,$2,$3)`,
          [id, `Handoff ${b.status}`, s.role],
        );
        await c.query("COMMIT");
        return NextResponse.json({ ok: true });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    if (area === "coverage") {
      mustStaff();
      const clinicId =
        req.nextUrl.searchParams.get("clinic") || s.clinicId || "";
      ownClinic(clinicId);
      if (method === "GET")
        return NextResponse.json(
          (
            await query(
              "SELECT * FROM coverage WHERE provider_id=$1 ORDER BY name",
              [clinicId],
            )
          ).rows,
        );
      if (method === "POST") {
        const b = z
          .object({
            name: text,
            role: text,
            shift: text,
            role_type: z
              .enum(["doctor", "clinical_support", "nonclinical"])
              .default("nonclinical"),
          })
          .parse(await req.json());
        await query(
          "INSERT INTO coverage(provider_id,name,role,shift,role_type) VALUES($1,$2,$3,$4,$5)",
          [clinicId, b.name, b.role, b.shift, b.role_type],
        );
        await query(
          "UPDATE clinic_operations SET verified_at=now(),updated_at=now(),version=version+1 WHERE provider_id=$1",
          [clinicId],
        );
        await query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('coverage',$1,'Staff coverage added',$2)`,
          [clinicId, s.role],
        );
        return NextResponse.json({ ok: true });
      }
      const b = z.object({ on_duty: z.boolean() }).parse(await req.json());
      await query(
        "UPDATE coverage SET on_duty=$1 WHERE id=$2 AND provider_id=$3",
        [b.on_duty, id, clinicId],
      );
      await query(
        "UPDATE clinic_operations SET verified_at=now(),updated_at=now(),version=version+1 WHERE provider_id=$1",
        [clinicId],
      );
      await query(
        `INSERT INTO audit(entity,entity_id,action,actor) VALUES('coverage',$1,'Staff shift updated',$2)`,
        [clinicId, s.role],
      );
      return NextResponse.json({ ok: true });
    }
    if (area === "admin") {
      mustAdmin();
      if (id === "providers" && method === "POST") {
        const b = z
          .object({
            name: text,
            city: text,
            category: z.enum([
              "Emergency",
              "Urgent care",
              "Specialty",
              "General practice",
            ]),
            phone: z
              .string()
              .regex(/^\d{10}$/)
              .nullable(),
            address: text,
            source_url: z.url().refine((v) => /^https?:/.test(v)),
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          })
          .parse(await req.json());
        if (
          (
            await query(
              "SELECT id FROM providers WHERE (lower(name)=lower($1) AND lower(city)=lower($2)) OR ($3::text IS NOT NULL AND phone=$3)",
              [b.name, b.city, b.phone],
            )
          ).rowCount
        )
          return NextResponse.json(
            {
              error:
                "A matching hospital already exists. Edit that record instead.",
            },
            { status: 409 },
          );
        const id = "manual-" + crypto.randomUUID();
        await query(
          `INSERT INTO providers(id,name,city,category,phone,address,source_url,website,lat,lng,source_checked,source_notes) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,now(),'Administrator-entered public source; current intake and capabilities unverified.')`,
          [
            id,
            b.name,
            b.city,
            b.category,
            b.phone,
            b.address,
            b.source_url,
            b.lat,
            b.lng,
          ],
        );
        await query(
          `INSERT INTO audit(entity,entity_id,action,actor) VALUES('provider',$1,'Hospital added','admin')`,
          [id],
        );
        return NextResponse.json({ id }, { status: 201 });
      }
      if (id === "overview")
        return NextResponse.json({
          imports: (
            await query(
              "SELECT * FROM imports ORDER BY created_at DESC LIMIT 20",
            )
          ).rows,
          conflicts: (
            await query(
              `SELECT c.*,p.name FROM conflicts c JOIN providers p ON p.id=c.provider_id WHERE c.status='pending' ORDER BY c.created_at DESC`,
            )
          ).rows,
          audit: (
            await query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 40")
          ).rows,
          directorySources: (
            await query(
              "SELECT source_key,provider_id,imported_at FROM directory_sources",
            )
          ).rows,
          interviews: (
            await query(
              "SELECT source_id,provider_id,imported_at FROM interviews",
            )
          ).rows,
        });
      if (id === "import" && method === "POST") {
        const b = z
          .object({
            csv: z.string().max(1500000).optional(),
            sync: z.boolean().optional(),
          })
          .parse(await req.json());
        let csv = b.csv;
        let pricingCsv: string | undefined;
        let auditCsv: string | undefined;
        if (b.sync) {
          const root =
            "https://docs.google.com/spreadsheets/d/1Bm70UnTK56-J-U9bgxAUKzTwmA6JIlIn8DYnUudk_TE";
          const urls = [
            root + "/export?format=csv&gid=440460470",
            root + "/gviz/tq?tqx=out:csv&sheet=Pricing%20Comparison&headers=0",
            root + "/gviz/tq?tqx=out:csv&sheet=Website%20Audit&headers=0",
          ];
          [csv, pricingCsv, auditCsv] = await Promise.all(
            urls.map(async (url) => {
              const r = await fetch(url, {
                signal: AbortSignal.timeout(20000),
                cache: "no-store",
              });
              if (!r.ok)
                throw new Error(
                  "Spreadsheet unavailable. No changes imported. Upload an exported CSV instead.",
                );
              return r.text();
            }),
          );
        }
        if (!csv) throw new Error("Provide a CSV file");
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const result =
            !b.sync &&
            csv.includes('"Hospital street address"') &&
            !csv.includes('"Interview ID"')
              ? await importDirectory(
                  c,
                  csv,
                  undefined,
                  "Uploaded Pricing Comparison CSV",
                )
              : await importSheet(
                  c,
                  csv,
                  b.sync
                    ? "Google Sheets · Interview Tracker"
                    : "Uploaded interview CSV",
                );
          const directory = pricingCsv
            ? await importDirectory(
                c,
                pricingCsv,
                auditCsv,
                "Google Sheets · Pricing Comparison + Website Audit",
              )
            : null;
          await c.query("COMMIT");
          return NextResponse.json({ ...result, directory });
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      }
      if (id === "conflicts" && method === "POST") {
        const b = z
          .object({ id: z.string().uuid(), apply: z.boolean() })
          .parse(await req.json());
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const conflict = (
            await c.query(
              `SELECT * FROM conflicts WHERE id=$1 AND status='pending' FOR UPDATE`,
              [b.id],
            )
          ).rows[0];
          if (!conflict) throw new Error("Conflict already resolved");
          if (b.apply) {
            if (
              ![
                "name",
                "city",
                "category",
                "phone",
                "address",
                "services",
                "hours",
                "scope",
                "cost_note",
                "source_url",
                "website",
                "source_checked",
                "source_notes",
                "source_kind",
                "species",
                "species_subtypes",
              ].includes(conflict.field)
            )
              throw new Error("Invalid field");
            await c.query(
              `UPDATE providers SET ${conflict.field}=$1,field_overrides=array_remove(field_overrides,$2),version=version+1,updated_at=now() WHERE id=$3`,
              [conflict.incoming_value, conflict.field, conflict.provider_id],
            );
          }
          if (b.apply && conflict.field === "address") {
            const geo = addressLocation(String(conflict.incoming_value));
            await c.query(
              "UPDATE providers SET lat=$1,lng=$2,coordinate_source=$3,address_checked=$4 WHERE id=$5",
              [
                geo.lat,
                geo.lng,
                geo.coordinate_source,
                geo.address_checked,
                conflict.provider_id,
              ],
            );
          }
          await c.query("UPDATE conflicts SET status=$1 WHERE id=$2", [
            b.apply ? "applied" : "kept",
            b.id,
          ]);
          await c.query(
            `INSERT INTO audit(entity,entity_id,action,actor) VALUES('conflict',$1,$2,'admin')`,
            [
              b.id,
              b.apply ? "Spreadsheet value applied" : "Staff value retained",
            ],
          );
          await c.query("COMMIT");
          return NextResponse.json({ ok: true });
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      }
    }
    if (area === "insights" && method === "GET") {
      mustAdmin();
      const days = Math.min(
        90,
        Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7),
      );
      const counts = (
        await query(
          `SELECT kind,count(*)::int count FROM events WHERE created_at>now()-$1*interval '1 day' GROUP BY kind`,
          [days],
        )
      ).rows;
      const categories = (
        await query(
          `SELECT coalesce(metadata->>'service','Any care') label,count(*)::int count FROM events WHERE kind='search' AND created_at>now()-$1*interval '1 day' GROUP BY 1 ORDER BY 2 DESC`,
          [days],
        )
      ).rows;
      const species = (
        await query(
          `SELECT coalesce(metadata->>'species','Unspecified') label,count(*)::int count FROM events WHERE kind IN ('search','intake_submitted') AND created_at>now()-$1*interval '1 day' GROUP BY 1 ORDER BY 2 DESC`,
          [days],
        )
      ).rows;
      const workload = (
        await query(
          `SELECT p.id,p.name,count(i.id)::int total,count(i.id) FILTER(WHERE i.stage IN ('Arrived','In care') AND i.archived_at IS NULL)::int active FROM providers p LEFT JOIN intakes i ON i.provider_id=p.id AND i.created_at>now()-$1*interval '1 day' GROUP BY p.id ORDER BY total DESC`,
          [days],
        )
      ).rows;
      return NextResponse.json({
        activities: await Promise.all(
          (await query("SELECT provider_id FROM clinic_operations")).rows.map(
            async (p) => ({
              providerId: p.provider_id,
              ...(await activityFor(pool, p.provider_id)),
            }),
          ),
        ),
        counts,
        categories,
        species,
        workload,
        activity: (
          await query(
            "SELECT * FROM audit WHERE created_at>now()-$1*interval '1 day' ORDER BY created_at DESC LIMIT 30",
            [days],
          )
        ).rows,
      });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof WorkflowError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json(
      {
        error:
          message === "Forbidden"
            ? "You do not have access to this record."
            : message,
      },
      { status: message === "Forbidden" ? 403 : 400 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
