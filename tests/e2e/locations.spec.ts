import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("unfiltered directory, San Jose neighbors, regional cities and ZIPs", async ({
  page,
}) => {
  await page.goto("/");
  const providers = await (await page.request.get("/api/providers")).json();
  expect(providers.length).toBeGreaterThanOrEqual(29);
  await expect(page.getByLabel("Search location")).toHaveValue("");
  await expect(page.locator(".provider-card")).toHaveCount(providers.length);
  await expect(
    page.getByRole("heading", { name: "Explore all care locations" }),
  ).toBeVisible();
  for (const location of [
    "San Jose",
    "san josé, CA",
    "95112",
    "95131",
    "San Jose, CA 95112-1234",
  ]) {
    await page.getByLabel("Search location").fill(location);
    for (const phone of [
      "4086497070",
      "4088348180",
      "4083716252",
      "4083437243",
      "6504941461",
    ]) {
      await expect(
        page.locator(`.provider-card a[href="tel:+1${phone}"]`),
      ).toBeVisible();
    }
    await expect(
      page.locator('.provider-card a[href="tel:+17078641444"]'),
    ).toHaveCount(0);
  }
  const pairs = [
    ["San Francisco", "94110", "4155660540"],
    ["Oakland", "94607", "5108794888"],
    ["Lafayette", "94549", "9252975751"],
    ["Walnut Creek", "94598", "9259375000"],
    ["Concord", "94520", "9256277243"],
    ["Dublin", "94568", "9255747243"],
    ["San Ramon", "94583", "9257187771"],
    ["Mountain View", "94040", "6504941461"],
    ["Campbell", "95008", "4083437243"],
    ["Redwood City", "94063", "6504177243"],
    ["San Mateo", "94401", "6503482575"],
    ["Fremont", "94539", "5106576343"],
    ["Petaluma", "94954", "7079408444"],
    ["Greenbrae", "94904", "4156518118"],
    ["San Rafael", "94903", "4154567372"],
    ["Fairfield", "94534", "7078641444"],
    ["Napa", "94558", "7078641444"],
    ["Santa Rosa", "95401", "7079408444"],
  ];
  for (const [city, zip, phone] of pairs) {
    for (const value of [city, zip]) {
      await page.getByLabel("Search location").fill(value);
      await expect(
        page.locator(`.provider-card a[href="tel:+1${phone}"]`),
      ).toBeVisible();
    }
  }
  await page.getByLabel("Search location").fill("99999");
  await expect(
    page.getByText(/We couldn’t find that city or ZIP/),
  ).toBeVisible();
  await expect(page.locator(".provider-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear location filter" }).click();
  await expect(page.locator(".provider-card")).toHaveCount(providers.length);
  await page
    .getByLabel("Tell us about your pet")
    .fill("My dog needs care near 95112");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Search location")).toHaveValue("95112");
  await expect(
    page.locator('.provider-card a[href="tel:+14088348180"]'),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/san-jose-zip.png",
    fullPage: true,
  });
});

test("directory imports deduplicate branches and address edits update owner ZIP results across sessions", async ({
  browser,
}) => {
  const admin = await browser.newContext();
  const owner = await browser.newContext();
  await admin.request.post("/api/session", { data: { role: "admin" } });
  const before = await (await admin.request.get("/api/providers")).json();
  const target = before.find((p: any) => p.phone === "4088348180");
  expect(target.address).toContain("725 Ridder Park");
  expect(target.postal_code).toBe("95131");
  const page = await owner.newPage();
  await page.goto("/");
  await page.getByLabel("Search location").fill("95131");
  const card = page.locator(".provider-card").filter({ hasText: target.name });
  await expect(card).toBeVisible();
  const edit = await admin.request.patch(`/api/providers/${target.id}`, {
    data: {
      version: target.version,
      address: "4400 Central Place, Fairfield, CA 94534",
      city: "Fairfield, CA",
    },
  });
  expect(edit.ok()).toBe(true);
  const updated = await edit.json();
  expect(updated.postal_code).toBe("94534");
  expect(updated.lat).not.toBe(target.lat);
  await expect(card).toHaveCount(0);
  const csv = readFileSync("data/pricing-comparison.csv", "utf8");
  for (let i = 0; i < 2; i++)
    expect(
      (await admin.request.post("/api/admin/import", { data: { csv } })).ok(),
    ).toBe(true);
  const after = await (await admin.request.get("/api/providers")).json();
  expect(after).toHaveLength(before.length);
  expect(after.find((p: any) => p.id === target.id).address).toContain(
    "Fairfield",
  );
  const overview = await (
    await admin.request.get("/api/admin/overview")
  ).json();
  expect(overview.directorySources).toHaveLength(28);
  const addressConflict = overview.conflicts.find(
    (c: any) => c.provider_id === target.id && c.field === "address",
  );
  expect(addressConflict).toBeTruthy();
  expect(
    (
      await admin.request.post("/api/admin/conflicts", {
        data: { id: addressConflict.id, apply: true },
      })
    ).ok(),
  ).toBe(true);
  const cityConflict = overview.conflicts.find(
    (c: any) => c.provider_id === target.id && c.field === "city",
  );
  expect(
    (
      await admin.request.post("/api/admin/conflicts", {
        data: { id: cityConflict.id, apply: true },
      })
    ).ok(),
  ).toBe(true);
  await expect(card).toBeVisible();
  const restored = (
    await (await admin.request.get("/api/providers")).json()
  ).find((p: any) => p.id === target.id);
  expect(restored.lat).toBe(target.lat);
  expect(restored.postal_code).toBe("95131");
  const ap = await admin.newPage();
  await ap.goto("/");
  await ap.getByLabel("Search hospital directory").fill("95131");
  await expect(
    ap.getByRole("row").filter({ hasText: target.name }),
  ).toBeVisible();
  await Promise.all([admin.close(), owner.close()]);
});
