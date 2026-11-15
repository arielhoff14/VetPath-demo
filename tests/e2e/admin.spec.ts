import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("admin import deduplicates, preserves edits, resolves conflicts and updates owner view", async ({
  browser,
}) => {
  const admin = await browser.newContext();
  const owner = await browser.newContext();
  const ap = await admin.newPage();
  const op = await owner.newPage();
  await ap.goto("/");
  await ap.getByRole("button", { name: "Directory", exact: true }).click();
  await op.goto("/");
  await expect(
    op.getByRole("button", {
      name: "Remedy Veterinary Specialists",
      exact: true,
    }),
  ).toBeVisible();
  const initial = await (await admin.request.get("/api/providers")).json();
  const remedy = initial.find((p: any) => p.id === "rvs-002");
  const row = ap
    .getByRole("row")
    .filter({ hasText: "Remedy Veterinary Specialists" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await ap
    .getByLabel("Capabilities and limitations")
    .fill("QA protected neurology scope");
  await ap.getByRole("button", { name: "Save hospital changes" }).click();
  const csv = readFileSync("data/hospitals.csv", "utf8");
  await ap.getByRole("tab", { name: "Imports & sources" }).click();
  await ap
    .getByLabel("Import hospital CSV")
    .setInputFiles({
      name: "hospitals.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(
    ap.getByText(/Import complete: 5 interview rows processed/),
  ).toBeVisible();
  const after = await (await admin.request.get("/api/providers")).json();
  expect(after.length).toBe(initial.length);
  expect(after.find((p: any) => p.id === "rvs-002").scope).toBe(
    "QA protected neurology scope",
  );
  await ap.getByRole("tab", { name: /^Conflicts/ }).click();
  const conflict = ap
    .locator(".conflict-card")
    .filter({ hasText: "QA protected neurology scope" });
  await expect(conflict).toBeVisible();
  await conflict
    .getByRole("button", { name: "Apply spreadsheet value" })
    .click();
  await op
    .getByRole("button", { name: "Remedy Veterinary Specialists", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText(
    "Neurology and pain cases",
  );
  await op.getByRole("button", { name: "Close dialog" }).click();
  const latest = (
    await (await admin.request.get("/api/providers")).json()
  ).find((p: any) => p.id === "rvs-002");
  const stale = await admin.request.patch("/api/providers/rvs-002", {
    data: { version: latest.version - 1, hours: "stale write" },
  });
  expect(stale.status()).toBe(409);
  const forbidden = await owner.request.patch("/api/providers/rvs-002", {
    data: { version: latest.version, hours: "Unauthorized" },
  });
  expect(forbidden.status()).toBe(403);
  await ap.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(
    ap.getByRole("heading", { name: "Understand the path to care." }),
  ).toBeVisible();
  await expect(ap.getByText("Call link clicks", { exact: true })).toBeVisible();
  await expect(
    ap.getByText(/Contact intent · not completed calls/),
  ).toBeVisible();
  const measured = await (
    await owner.request.post("/api/intakes", {
      data: {
        providerId: "sage-sf",
        ownerName: "Metric QA",
        petName: "Metric " + Date.now(),
        species: "Dog",
        concern: "Demo metric fixture",
        duration: "Today",
        contact: "metrics@example.test",
      },
    })
  ).json();
  await admin.request.patch("/api/intakes/" + measured.id, {
    data: { version: measured.version, stage: "Reviewing", urgency: "Routine" },
  });
  await admin.request.patch("/api/intakes/" + measured.id, {
    data: {
      version: measured.version + 1,
      stage: "Arrived",
      urgency: "Routine",
    },
  });
  const insight = await (
    await admin.request.get("/api/insights?days=7")
  ).json();
  expect(
    insight.counts.find((x: any) => x.kind === "intake_submitted").count,
  ).toBeGreaterThan(0);
  expect(
    insight.counts.find((x: any) => x.kind === "confirmed_arrival").count,
  ).toBeGreaterThan(0);
  const sourceRows = await (
    await admin.request.get("/api/admin/overview")
  ).json();
  expect(sourceRows.interviews.length).toBe(5);
  await owner.close();
  await admin.close();
});
test("partnerships and accepted handoffs move the patient between scoped clinic sessions", async ({
  browser,
}) => {
  const admin = await browser.newContext();
  const from = await browser.newContext();
  const to = await browser.newContext();
  const owner = await browser.newContext();
  await admin.request.post("/api/session", { data: { role: "admin" } });
  await from.request.post("/api/session", {
    data: { role: "clinic", clinicId: "sage-sf" },
  });
  await to.request.post("/api/session", {
    data: { role: "clinic", clinicId: "ocean-avenue" },
  });
  await owner.request.post("/api/session", { data: { role: "owner" } });
  const p = (await (await admin.request.get("/api/providers")).json()).find(
    (p: any) => p.id === "ocean-avenue",
  );
  expect(
    (
      await admin.request.patch("/api/providers/ocean-avenue", {
        data: { version: p.version, partner: true },
      })
    ).ok(),
  ).toBe(true);
  const created = await owner.request.post("/api/intakes", {
    data: {
      providerId: "sage-sf",
      ownerName: "Transfer Demo",
      petName: "Handoff " + Date.now(),
      species: "Cat",
      concern: "Fictional referral example",
      duration: "Today",
      contact: "transfer@example.test",
    },
  });
  const intake = await created.json();
  expect(
    (
      await from.request.post(`/api/intakes/${intake.id}/handoff`, {
        data: {
          toProvider: "ocean-avenue",
          summary: "Demo stable transfer; review fictional history.",
        },
      })
    ).ok(),
  ).toBe(true);
  const tp = await to.newPage();
  await tp.goto("/");
  await tp.getByRole("tab", { name: /Handoffs/ }).click();
  const handoff = tp
    .locator(".request-row")
    .filter({ hasText: intake.pet_name });
  await handoff.getByRole("button", { name: "Accept handoff" }).click();
  await expect(handoff).toContainText("Accepted");
  await tp.getByRole("tab", { name: "Patients", exact: true }).click();
  await expect(
    tp.getByRole("row").filter({ hasText: intake.pet_name }),
  ).toBeVisible();
  expect((await from.request.get("/api/intakes/" + intake.id)).status()).toBe(
    403,
  );
  expect((await to.request.get("/api/intakes/" + intake.id)).status()).toBe(
    200,
  );
  expect(
    (await (await owner.request.get("/api/intakes/" + intake.id)).json())
      .provider_id,
  ).toBe("ocean-avenue");
  const latest = (
    await (await admin.request.get("/api/providers")).json()
  ).find((p: any) => p.id === "ocean-avenue");
  await admin.request.patch("/api/providers/ocean-avenue", {
    data: { version: latest.version, partner: false },
  });
  await Promise.all([admin.close(), from.close(), to.close(), owner.close()]);
});
