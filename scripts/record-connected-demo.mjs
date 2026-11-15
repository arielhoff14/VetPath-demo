import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3010";
const out = path.resolve("artifacts/video");
await mkdir(out + "/raw", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  slowMo: 160,
  args: ["--no-sandbox"],
});
const pet =
  "Maple-" +
  new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
const contexts = [],
  segments = [],
  assertions = [],
  pageErrors = [];
let current;
async function create() {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1050 },
    recordVideo: { dir: out + "/raw", size: { width: 1440, height: 1050 } },
  });
  const start = Date.now();
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const s = { context, page, start };
  contexts.push(s);
  return s;
}
async function switchTo(s, title, text) {
  if (current) {
    current.end = (Date.now() - current.session.start) / 1000;
    segments.push(current);
  }
  current = { session: s, title, start: (Date.now() - s.start) / 1000 };
  await s.page.bringToFront();
  await caption(s.page, title, text);
  await s.page.waitForTimeout(1800);
}
async function caption(page, title, text) {
  await page.evaluate(
    ({ title, text }) => {
      let el = document.getElementById("walkthrough-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "walkthrough-caption";
        document.body.appendChild(el);
      }
      el.style.cssText =
        "position:fixed;z-index:10000;bottom:0;left:0;right:0;padding:16px 28px;background:#052357f5;color:white;border-top:3px solid #7ce5d9;font:16px/1.4 Arial;pointer-events:none";
      el.replaceChildren();
      const h = document.createElement("b");
      h.textContent = title + " · ";
      const b = document.createElement("span");
      b.textContent = text;
      el.append(h, b);
    },
    { title, text },
  );
}
async function closeModal(page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function openPatient(page) {
  await page
    .getByRole("row")
    .filter({ hasText: pet })
    .getByRole("button", { name: "Review", exact: true })
    .click();
}
async function get(context, url) {
  const r = await context.request.get(url);
  expect(r.ok()).toBe(true);
  return r.json();
}
try {
  const admin = await browser.newContext({ baseURL });
  await admin.request.post("/api/session", { data: { role: "admin" } });
  if (process.env.SKIP_DEMO_RESET !== "true") {
    expect((await admin.request.post("/api/demo/reset",{data:{confirmation:"RESET FICTIONAL CLINICS",requestKey:randomUUID()}})).ok()).toBe(true);
  } else {
    const existing=await get(admin,"/api/activity/demo-harbor");
    expect(existing.capacity).toBe(8);expect(existing.workload).toBe(4);expect(existing.accepting).toBe(true);
    expect((await admin.request.patch("/api/activity/demo-harbor",{data:{version:existing.version,confirm:true}})).ok()).toBe(true);
  }
  const baseline = await get(admin, "/api/activity/demo-harbor");
  expect(baseline.percent).toBe(50);
  const before = await get(admin, "/api/insights");
  const owner = await create(),
    staff = await create();
  const op = owner.page,
    cp = staff.page;
  await op.goto("/");
  await expect(
    op.getByRole("button", { name: "Harbor Pet Urgent Care", exact: true }),
  ).toBeVisible();
  const none = await get(owner.context, "/api/intakes");
  expect(none.some((x) => x.pet_name === pet)).toBe(false);
  await switchTo(
    owner,
    "1 · New owner scenario",
    `Live PostgreSQL demo. ${pet} has not been created. All cases and practice clinics are fictional.`,
  );
  await op
    .getByLabel("Tell us about your pet")
    .pressSequentially(
      "My cat Maple has been limping with a sore front paw for three hours in 95112. Please help me find urgent care.",
      { delay: 35 },
    );
  await op.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(op.getByLabel("Pet species", { exact: true })).toHaveValue(
    "Cat",
  );
  await caption(
    op,
    "Organized requirements",
    "The unconfigured-AI fallback is disclosed. Editable species, location and factual clinic matches come from stored data.",
  );
  const card = op
    .locator(".provider-card")
    .filter({
      has: op.getByRole("button", {
        name: "Harbor Pet Urgent Care",
        exact: true,
      }),
    });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("Lower activity");
  await op.waitForTimeout(2200);
  await card.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await op.getByLabel("Your name").fill("Fictional Casey");
  await op.getByLabel("Pet’s name").fill(pet);
  await op.getByLabel("Demo email or phone").fill("casey@example.test");
  await op.screenshot({path:out+"/owner-inquiry.png"});
  await op.waitForTimeout(2000);
  await op
    .getByRole("button", { name: "Send inquiry to clinic", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText("Inquiry sent");
  const intake = (await get(owner.context, "/api/intakes")).find(
    (i) => i.pet_name === pet,
  );
  expect(intake.provider_id).toBe("demo-harbor");
  assertions.push({
    check: "Unique inquiry persisted at selected clinic",
    id: intake.id,
    pet,
    provider: intake.provider_id,
  });
  await op.waitForTimeout(2000);
  await cp.goto("/");
  await cp
    .getByRole("button", { name: "Clinic workspace", exact: true })
    .click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  await switchTo(
    staff,
    "2 · Separate clinic session",
    "The inquiry reaches Harbor’s incoming queue. Activity remains 50%: inquiries are not arrived patients.",
  );
  await cp.getByRole("row").filter({ hasText: pet }).scrollIntoViewIfNeeded();
  await cp.screenshot({path:out+"/clinic-queue.png",fullPage:true});
  await cp.waitForTimeout(1800);
  await openPatient(cp);
  await expect(cp.getByRole("dialog")).toContainText("limping");
  await cp.screenshot({path:out+"/clinic-patient.png"});
  await cp
    .getByRole("button", { name: "Acknowledge inquiry", exact: true })
    .click();
  await expect(op.getByRole("dialog")).toContainText("Acknowledged");
  await cp.waitForTimeout(1800);
  await cp.getByRole("button", { name: "Record arrival", exact: true }).click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("75%");
  await closeModal(cp);
  await cp.getByTestId("activity-percent").scrollIntoViewIfNeeded();
  await caption(
    cp,
    "Arrival increases activity",
    "6 workload points ÷ 8 capacity = 75%. Staff recorded arrival; this is not inferred from a call or direction click.",
  );
  await cp.waitForTimeout(2800);
  const arrived = await get(admin, "/api/activity/demo-harbor");
  expect(arrived.workload).toBe(6);
  assertions.push({
    check: "Arrival recalculated stored workload",
    percent: arrived.percent,
    workload: arrived.workload,
    capacity: arrived.capacity,
  });
  await expect(op.getByRole("dialog")).toContainText("Checked in");
  await switchTo(
    owner,
    "3 · Owner receives updates",
    "Without reloading the owner session, the inquiry is now checked in. In-app messages are stored with the case.",
  );
  await op.getByRole("button", { name: "Messages", exact: true }).click();
  await expect(op.getByRole("dialog")).toContainText(
    "The clinic has recorded your arrival",
  );
  await op.waitForTimeout(2400);
  await switchTo(
    staff,
    "4 · Clinical review and workload",
    "A veterinary professional records the assessment and assigns intensive workload. Activity is separate from clinical urgency.",
  );
  await cp.getByRole("button", { name: /^At clinic/ }).click();
  await openPatient(cp);
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
  await closeModal(cp);
  await cp.getByTestId("activity-percent").scrollIntoViewIfNeeded();
  await caption(
    cp,
    "Workload updates the meter",
    "8 workload points ÷ 8 capacity = 100%. The formula uses actual saved room, doctor, support and patient records.",
  );
  await cp.waitForTimeout(2500);
  assertions.push({
    check: "Intensive assignment",
    ...(await get(admin, "/api/activity/demo-harbor")),
  });
  await openPatient(cp);
  await cp.getByRole("button", { name: "Complete visit", exact: true }).click();
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  await closeModal(cp);
  await cp.getByTestId("activity-percent").scrollIntoViewIfNeeded();
  await caption(
    cp,
    "Completion decreases activity",
    "Maple’s workload is removed on completion. Baseline activity returns to 4 ÷ 8 = 50%.",
  );
  await cp.waitForTimeout(2500);
  await expect(op.getByRole("dialog")).toContainText("Visit complete");
  await switchTo(
    owner,
    "5 · Owner persistence",
    "The owner receives the completed status. Refreshing keeps the saved inquiry and its messages.",
  );
  await op.reload();
  await op.getByRole("button", { name: "View your care requests" }).click();
  await expect(op.getByRole("dialog")).toContainText("Visit complete");
  await caption(
    op,
    "Owner refreshed",
    "The same unique case remains complete after refresh. No status was faked or changed only in the page.",
  );
  await op.screenshot({path:out+"/owner-complete.png"});
  await op.waitForTimeout(2500);
  await switchTo(
    staff,
    "6 · Clinic persistence",
    "Refresh the independent clinic session, then open Completed. The case and recalculated activity persist.",
  );
  await cp.reload();
  await cp.getByRole("button", { name: /^Completed/ }).click();
  await expect(cp.getByRole("row").filter({ hasText: pet })).toContainText(
    "Discharged",
  );
  await expect(cp.getByTestId("activity-percent")).toHaveText("50%");
  await cp.getByTestId("activity-percent").scrollIntoViewIfNeeded();
  await caption(
    cp,
    "Verified connected workflow",
    `${pet}: inquiry → acknowledged → arrived → clinical review → complete. Activity: 50% → 75% → 100% → 50%.`,
  );
  await cp.waitForTimeout(2800);
  const saved = await get(owner.context, "/api/intakes/" + intake.id);
  expect(saved.stage).toBe("Discharged");
  expect(saved.arrived_at).toBeTruthy();
  expect(saved.completed_at).toBeTruthy();
  expect(saved.notes).toEqual([]);
  expect(saved.messages).toHaveLength(4);
  const end = await get(admin, "/api/activity/demo-harbor");
  expect(end.workload).toBe(4);
  const after = await get(admin, "/api/insights");
  const count = (d, k) => d.counts.find((x) => x.kind === k)?.count || 0;
  for (const k of ["intake_submitted", "confirmed_arrival", "visit_completed"])
    expect(count(after, k) - count(before, k)).toBe(1);
  assertions.push({
    check: "Persisted case after both refreshes",
    id: saved.id,
    stage: saved.stage,
    workload: saved.workload,
    arrivedAt: saved.arrived_at,
    reviewedAt: saved.clinical_reviewed_at,
    completedAt: saved.completed_at,
    messages: saved.messages.length,
    finalActivity: end.percent,
    eventDeltas: Object.fromEntries(
      ["intake_submitted", "confirmed_arrival", "visit_completed"].map((k) => [
        k,
        count(after, k) - count(before, k),
      ]),
    ),
  });
  expect(pageErrors).toEqual([]);
  current.end = (Date.now() - current.session.start) / 1000;
  segments.push(current);
  current = null;
  for (const s of contexts) {
    s.video = s.page.video();
    await s.context.close();
    s.file = await s.video.path();
  }
  const clips = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i],
      file = out + `/chapter-${i + 1}.mp4`;
    const ff = spawnSync(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(seg.start),
        "-i",
        seg.session.file,
        "-t",
        String(seg.end - seg.start),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        file,
      ],
      { stdio: "inherit" },
    );
    if (ff.status !== 0) throw new Error("Video chapter rendering failed");
    clips.push({ title: seg.title, file });
  }
  await writeFile(
    out + "/manifest.json",
    JSON.stringify(
      {
        baseURL,
        recordedAt: new Date().toISOString(),
        pet,
        intakeId: intake.id,
        assertions,
        clips,
        limitations: [
          "Silent browser recording; captions added as overlays.",
          "AI key unconfigured: disclosed structured fallback is shown.",
          "Fictional demo clinics, staff and workload assumptions; no real contact or clinical advice.",
        ],
      },
      null,
      2,
    ),
  );
  await admin.close();
  console.log(
    JSON.stringify({
      pet,
      intakeId: intake.id,
      chapters: clips.length,
      assertions: "passed",
    }),
  );
} finally {
  await browser.close();
}
