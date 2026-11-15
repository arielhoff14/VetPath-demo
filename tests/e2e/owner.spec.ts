import { test, expect } from "@playwright/test";
test("owner discovery, comparison, intake and privacy", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The right care. A little closer." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "SAGE Veterinary Centers", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Compare SAGE Veterinary Centers",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Compare Remedy Veterinary Specialists",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Compare care", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Capabilities");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator('a[href="tel:+14155660540"]')).toHaveAttribute(
    "href",
    "tel:+14155660540",
  );
  await expect(
    page.getByRole("link", { name: "Directions to SAGE Veterinary Centers" }),
  ).toHaveAttribute("href", /https:\/\/www.google.com\/maps\/dir/);
  await page.getByRole("button", { name: "Send intake", exact: true }).click();
  await page.getByLabel("Your name").fill("Demo Owner");
  await page.getByLabel("Pet’s name").fill("Scout QA");
  await page
    .getByLabel("What’s going on?")
    .fill("Mild limping since yesterday. Fictional demo.");
  await page.getByLabel("Demo email or phone").fill("owner@example.test");
  await page
    .getByRole("button", { name: "Send demo intake", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Scout QA");
  const own = await (await page.request.get("/api/intakes")).json();
  const target = own.find((x: any) => x.pet_name === "Scout QA");
  expect(target).toBeTruthy();
  const outsider = await browser.newContext();
  expect(
    (
      await outsider.request.get(
        new URL("/api/intakes/" + target.id, page.url()).toString(),
      )
    ).status(),
  ).toBe(403);
  await outsider.close();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("textbox", { name: "Tell us about your pet" })
    .fill("My cat cannot breathe in San Francisco");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Seek veterinary attention now.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Remedy Veterinary Specialists",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("mobile layout and simulated geolocation", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(page.getByLabel("Search location")).toHaveValue("My location");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/owner-mobile.png",
    fullPage: true,
  });
  await context.close();
});
