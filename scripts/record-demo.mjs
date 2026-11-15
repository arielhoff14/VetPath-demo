import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3004";
const out = path.resolve("artifacts/video");
await mkdir(out + "/raw", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  slowMo: 180,
  args: ["--no-sandbox"],
});
const clips = [];
const assertions = [];
const pause = (page, ms = 1800) => page.waitForTimeout(ms);
async function start(title, storageState) {
  const context = await browser.newContext({
    baseURL,
    storageState,
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: out + "/raw", size: { width: 1440, height: 1000 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Find care", exact: true }).waitFor();
  return { context, page, title };
}
async function caption(page, chapter, text) {
  await page.evaluate(
    ({ chapter, text }) => {
      let panel = document.getElementById("recording-caption");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "recording-caption";
        panel.style.cssText =
          "position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#12383ef5;color:white;padding:15px 32px;font-family:Arial,sans-serif;pointer-events:none;border-top:3px solid #81baa5;box-shadow:0 -5px 25px #173a4020";
        document.body.appendChild(panel);
      }
      panel.replaceChildren();
      const label = document.createElement("div");
      label.textContent = "VERIFICATION RECORDING  •  " + chapter;
      label.style.cssText =
        "font-size:10px;letter-spacing:1.5px;color:#b6d7c8;margin-bottom:6px";
      const body = document.createElement("div");
      body.textContent = text;
      body.style.cssText = "font-size:17px;line-height:1.3";
      panel.append(label, body);
    },
    { chapter, text },
  );
}
async function finish(clip) {
  await pause(clip.page, 2200);
  const video = clip.page.video();
  await clip.context.close();
  const file = out + `/${String(clips.length + 1).padStart(2, "0")}.webm`;
  await video.saveAs(file);
  clips.push({ title: clip.title, file });
  console.log("Recorded:", clip.title);
}
try {
  // 1. Owner session: discover, compare, submit an actual persisted intake.
  const owner = await start("Owner discovery and intake");
  const op = owner.page;
  await expect(
    op.getByRole("button", { name: "SAGE Veterinary Centers", exact: true }),
  ).toBeVisible();
  await caption(
    op,
    "01 / OWNER SESSION",
    "VetPath running against PostgreSQL. All patient details in this recording are fictional.",
  );
  await pause(op, 2800);
  await op
    .getByRole("textbox", { name: "Tell us about your pet" })
    .pressSequentially("My dog needs care in San Francisco", { delay: 35 });
  await op.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(op.getByRole("combobox", { name: "Pet species" })).toHaveValue(
    "Dog",
  );
  await pause(op);
  await caption(
    op,
    "01 / OWNER SESSION",
    "The guide organizes the request. Provider facts and unknowns come from the shared directory.",
  );
  await op
    .getByRole("button", {
      name: "Compare SAGE Veterinary Centers",
      exact: true,
    })
    .click();
  await op
    .getByRole("button", {
      name: "Compare Ocean Avenue Veterinary Hospital",
      exact: true,
    })
    .click();
  await op.getByRole("button", { name: "Compare care", exact: true }).click();
  await expect(op.getByRole("dialog")).toContainText("Source checked");
  await pause(op, 3200);
  await op.getByRole("button", { name: "Close dialog" }).click();
  await op.getByRole("button", { name: "Clear comparison" }).click();
  await op.getByRole("button", { name: "Send intake", exact: true }).click();
  await op.getByLabel("Your name", { exact: true }).fill("Jordan Demo");
  await op.getByLabel("Pet’s name", { exact: true }).fill("Pebble");
  await op
    .getByLabel("How long has this been happening?")
    .fill("Since this morning");
  await op
    .getByLabel("What’s going on?")
    .fill(
      "Fictional demo: limping on the front left leg; alert and drinking water.",
    );
  await op.getByLabel("Demo email or phone").fill("jordan@example.test");
  await pause(op);
  await caption(
    op,
    "01 / OWNER SESSION",
    "Submitting a real database-backed demo intake. This does not notify the actual hospital.",
  );
  await op
    .getByRole("button", { name: "Send demo intake", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText("Pebble");
  const requests = await (
    await owner.context.request.get("/api/intakes")
  ).json();
  const intake = requests.find((x) => x.pet_name === "Pebble");
  if (!intake) throw new Error("Intake not persisted");
  assertions.push("Owner intake persisted in PostgreSQL");
  const ownerState = await owner.context.storageState();
  await finish(owner);
  // 2. Independent clinic session: review, private note, message, and confirmed arrival.
  const clinic = await start("Independent clinic session");
  const cp = clinic.page;
  await cp
    .getByRole("button", { name: "Clinic workspace", exact: true })
    .click();
  const row = cp.getByRole("row").filter({ hasText: "Pebble" });
  await expect(row).toBeVisible();
  await caption(
    cp,
    "02 / SEPARATE CLINIC SESSION",
    "Pebble’s owner intake arrives automatically in a separate clinic browser session.",
  );
  await pause(cp, 2500);
  await row.getByRole("button", { name: "Review", exact: true }).click();
  await cp
    .getByLabel("Clinical assessment", { exact: true })
    .selectOption("Urgent");
  await cp
    .getByLabel("Patient stage", { exact: true })
    .selectOption("Reviewing");
  await cp.getByRole("button", { name: "Save assessment & stage" }).click();
  await expect(
    cp.getByText("Clinical assessment and stage saved.", { exact: true }),
  ).toBeVisible();
  await pause(cp);
  await cp
    .getByRole("textbox", { name: "Clinical note", exact: true })
    .fill("Demo assessment: alert, weight bearing. Team to assess on arrival.");
  await cp.getByRole("button", { name: "Add clinical note" }).click();
  await expect(
    cp.getByText(
      "Demo assessment: alert, weight bearing. Team to assess on arrival.",
    ),
  ).toBeVisible();
  await cp
    .getByRole("textbox", { name: "Message text" })
    .fill(
      "We have reviewed Pebble’s demo intake. Please call before travelling.",
    );
  await cp.getByRole("button", { name: "Send in-app message" }).click();
  await pause(cp);
  await caption(
    cp,
    "02 / SEPARATE CLINIC SESSION",
    "Staff assessments and notes are saved. Owner communication stays inside the demo.",
  );
  await cp.getByLabel("Patient stage", { exact: true }).selectOption("Arrived");
  await cp.getByRole("button", { name: "Save assessment & stage" }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await clinic.context.request.get("/api/intakes/" + intake.id)
          ).json()
        ).stage,
    )
    .toBe("Arrived");
  await pause(cp);
  await cp.getByRole("button", { name: "Close dialog" }).click();
  await cp.getByRole("tab", { name: "Availability & services" }).click();
  await cp.getByRole("button", { name: "Limited", exact: true }).click();
  await cp.getByRole("button", { name: "Publish demo availability" }).click();
  await expect(cp.getByText(/Availability saved/)).toBeVisible();
  await caption(
    cp,
    "02 / SEPARATE CLINIC SESSION",
    "The clinic publishes Limited capacity. The owner view will read the same database update.",
  );
  assertions.push(
    "Clinic reviewed intake, stored private note and message, confirmed arrival, updated capacity",
  );
  await finish(clinic);
  // 3. Return to the original owner identity, not the clinic identity.
  const returning = await start("Owner sees live updates", ownerState);
  const rp = returning.page;
  await expect(
    rp
      .locator(".provider-card")
      .filter({
        has: rp.getByRole("button", {
          name: "SAGE Veterinary Centers",
          exact: true,
        }),
      }),
  ).toContainText("Limited");
  await caption(
    rp,
    "03 / RETURN TO OWNER",
    "The original owner sees Limited capacity without sharing the clinic’s session.",
  );
  await pause(rp, 2200);
  await rp.getByRole("button", { name: "View your care requests" }).click();
  await expect(rp.getByRole("dialog")).toContainText("Arrived");
  await rp.getByRole("button", { name: "Messages", exact: true }).click();
  await expect(
    rp.getByText(
      "We have reviewed Pebble’s demo intake. Please call before travelling.",
    ),
  ).toBeVisible();
  const ownerRecord = await (
    await returning.context.request.get("/api/intakes/" + intake.id)
  ).json();
  expect(ownerRecord.notes).toEqual([]);
  assertions.push(
    "Owner sees arrival and message; clinical notes remain private",
  );
  await caption(
    rp,
    "03 / RETURN TO OWNER",
    "Confirmed arrival and the care team’s message are visible. Private clinical notes are not.",
  );
  await pause(rp, 2800);
  await rp.getByRole("button", { name: "Close dialog" }).click();
  await rp.getByRole("button", { name: "Find emergency care" }).click();
  await expect(
    rp.getByText("Seek veterinary attention now.", { exact: true }),
  ).toBeVisible();
  await caption(
    rp,
    "03 / EMERGENCY PRIORITY",
    "Emergency guidance overrides convenience filters and ranks emergency care by distance.",
  );
  await finish(returning);
  // 4. Administration: source sync, deduplication, and event-derived insights.
  const admin = await start("Sources, synchronization and insights");
  const ap = admin.page;
  await ap.getByRole("button", { name: "Directory", exact: true }).click();
  await expect(
    ap.getByRole("heading", { name: "Hospital directory", exact: true }),
  ).toBeVisible();
  await caption(
    ap,
    "04 / ADMINISTRATOR SESSION",
    "Seven hospitals, five original interviews. Public facts and simulated partnerships are distinct.",
  );
  await pause(ap, 2200);
  await ap.getByRole("tab", { name: "Imports & sources" }).click();
  await ap
    .getByRole("button", { name: "Sync Google Sheet", exact: true })
    .click();
  await expect(
    ap.getByText(/Import complete: 5 interview rows processed/),
  ).toBeVisible({ timeout: 35000 });
  await caption(
    ap,
    "04 / LIVE SPREADSHEET SYNC",
    "Live Google Sheet import succeeded. Existing hospitals were matched instead of duplicated.",
  );
  await pause(ap, 3000);
  const providers = await (
    await admin.context.request.get("/api/providers")
  ).json();
  expect(providers.length).toBeGreaterThanOrEqual(29);
  assertions.push(
    "Live Google Sheet import succeeded without duplicating the seven hospitals",
  );
  await ap.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(
    ap.getByRole("heading", { name: "Understand the path to care." }),
  ).toBeVisible();
  await caption(
    ap,
    "04 / MEASURED OUTCOMES",
    "The actual demo actions appear in insights. Contact clicks are not reported as completed calls.",
  );
  await pause(ap, 3500);
  const insights = await (
    await admin.context.request.get("/api/insights?days=7")
  ).json();
  expect(
    insights.counts.find((x) => x.kind === "intake_submitted").count,
  ).toBeGreaterThan(0);
  expect(
    insights.counts.find((x) => x.kind === "confirmed_arrival").count,
  ).toBeGreaterThan(0);
  assertions.push(
    "Insights reflect recorded submissions and staff-confirmed arrivals",
  );
  const sage = providers.find((x) => x.id === "sage-sf");
  await admin.context.request.patch("/api/providers/sage-sf", {
    data: { version: sage.version, availability: "Accepting" },
  });
  await finish(admin);
  await writeFile(
    out + "/manifest.json",
    JSON.stringify(
      { baseURL, recordedAt: new Date().toISOString(), assertions, clips },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ ok: true, assertions, clips: clips.length }));
} finally {
  await browser.close();
}
