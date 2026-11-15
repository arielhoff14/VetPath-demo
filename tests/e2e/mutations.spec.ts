import { test, expect } from "@playwright/test";
test("owner edits, clinic capability edits, new hospitals and validation stay connected", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    clinic = await browser.newContext(),
    admin = await browser.newContext();
  await owner.request.post("/api/session", { data: { role: "owner" } });
  await clinic.request.post("/api/session", {
    data: { role: "clinic", clinicId: "sage-sf" },
  });
  await admin.request.post("/api/session", { data: { role: "admin" } });
  const petName = "Editable " + Date.now();
  const intake = await (
    await owner.request.post("/api/intakes", {
      data: {
        providerId: "sage-sf",
        ownerName: "Editable Owner",
        petName,
        species: "Dog",
        concern: "Fictional concern before update",
        duration: "One hour",
        contact: "edit@example.test",
      },
    })
  ).json();
  const op = await owner.newPage();
  await op.goto("/");
  await op.getByRole("button", { name: "View your care requests" }).click();
  await op.getByRole("button", { name: "Edit request" }).click();
  await op
    .getByLabel("Updated concern")
    .fill("Fictional updated concern visible to the clinic");
  await op.getByRole("button", { name: "Save request changes" }).click();
  await expect(
    op.getByRole("button", { name: "Save request changes" }),
  ).toHaveCount(0);
  const clinicRecord = await (
    await clinic.request.get("/api/intakes/" + intake.id)
  ).json();
  expect(clinicRecord.concern).toContain("updated concern");
  const cp = await clinic.newPage();
  await cp.goto("/");
  await cp.getByRole("tab", { name: "Availability & services" }).click();
  const sage = (await (await clinic.request.get("/api/providers")).json()).find(
    (p: any) => p.id === "sage-sf",
  );
  await cp.getByLabel("Exotics", { exact: true }).check();
  await cp.getByLabel("Rabbit", { exact: true }).check();
  await cp.getByRole("button", { name: "Save species & services" }).click();
  await expect
    .poll(async () => {
      return (await (await owner.request.get("/api/providers")).json()).find(
        (p: any) => p.id === "sage-sf",
      ).species;
    })
    .toContain("Exotics");
  const latest = (
    await (await admin.request.get("/api/providers")).json()
  ).find((p: any) => p.id === "sage-sf");
  await admin.request.patch("/api/providers/sage-sf", {
    data: {
      version: latest.version,
      species: sage.species,
      species_subtypes: sage.species_subtypes,
      services: sage.services,
    },
  });
  const name = "QA Directory " + Date.now();
  const ap = await admin.newPage();
  await ap.goto("/");
  await ap.getByRole("button", { name: "Add hospital", exact: true }).click();
  await ap.getByLabel("Hospital name", { exact: true }).fill(name);
  await ap
    .getByLabel("Street address")
    .fill("1 Demo Street, San Francisco, CA");
  await ap
    .getByLabel("Official source URL")
    .fill("https://example.com/demo-only");
  await ap.getByLabel("Latitude").fill("37.77");
  await ap.getByLabel("Longitude").fill("-122.42");
  await ap.getByRole("button", { name: "Add sourced hospital" }).click();
  await expect(ap.getByRole("row").filter({ hasText: name })).toBeVisible();
  await op.getByRole("button", { name: "Close dialog" }).click();
  await expect(op.getByRole("button", { name, exact: true })).toBeVisible();
  const duplicate = await admin.request.post("/api/admin/providers", {
    data: {
      name,
      city: "San Francisco, CA",
      category: "Emergency",
      phone: null,
      address: "1 Demo Street",
      source_url: "https://example.com/demo-only",
      lat: 37.77,
      lng: -122.42,
    },
  });
  expect(duplicate.status()).toBe(409);
  const bad = await owner.request.post("/api/intakes", {
    data: {
      providerId: "sage-sf",
      ownerName: "",
      petName: "",
      species: "Dragon",
      concern: "",
      duration: "",
      contact: "",
    },
  });
  expect(bad.status()).toBe(400);
  const illegal = await clinic.request.patch("/api/intakes/" + intake.id, {
    data: {
      version: clinicRecord.version,
      stage: "Discharged",
      urgency: "Routine",
    },
  });
  expect(illegal.status()).toBe(400);
  const crossOrigin = await admin.request.patch("/api/providers/sage-sf", {
    headers: { Origin: "https://unrelated.example" },
    data: { version: latest.version, availability: "At capacity" },
  });
  expect(crossOrigin.status()).toBe(403);
  await Promise.all([owner.close(), clinic.close(), admin.close()]);
});
