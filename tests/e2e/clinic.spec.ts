import { test, expect } from "@playwright/test";
test("separate owner and clinic sessions share intakes, assessments, messages and availability", async ({
  browser,
}) => {
  const petName = "Juniper " + Date.now();
  const staffName = "QA Tech " + Date.now();
  const owner = await browser.newContext();
  const staff = await browser.newContext();
  const op = await owner.newPage();
  const cp = await staff.newPage();
  await op.goto("/");
  await expect(
    op.getByRole("button", { name: "Send intake", exact: true }),
  ).toBeVisible();
  const result = await owner.request.post("/api/intakes", {
    data: {
      providerId: "sage-sf",
      ownerName: "Clinic QA Owner",
      petName,
      species: "Dog",
      concern: "Fictional limping patient",
      duration: "Two hours",
      contact: "qa@example.test",
    },
  });
  expect(result.status()).toBe(201);
  const intake = await result.json();
  await cp.goto("/");
  await cp
    .getByRole("button", { name: "Clinic workspace", exact: true })
    .click();
  const row = cp.getByRole("row").filter({ hasText: petName });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Review", exact: true }).click();
  await cp.getByLabel("Clinical assessment").selectOption("Urgent");
  await cp
    .getByLabel("Patient stage", { exact: true })
    .selectOption("Reviewing");
  await cp.getByRole("button", { name: "Save assessment & stage" }).click();
  await expect(
    cp.getByText("Clinical assessment and stage saved.", { exact: true }),
  ).toBeVisible();
  await cp
    .getByRole("textbox", { name: "Clinical note", exact: true })
    .fill("Fictional exam: weight bearing, alert.");
  await cp.getByRole("button", { name: "Add clinical note" }).click();
  await expect(
    cp.getByText("Fictional exam: weight bearing, alert."),
  ).toBeVisible();
  await cp
    .getByRole("textbox", { name: "Message text" })
    .fill("Please call our care team before travelling.");
  await cp.getByRole("button", { name: "Send in-app message" }).click();
  await expect
    .poll(async () => {
      const d = await (
        await owner.request.get("/api/intakes/" + intake.id)
      ).json();
      return d.messages.length;
    })
    .toBe(1);
  const ownerRecord = await (
    await owner.request.get("/api/intakes/" + intake.id)
  ).json();
  expect(ownerRecord.notes).toEqual([]);
  expect(ownerRecord.stage).toBe("Reviewing");
  await cp.getByLabel("Patient stage", { exact: true }).selectOption("Arrived");
  await cp.getByRole("button", { name: "Save assessment & stage" }).click();
  await expect
    .poll(async () => {
      return (
        await (await owner.request.get("/api/intakes/" + intake.id)).json()
      ).stage;
    })
    .toBe("Arrived");
  await cp.getByRole("button", { name: "Close dialog" }).click();
  await cp.getByRole("tab", { name: "Availability & services" }).click();
  await cp.getByRole("button", { name: "Limited", exact: true }).click();
  await cp.getByRole("button", { name: "Publish demo availability" }).click();
  await expect(
    op.locator(".provider-card").filter({ hasText: "SAGE Veterinary Centers" }),
  ).toContainText("Limited");
  // Restore the baseline for the rest of the presentation.
  await cp.getByRole("button", { name: "Accepting", exact: true }).click();
  await cp.getByRole("button", { name: "Publish demo availability" }).click();
  await expect(
    op.locator(".provider-card").filter({ hasText: "SAGE Veterinary Centers" }),
  ).toContainText("Accepting patients");
  await cp.getByRole("tab", { name: "Team coverage" }).click();
  await cp.getByRole("button", { name: "Add team member" }).click();
  await cp.getByLabel("Staff name").fill(staffName);
  await cp.getByLabel("Role", { exact: true }).fill("Technician");
  await cp.getByLabel("Shift hours").fill("10 AM – 6 PM");
  await cp.getByRole("button", { name: "Add demo staff member" }).click();
  await expect(
    cp.locator(".staff-row").filter({ hasText: staffName }),
  ).toBeVisible();
  await cp
    .locator(".staff-row")
    .filter({ hasText: staffName })
    .last()
    .getByRole("button", { name: "End shift" })
    .click();
  await expect(
    cp.locator(".staff-row").filter({ hasText: staffName }).last(),
  ).toContainText("Off duty");
  await owner.close();
  await staff.close();
});
