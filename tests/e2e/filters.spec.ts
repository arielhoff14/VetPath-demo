import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
test.afterAll(async () => db?.end());
test("public distance, price and activity controls expose real fee data and keep inquiries last", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Search location").fill("San Jose");
  const providers = await (await page.request.get("/api/providers")).json();
  const harbor = providers.find((p: any) => p.id === "demo-harbor");
  expect(Number(harbor.exam_fee)).toBeGreaterThan(0);
  const card = page.locator(".provider-card").filter({
    has: page.getByRole("button", { name: harbor.name, exact: true }),
  });
  await expect(card.locator(".exam-fee strong")).toHaveText(
    "$" + Number(harbor.exam_fee),
  );
  await page.getByLabel("Maximum exam fee").selectOption("150");
  for (const fee of await page
    .locator(".card-fee .exam-fee strong")
    .allTextContents())
    expect(Number(fee.replace(/[$,]/g, ""))).toBeLessThanOrEqual(150);
  await page.getByLabel("Sort results").selectOption("price");
  const fees = (
    await page.locator(".card-fee .exam-fee strong").allTextContents()
  ).map((s) => Number(s.replace(/[$,]/g, "")));
  expect(fees).toEqual([...fees].sort((a, b) => a - b));
  await page.getByLabel("Activity level").selectOption("unknown");
  for (const c of await page.locator(".provider-card").all())
    await expect(c).toContainText("Activity unconfirmed");
  await page.getByLabel("Activity level").selectOption("any");
  await page.getByLabel("Search radius").selectOption("3");
  for (const text of await page
    .locator(".provider-location")
    .allTextContents()) {
    const m = text.match(/([\d.]+) mi/);
    if (m) expect(Number(m[1])).toBeLessThanOrEqual(3.1);
  }
  const controls = await page
    .locator(".quick-filters")
    .getByRole("button")
    .allTextContents();
  expect(controls.at(-1)).toContain("Open for inquiries");
  await page.screenshot({
    path: "test-results/owner-price-activity-filters.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.getByLabel("Maximum exam fee")).toHaveValue("");
  await expect(page.getByLabel("Activity level")).toHaveValue("any");
  await expect(page.getByLabel("Search location")).toHaveValue("");
  await expect(page.locator(".provider-card")).toHaveCount(providers.length);
});
test("staff fee edits and arrived workload drive owner filters, persist and protect fees from imports", async ({
  browser,
}) => {
  test.skip(
    !db,
    "Direct PostgreSQL integration runs on the isolated CI/local database.",
  );
  const owner = await browser.newContext(),
    staff = await browser.newContext(),
    admin = await browser.newContext();
  await owner.request.post("/api/session", { data: { role: "owner" } });
  await staff.request.post("/api/session", {
    data: { role: "clinic", clinicId: "demo-harbor" },
  });
  await admin.request.post("/api/session", { data: { role: "admin" } });
  await admin.request.post("/api/demo/reset", {
    data: { confirmation: "RESET FICTIONAL CLINICS", requestKey: randomUUID() },
  });
  const op = await owner.newPage(),
    cp = await staff.newPage();
  await op.goto("/");
  await op.getByLabel("Search location").fill("95112");
  await op.getByLabel("Pet species", { exact: true }).selectOption("Exotics");
  await op.getByLabel("Search radius").selectOption("10");
  await op.getByLabel("Maximum exam fee").selectOption("150");
  await op.getByLabel("Activity level").selectOption("green");
  await expect(op.locator(".provider-card")).toHaveCount(1);
  await expect(op.locator(".provider-card")).toContainText(
    "Harbor Pet Urgent Care",
  );
  await cp.goto("/");
  await cp.getByRole("tab", { name: "Availability & services" }).click();
  await cp.getByLabel("Exam fee ($)", { exact: true }).fill("175");
  await cp.getByRole("button", { name: "Save exam fee", exact: true }).click();
  await expect(op.locator(".provider-card")).toHaveCount(0);
  await op.getByLabel("Maximum exam fee").selectOption("200");
  await expect(op.locator(".provider-card")).toHaveCount(1);
  await expect(op.locator(".exam-fee strong")).toHaveText("$175");
  expect(
    Number(
      (await db!.query("SELECT exam_fee FROM providers WHERE id='demo-harbor'"))
        .rows[0].exam_fee,
    ),
  ).toBe(175);
  const inquiry = await (
    await owner.request.post("/api/intakes", {
      data: {
        providerId: "demo-harbor",
        ownerName: "Filter Owner",
        petName: "Filter-" + Date.now(),
        species: "Exotics",
        speciesSubtype: "Rabbit",
        concern: "Fictional sore foot",
        duration: "Today",
        contact: "filter@example.test",
        submissionKey: randomUUID(),
      },
    })
  ).json();
  await staff.request.patch("/api/intakes/" + inquiry.id, {
    data: {
      version: inquiry.version,
      stage: "Reviewing",
      urgency: "Unassessed",
    },
  });
  await staff.request.patch("/api/intakes/" + inquiry.id, {
    data: {
      version: inquiry.version + 1,
      stage: "Arrived",
      urgency: "Unassessed",
      workload: "Standard",
    },
  });
  await expect(op.locator(".provider-card")).toHaveCount(0);
  await op.getByLabel("Activity level").selectOption("yellow");
  await expect(op.locator(".provider-card")).toHaveCount(2);
  await expect(
    op.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toBeVisible();
  await staff.request.patch("/api/intakes/" + inquiry.id, {
    data: { version: inquiry.version + 2, stage: "In care", urgency: "Urgent" },
  });
  await staff.request.patch("/api/intakes/" + inquiry.id, {
    data: {
      version: inquiry.version + 3,
      stage: "Discharged",
      urgency: "Urgent",
    },
  });
  await expect(
    op.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toHaveCount(0);
  await op.getByLabel("Activity level").selectOption("green");
  await expect(
    op.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toBeVisible();
  await op.reload();
  await cp.reload();
  await cp.getByRole("tab", { name: "Availability & services" }).click();
  await expect(cp.getByLabel("Exam fee ($)", { exact: true })).toHaveValue(
    "175",
  );
  await expect(
    op
      .locator(".provider-card")
      .filter({
        has: op.getByRole("button", {
          name: "Harbor Pet Urgent Care",
          exact: true,
        }),
      })
      .locator(".exam-fee strong"),
  ).toHaveText("$175");
  await db!.query(
    "UPDATE clinic_operations SET verified_at=now()-interval '61 minutes' WHERE provider_id='demo-harbor'",
  );
  await op.getByLabel("Search location").fill("95112");
  await op.getByLabel("Activity level").selectOption("green");
  await expect(
    op.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toHaveCount(0);
  await op.getByLabel("Activity level").selectOption("unknown");
  await expect(
    op.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toBeVisible();
  const source = (
    await db!.query("SELECT * FROM providers WHERE phone='4088348180'")
  ).rows[0];
  try {
    expect(
      (
        await admin.request.patch("/api/providers/" + source.id, {
          data: { version: source.version, exam_fee: 123 },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await admin.request.post("/api/admin/import", {
          data: { csv: readFileSync("data/pricing-comparison.csv", "utf8") },
        })
      ).ok(),
    ).toBe(true);
    const preserved = (
      await db!.query("SELECT * FROM providers WHERE id=$1", [source.id])
    ).rows[0];
    expect(Number(preserved.exam_fee)).toBe(123);
    expect(preserved.fee_basis).toBe("staff");
    expect(
      (
        await db!.query(
          "SELECT count(*)::int n FROM conflicts WHERE provider_id=$1 AND field='exam_fee' AND status='pending'",
          [source.id],
        )
      ).rows[0].n,
    ).toBeGreaterThan(0);
    const conflict = (
      await db!.query(
        "SELECT id FROM conflicts WHERE provider_id=$1 AND field='exam_fee' AND status='pending' ORDER BY created_at DESC LIMIT 1",
        [source.id],
      )
    ).rows[0];
    expect(
      (
        await admin.request.post("/api/admin/conflicts", {
          data: { id: conflict.id, apply: true },
        })
      ).ok(),
    ).toBe(true);
    const accepted = (
      await db!.query("SELECT exam_fee,fee_basis FROM providers WHERE id=$1", [
        source.id,
      ])
    ).rows[0];
    expect(Number(accepted.exam_fee)).toBe(230);
    expect(accepted.fee_basis).toBe("spreadsheet");
  } finally {
    await db!.query(
      "UPDATE providers SET exam_fee=$2,fee_basis=$3,fee_checked=$4,fee_note=$5,field_overrides=$6,version=version+1 WHERE id=$1",
      [
        source.id,
        source.exam_fee,
        source.fee_basis,
        source.fee_checked,
        source.fee_note,
        source.field_overrides,
      ],
    );
  }
  await admin.request.post("/api/demo/reset", {
    data: { confirmation: "RESET FICTIONAL CLINICS", requestKey: randomUUID() },
  });
  await Promise.all([owner.close(), staff.close(), admin.close()]);
});
