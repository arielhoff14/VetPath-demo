import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
test.afterAll(async () => db?.end());
test("public directory exposes a demo inquiry button and form for every hospital without changing partnership", async ({
  page,
}) => {
  await page.goto("/");
  const providers = await (await page.request.get("/api/providers")).json();
  expect(providers.length).toBeGreaterThanOrEqual(34);
  expect(providers.every((p: any) => p.inquiry_enabled === true)).toBe(true);
  await expect(page.locator(".provider-card")).toHaveCount(providers.length);
  for (const p of providers) {
    const card = page
      .locator(".provider-card")
      .filter({ has: page.getByRole("button", { name: p.name, exact: true }) });
    await expect(
      card.getByRole("button", {
        name: /Send inquiry|Not accepting inquiries/,
        exact: true,
      }),
    ).toHaveCount(1);
  }
  const veg = providers.find((p: any) => p.phone === "4088348180");
  expect(veg.partner).toBe(false);
  await page
    .locator(".provider-card")
    .filter({ has: page.getByRole("button", { name: veg.name, exact: true }) })
    .getByRole("button", { name: "Send inquiry", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(veg.name);
  await expect(page.getByRole("dialog")).toContainText(
    "no actual hospital is contacted",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: veg.name, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send inquiry", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Send a care inquiry",
  );
});
test("nonpartner inquiry reaches the correct clinic UI with owner messages, notes, completion and refresh persistence", async ({
  browser,
}) => {
  test.skip(!db, "Creation workflow uses isolated local/CI PostgreSQL.");
  const owner = await browser.newContext(),
    staff = await browser.newContext(),
    outsider = await browser.newContext();
  const op = await owner.newPage(),
    cp = await staff.newPage();
  await op.goto("/");
  await op
    .getByLabel("Tell us about your pet")
    .fill(
      "My bearded dragon is limping in San Jose for two hours. Please help find urgent care.",
    );
  await op.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(op.getByLabel("Pet species", { exact: true })).toHaveValue(
    "Exotics",
  );
  await expect(op.getByLabel("Animal type", { exact: true })).toHaveValue(
    "Reptile",
  );
  const name = "Veterinary Emergency Group (San Jose)",
    pet = "Orbit-" + Date.now();
  await op
    .locator(".provider-card")
    .filter({ has: op.getByRole("button", { name, exact: true }) })
    .getByRole("button", { name: "Send inquiry", exact: true })
    .click();
  await op.getByLabel("Your name").fill("Fictional Avery");
  await op.getByLabel("Pet’s name").fill(pet);
  await op.getByLabel("Demo email or phone").fill("avery@example.test");
  await op
    .getByRole("button", { name: "Send inquiry to clinic", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText(pet);
  const record = (
    await db!.query("SELECT * FROM intakes WHERE pet_name=$1", [pet])
  ).rows[0];
  const provider = (
    await db!.query("SELECT * FROM providers WHERE id=$1", [record.provider_id])
  ).rows[0];
  expect(provider.partner).toBe(false);
  expect(provider.name).toBe(name);
  expect(record.species).toBe("Exotics");
  expect(record.species_subtype).toBe("Reptile");
  expect(record.receiving_summary).toContain("bearded dragon");
  await staff.request.post("/api/session", {
    data: { role: "clinic", clinicId: provider.id },
  });
  await cp.goto("/");
  await expect(cp.getByRole("row").filter({ hasText: pet })).toBeVisible();
  await cp
    .getByRole("row")
    .filter({ hasText: pet })
    .getByRole("button", { name: "Review", exact: true })
    .click();
  await cp
    .getByRole("button", { name: "Acknowledge inquiry", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText("Acknowledged");
  await cp
    .getByRole("textbox", { name: "Clinical note", exact: true })
    .fill("Fictional review: alert reptile; staff assessment pending.");
  await cp
    .getByRole("button", { name: "Add clinical note", exact: true })
    .click();
  await expect(
    cp.getByText("Fictional review: alert reptile; staff assessment pending.", {
      exact: true,
    }),
  ).toBeVisible();
  await cp
    .getByRole("textbox", { name: "Message text" })
    .fill("Demo team received the report. Call before travelling.");
  await cp
    .getByRole("button", { name: "Send in-app message", exact: true })
    .click();
  await op.getByRole("button", { name: "Messages", exact: true }).click();
  await expect(op.getByRole("dialog")).toContainText(
    "Demo team received the report.",
  );
  await cp.getByRole("button", { name: "Record arrival", exact: true }).click();
  await expect(op.getByRole("dialog")).toContainText("Checked in");
  await cp
    .getByLabel("Clinical assessment", { exact: true })
    .selectOption("Urgent");
  await cp
    .getByRole("button", {
      name: "Record clinical review & start care",
      exact: true,
    })
    .click();
  await cp.getByRole("button", { name: "Complete visit", exact: true }).click();
  await expect(op.getByRole("dialog")).toContainText("Visit complete");
  expect(
    (await outsider.request.get("/api/intakes/" + record.id)).status(),
  ).toBe(403);
  const ownerRecord = await (
    await owner.request.get("/api/intakes/" + record.id)
  ).json();
  expect(ownerRecord.notes).toEqual([]);
  await cp.reload();
  await cp.getByRole("button", { name: /^Completed/ }).click();
  await expect(cp.getByRole("row").filter({ hasText: pet })).toContainText(
    "Discharged",
  );
  await op.reload();
  await op.getByRole("button", { name: "View your care requests" }).click();
  await expect(op.getByRole("dialog")).toContainText("Visit complete");
  // Role switching in one browser should lead directly to the selected receiving clinic.
  await op.getByRole("button", { name: "Close dialog", exact: true }).click();
  await op
    .getByRole("button", { name: "Clinic workspace", exact: true })
    .click();
  await expect(op.getByLabel("Select clinic workspace")).toHaveValue(
    provider.id,
  );
  await op.getByRole("button", { name: /^Completed/ }).click();
  await expect(op.getByRole("row").filter({ hasText: pet })).toBeVisible();
  await Promise.all([owner.close(), staff.close(), outsider.close()]);
});
test("every database hospital supports a correctly routed complete demo lifecycle with exactly-once submission", async ({
  browser,
}) => {
  test.skip(
    !db,
    "Exhaustive mutations run only on isolated local/CI PostgreSQL.",
  );
  test.setTimeout(180000);
  const owner = await browser.newContext(),
    admin = await browser.newContext();
  await owner.request.post("/api/session", { data: { role: "owner" } });
  await admin.request.post("/api/session", { data: { role: "admin" } });
  await admin.request.post("/api/demo/reset", {
    data: { confirmation: "RESET FICTIONAL CLINICS", requestKey: randomUUID() },
  });
  const providers = await (await owner.request.get("/api/providers")).json();
  const ids = [];
  for (const p of providers) {
    const staff = await browser.newContext();
    await staff.request.post("/api/session", {
      data: { role: "clinic", clinicId: p.id },
    });
    const species = p.species[0] || "Dog";
    const subtype = ["Exotics", "Farm animals", "Other species"].includes(
      species,
    )
      ? p.species_subtypes[0] ||
        (species === "Exotics"
          ? "Bird"
          : species === "Farm animals"
            ? "Goat"
            : "Axolotl")
      : "";
    const data = {
      providerId: p.id,
      ownerName: "Exhaustive Fictional Owner",
      petName: "Routing-" + p.id + "-" + Date.now(),
      species,
      speciesSubtype: subtype,
      concern: "Fictional demonstration case for queue routing.",
      duration: "Today",
      contact: "routing@example.test",
      allowUnknownSpecies: true,
      submissionKey: randomUUID(),
    };
    const created = await owner.request.post("/api/intakes", { data });
    expect(created.status(), p.name).toBe(201);
    let patient = await created.json();
    ids.push(patient.id);
    expect(patient.provider_id).toBe(p.id);
    const retry = await owner.request.post("/api/intakes", { data });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).id).toBe(patient.id);
    for (const stage of ["Reviewing", "Arrived", "In care", "Discharged"]) {
      const response = await staff.request.patch("/api/intakes/" + patient.id, {
        data: {
          version: patient.version,
          stage,
          urgency:
            stage === "In care" || stage === "Discharged"
              ? "Urgent"
              : "Unassessed",
          workload: "Standard",
        },
      });
      expect(response.status(), p.name + " " + stage).toBe(200);
      patient = await response.json();
    }
    expect(
      (await (await owner.request.get("/api/intakes/" + patient.id)).json())
        .stage,
    ).toBe("Discharged");
    await staff.close();
  }
  const saved = (
    await db!.query(
      "SELECT id,provider_id,stage,arrived_at,clinical_reviewed_at,completed_at FROM intakes WHERE id=ANY($1::uuid[])",
      [ids],
    )
  ).rows;
  expect(saved).toHaveLength(providers.length);
  expect(new Set(saved.map((p) => p.provider_id)).size).toBe(providers.length);
  for (const row of saved) {
    expect(row.stage).toBe("Discharged");
    expect(row.arrived_at).toBeTruthy();
    expect(row.clinical_reviewed_at).toBeTruthy();
    expect(row.completed_at).toBeTruthy();
  }
  const events = (
    await db!.query(
      "SELECT metadata->>'intakeId' id,kind,count(*)::int n FROM events WHERE metadata->>'intakeId'=ANY($1::text[]) AND kind IN ('intake_submitted','confirmed_arrival','visit_completed') GROUP BY 1,2",
      [ids],
    )
  ).rows;
  expect(events).toHaveLength(providers.length * 3);
  expect(events.every((e) => e.n === 1)).toBe(true);
  await Promise.all([owner.close(), admin.close()]);
});

test("nonpartner restrictions cannot be bypassed and handoffs work between nonpartner workspaces", async ({
  browser,
}) => {
  test.skip(!db, "Negative mutations run only on isolated PostgreSQL.");
  const owner = await browser.newContext(),
    admin = await browser.newContext(),
    from = await browser.newContext(),
    to = await browser.newContext();
  await owner.request.post("/api/session", { data: { role: "owner" } });
  await admin.request.post("/api/session", { data: { role: "admin" } });
  const providers = await (await admin.request.get("/api/providers")).json(),
    veg = providers.find((p: any) => p.phone === "4088348180"),
    arch = providers.find((p: any) => p.id === "public-archvet-winchester"),
    medvet = providers.find((p: any) => p.id === "mvsv-004");
  await from.request.post("/api/session", {
    data: { role: "clinic", clinicId: veg.id },
  });
  await to.request.post("/api/session", {
    data: { role: "clinic", clinicId: arch.id },
  });
  const data = {
    providerId: veg.id,
    ownerName: "Fictional Restrictions Owner",
    petName: "Restrictions-" + Date.now(),
    species: "Dog",
    concern: "Fictional inquiry restriction and handoff test.",
    duration: "Today",
    contact: "restrictions@example.test",
    submissionKey: randomUUID(),
  };
  expect(
    (
      await owner.request.post("/api/intakes", {
        data: { ...data, providerId: "missing-clinic" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await owner.request.post("/api/intakes", {
        data: {
          ...data,
          providerId: medvet.id,
          species: "Exotics",
          speciesSubtype: "Bird",
        },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await owner.request.post("/api/intakes", {
        data: { ...data, requestedService: "Neurology" },
      })
    ).status(),
  ).toBe(422);
  const intake = await (
    await owner.request.post("/api/intakes", { data })
  ).json();
  try {
    await admin.request.patch("/api/providers/" + veg.id, {
      data: { version: veg.version, availability: "At capacity" },
    });
    expect(
      (
        await owner.request.post("/api/intakes", {
          data: {
            ...data,
            petName: "Blocked-" + Date.now(),
            submissionKey: randomUUID(),
          },
        })
      ).status(),
    ).toBe(409);
    const page = await owner.newPage();
    await page.goto("/");
    await expect(
      page
        .locator(".provider-card")
        .filter({
          has: page.getByRole("button", { name: veg.name, exact: true }),
        })
        .getByRole("button", { name: "Not accepting inquiries", exact: true }),
    ).toBeDisabled();
  } finally {
    const latest = (
      await (await admin.request.get("/api/providers")).json()
    ).find((p: any) => p.id === veg.id);
    await admin.request.patch("/api/providers/" + veg.id, {
      data: { version: latest.version, availability: veg.availability },
    });
  }
  expect(
    (
      await from.request.post("/api/intakes/" + intake.id + "/handoff", {
        data: {
          toProvider: arch.id,
          summary: "Fictional stable dog transfer; receiving team must review.",
        },
      })
    ).ok(),
  ).toBe(true);
  const handoff = (await (await to.request.get("/api/handoffs")).json()).find(
    (h: any) => h.intake_id === intake.id,
  );
  try {
    await admin.request.patch("/api/providers/" + arch.id, {
      data: { version: arch.version, availability: "At capacity" },
    });
    expect(
      (
        await to.request.patch("/api/handoffs/" + handoff.id, {
          data: { status: "Accepted" },
        })
      ).status(),
    ).toBe(409);
  } finally {
    const latest = (
      await (await admin.request.get("/api/providers")).json()
    ).find((p: any) => p.id === arch.id);
    await admin.request.patch("/api/providers/" + arch.id, {
      data: { version: latest.version, availability: arch.availability },
    });
  }
  expect(
    (
      await to.request.patch("/api/handoffs/" + handoff.id, {
        data: { status: "Accepted" },
      })
    ).ok(),
  ).toBe(true);
  expect((await from.request.get("/api/intakes/" + intake.id)).status()).toBe(
    403,
  );
  expect(
    (await (await owner.request.get("/api/intakes/" + intake.id)).json())
      .provider_id,
  ).toBe(arch.id);
  let patient = await (
    await to.request.get("/api/intakes/" + intake.id)
  ).json();
  for (const stage of ["Reviewing", "Arrived", "In care", "Discharged"])
    patient = await (
      await to.request.patch("/api/intakes/" + patient.id, {
        data: {
          version: patient.version,
          stage,
          urgency:
            stage === "In care" || stage === "Discharged"
              ? "Routine"
              : "Unassessed",
        },
      })
    ).json();
  expect(patient.stage).toBe("Discharged");
  expect(
    (await db!.query("SELECT status FROM handoffs WHERE id=$1", [handoff.id]))
      .rows[0].status,
  ).toBe("Accepted");
  await Promise.all([owner.close(), admin.close(), from.close(), to.close()]);
});
