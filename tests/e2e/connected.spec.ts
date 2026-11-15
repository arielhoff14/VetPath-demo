import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});
async function reset(admin: any) {
  expect(
    (
      await admin.post("/api/demo/reset", {
        data: {
          confirmation: "RESET FICTIONAL CLINICS",
          requestKey: randomUUID(),
        },
      })
    ).ok(),
  ).toBe(true);
}
test("connected owner and clinic lifecycle changes real workload, messages, events and survives refresh", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    staff = await browser.newContext(),
    admin = await browser.newContext();
  await admin.request.post("/api/session", { data: { role: "admin" } });
  await reset(admin.request);
  const op = await owner.newPage(),
    cp = await staff.newPage();
  const pet = "Clover-connected-" + Date.now();
  await op.goto("/");
  await op
    .getByLabel("Tell us about your pet")
    .fill(
      "My dog is limping after a walk for two hours in 94103. I need urgent care.",
    );
  await op.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(op.getByLabel("Pet species", { exact: true })).toHaveValue(
    "Dog",
  );
  const card = op
    .locator(".provider-card")
    .filter({
      has: op.getByRole("button", {
        name: "Harbor Pet Urgent Care",
        exact: true,
      }),
    });
  await expect(card).toContainText("Lower activity");
  await card.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await op.getByLabel("Your name").fill("Fictional Casey");
  await op.getByLabel("Pet’s name").fill(pet);
  await op.getByLabel("Demo email or phone").fill("casey@example.test");
  await op
    .getByRole("button", { name: "Send inquiry to clinic", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText("Inquiry sent");
  const row = (await db.query("SELECT * FROM intakes WHERE pet_name=$1", [pet]))
    .rows[0];
  expect(row.provider_id).toBe("demo-harbor");
  expect(row.species).toBe("Dog");
  expect(row.receiving_summary).toContain("limping");
  expect(row.arrived_at).toBeNull();
  await cp.goto("/");
  await cp
    .getByRole("button", { name: "Clinic workspace", exact: true })
    .click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  await cp
    .getByRole("row")
    .filter({ hasText: pet })
    .getByRole("button", { name: "Review", exact: true })
    .click();
  await expect(cp.getByRole("dialog")).toContainText("limping");
  await cp
    .getByRole("button", { name: "Acknowledge inquiry", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText("Acknowledged");
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  await cp.getByRole("button", { name: "Record arrival", exact: true }).click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("75%");
  await expect(op.getByRole("dialog")).toContainText("Checked in");
  await cp
    .getByLabel("Clinical assessment", { exact: true })
    .selectOption("Urgent");
  await cp
    .getByLabel("Workload assignment", { exact: true })
    .selectOption("Intensive");
  await cp
    .getByRole("button", {
      name: "Record clinical review & start care",
      exact: true,
    })
    .click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("100%");
  await expect(op.getByRole("dialog")).toContainText("In care");
  const active = (
    await db.query(
      "SELECT * FROM clinic_activity_inputs WHERE provider_id=$1",
      ["demo-harbor"],
    )
  ).rows[0];
  expect(active.workload).toBe(8);
  expect(active.doctors).toBe(2);
  expect(active.support).toBe(4);
  await cp.getByRole("button", { name: "Complete visit", exact: true }).click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  await expect(op.getByRole("dialog")).toContainText("Visit complete");
  await cp.reload();
  await op.reload();
  await op.getByRole("button", { name: "View your care requests" }).click();
  await expect(op.getByRole("dialog")).toContainText("Visit complete");
  await cp.getByRole("button", { name: /^Completed/ }).click();
  await expect(cp.getByRole("row").filter({ hasText: pet })).toContainText(
    "Discharged",
  );
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  const saved = (await db.query("SELECT * FROM intakes WHERE id=$1", [row.id]))
    .rows[0];
  expect(saved.stage).toBe("Discharged");
  expect(saved.workload).toBe("Intensive");
  expect(saved.clinical_reviewed_at).toBeTruthy();
  expect(saved.arrived_at).toBeTruthy();
  expect(saved.completed_at).toBeTruthy();
  const events = (
    await db.query(
      "SELECT kind,count(*)::int n FROM events WHERE metadata->>'intakeId'=$1 GROUP BY kind",
      [row.id],
    )
  ).rows;
  for (const kind of [
    "intake_submitted",
    "inquiry_acknowledged",
    "confirmed_arrival",
    "visit_completed",
  ])
    expect(events.find((e) => e.kind === kind)?.n).toBe(1);
  expect(
    (
      await db.query(
        "SELECT count(*)::int n FROM messages WHERE intake_id=$1",
        [row.id],
      )
    ).rows[0].n,
  ).toBe(4);
  await Promise.all([owner.close(), staff.close(), admin.close()]);
});
test("species, duplicates, restrictions, stale data, overrides, resource changes and session scope", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    admin = await browser.newContext(),
    staff = await browser.newContext();
  await owner.request.post("/api/session", { data: { role: "owner" } });
  await admin.request.post("/api/session", { data: { role: "admin" } });
  await staff.request.post("/api/session", {
    data: { role: "clinic", clinicId: "demo-harbor" },
  });
  await reset(admin.request);
  const body = {
    providerId: "demo-willow",
    ownerName: "Fictional Rowan",
    petName: "Fern-" + Date.now(),
    species: "Exotics",
    speciesSubtype: "Rabbit",
    concern: "My rabbit has a sore foot since this morning.",
    duration: "Three hours",
    contact: "fern@example.test",
    submissionKey: randomUUID(),
    requestedService: "Urgent care",
  };
  const results = await Promise.all([
    owner.request.post("/api/intakes", { data: body }),
    owner.request.post("/api/intakes", { data: body }),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([200, 201]);
  const inquiry = await results[0].json();
  expect(
    (
      await db.query("SELECT count(*)::int n FROM intakes WHERE pet_name=$1", [
        body.petName,
      ])
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await db.query(
        "SELECT count(*)::int n FROM events WHERE kind='intake_submitted' AND metadata->>'intakeId'=$1",
        [inquiry.id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await owner.request.post("/api/intakes", {
        data: {
          ...body,
          concern: "Changed details using the same submission ID",
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await owner.request.post("/api/intakes", {
        data: {
          ...body,
          providerId: "demo-harbor",
          submissionKey: randomUUID(),
        },
      })
    ).status(),
  ).toBe(422);
  expect((await staff.request.get("/api/intakes/" + inquiry.id)).status()).toBe(
    403,
  );
  for (const [species, speciesSubtype, providerId] of [
    ["Farm animals", "Goat", "demo-valley"],
    ["Exotics", "Bird", "demo-willow"],
  ])
    expect(
      (
        await owner.request.post("/api/intakes", {
          data: {
            ...body,
            species,
            speciesSubtype,
            providerId,
            petName: speciesSubtype + Date.now(),
            submissionKey: randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
  const activity = async () =>
    (await admin.request.get("/api/activity/demo-harbor")).json();
  let a = await activity();
  expect(
    (
      await admin.request.patch("/api/activity/demo-harbor", {
        data: { version: a.version, closed: true },
      })
    ).ok(),
  ).toBe(true);
  const dog = {
    ...body,
    providerId: "demo-harbor",
    species: "Dog",
    speciesSubtype: "",
    submissionKey: randomUUID(),
  };
  expect(
    (await owner.request.post("/api/intakes", { data: dog })).status(),
  ).toBe(409);
  a = await activity();
  expect(a.tone).toBe("green");
  expect(a.accepting).toBe(false);
  await admin.request.patch("/api/activity/demo-harbor", {
    data: { version: a.version, closed: false, doctors: 1, confirm: true },
  });
  a = await activity();
  expect(a.percent).toBe(100);
  expect(a.limiting).toContain("Doctors");
  expect(
    (
      await admin.request.patch("/api/activity/demo-harbor", {
        data: { version: a.version - 1, rooms: 1 },
      })
    ).status(),
  ).toBe(409);
  await admin.request.patch("/api/activity/demo-harbor", {
    data: {
      version: a.version,
      override: {
        tone: "yellow",
        reason: "Temporary floor assessment",
        minutes: 15,
      },
    },
  });
  a = await activity();
  expect(a.tone).toBe("yellow");
  expect(a.computedTone).toBe("red");
  await db.query(
    "UPDATE clinic_operations SET override_until=now()-interval '1 second' WHERE provider_id='demo-harbor'",
  );
  expect((await activity()).tone).toBe("red");
  await db.query(
    "UPDATE clinic_operations SET verified_at=now()-interval '61 minutes' WHERE provider_id='demo-harbor'",
  );
  a = await activity();
  expect(a.tone).toBe("unknown");
  const publicListing = (
    await (await owner.request.get("/api/providers")).json()
  ).find((p: any) => p.id === "demo-harbor");
  expect(publicListing.activity.label).toBe("Activity unconfirmed");
  expect(publicListing.activity.capacity).toBeUndefined();
  await reset(admin.request);
  for (const message of [
    "Our cockatiel has a sore wing in San Jose for 3 hours",
    "A goat is limping in Lafayette since yesterday",
    "My axolotl needs a clinic in 94103",
  ]) {
    const r = await (
      await owner.request.post("/api/assistant", { data: { message } })
    ).json();
    expect(r.species).toBeTruthy();
    expect(r.mode).toMatch(/rule-based|openai/);
    expect(r.missing).toBeInstanceOf(Array);
  }
  await Promise.all([owner.close(), admin.close(), staff.close()]);
});
