import { test, expect } from "@playwright/test";
import { Pool } from "pg";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => db.end());
test("San Jose species search includes sourced clinics, provenance, subtype limits and three balanced practice clinics", async ({
  page,
}) => {
  await page.goto("/");
  const providers = await (await page.request.get("/api/providers")).json();
  const realNames = [
    "Veterinary Emergency Group (San Jose)",
    "ARCHVET — Winchester",
    "Alum Rock Animal Hospital",
  ];
  for (const name of realNames) {
    const p = providers.find((p: any) => p.name === name);
    expect(p.fictional).toBe(false);
    expect(p.species).toContain("Exotics");
    expect(p.species_evidence.length).toBeGreaterThan(40);
    const row = (await db.query("SELECT * FROM providers WHERE id=$1", [p.id]))
      .rows[0];
    expect(row.species).toContain("Exotics");
    expect(row.postal_code).toMatch(/^951/);
  }
  const demos = providers.filter((p: any) => p.fictional);
  expect(demos).toHaveLength(3);
  for (const p of demos) {
    expect(p.city).toBe("San Jose, CA");
    expect(p.species).toContain("Exotics");
  }
  await page.getByLabel("Pet species", { exact: true }).selectOption("Exotics");
  for (const location of ["San Jose", "95112", "95131"]) {
    await page.getByLabel("Search location").fill(location);
    for (const name of [...realNames, ...demos.map((d: any) => d.name)])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "MedVet Silicon Valley", exact: true }),
    ).toHaveCount(0);
  }
  await page.getByLabel("Animal type", { exact: true }).selectOption("Reptile");
  await expect(
    page.getByRole("button", { name: "ARCHVET — Winchester", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Veterinary Emergency Group (San Jose)",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Spreadsheet Animals Treated: dogs, cats, exotics",
  );
  await expect(page.getByRole("dialog")).toContainText("Website audit:");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.screenshot({
    path: "test-results/san-jose-exotics.png",
    fullPage: true,
  });
});
