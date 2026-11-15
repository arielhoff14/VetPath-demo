import { test } from "node:test";
import assert from "node:assert/strict";
import { directoryFeeFields, formatFee, priceNumber } from "../lib/fees";
import { matchProviders, type Provider } from "../lib/domain";
const base = {
  species: "Dog",
  service: "Any care",
  location: "San Jose",
  available: false,
  radius: 25,
};
const p = (
  id: string,
  fee: number | null,
  tone: string,
  lat = 37.338,
): Provider => ({
  id,
  name: id,
  city: "San Jose",
  category: "Emergency",
  phone: null,
  address: null,
  website: null,
  lat,
  lng: -121.886,
  species: ["Dog"],
  services: ["Emergency"],
  hours: "24/7",
  scope: "",
  cost_note: "",
  exam_fee: fee,
  source_url: "",
  source_checked: "",
  source_kind: "demo",
  source_notes: "",
  partner: true,
  availability: "Unknown",
  availability_at: null,
  updated_at: "",
  version: 1,
  simulated: true,
  activity: {
    tone,
    label: tone,
    updated_at: "",
    acceptance: "",
    accepting: true,
    fresh: tone !== "unknown",
    overridden: false,
  },
});
test("fees parse legacy/named columns, prefer explicit published exams and reject treatment ranges", () => {
  assert.equal(directoryFeeFields({ "": "$230" }).exam_fee, 230);
  assert.equal(directoryFeeFields({ "Exam fee": "$220" }).exam_fee, 220);
  assert.equal(
    directoryFeeFields(
      { "Exam fee": "$85" },
      {
        "Price evidence / limits":
          "Urgent/emergency page lists urgent exam $110 and emergency exam $150.",
      },
    ).exam_fee,
    110,
  );
  assert.equal(
    directoryFeeFields(
      {},
      { "Price evidence / limits": "MRI $4,000; dentistry $2,500–$7,500." },
    ).exam_fee,
    undefined,
  );
  assert.equal(
    directoryFeeFields({
      Notes: "$230 for weekends & after 8pm, $175 weekdays 8am-8pm",
    }).exam_fee,
    175,
  );
  assert.equal(priceNumber(""), null);
  assert.equal(priceNumber("-5"), null);
  assert.equal(priceNumber("$100–200"), null);
  assert.equal(formatFee("0.00"), "$0");
});
test("distance, price and fresh activity compose; unknown prices and stale activity cannot satisfy limits", () => {
  const all = [
    p("near", 110, "green"),
    p("busy", 165, "yellow"),
    p("high", 225, "red"),
    p("unknown", null, "unknown"),
    p("far", 80, "green", 38.1),
  ];
  assert.deepEqual(
    matchProviders(all, {
      ...base,
      maxFee: 150,
      activityLevel: "green",
      radius: 10,
    }).map((p) => p.id),
    ["near"],
  );
  assert.deepEqual(
    matchProviders(all, { ...base, maxFee: 165, sortBy: "price" }).map(
      (p) => p.id,
    ),
    ["near", "busy"],
  );
  assert.deepEqual(
    matchProviders(all, { ...base, activityLevel: "unknown" }).map((p) => p.id),
    ["unknown"],
  );
  assert.deepEqual(
    matchProviders(all, { ...base, sortBy: "activity" }).map((p) => p.id),
    ["near", "busy", "high", "unknown"],
  );
  assert.deepEqual(
    matchProviders(all, { ...base, sortBy: "price" }).map((p) => p.id),
    ["near", "busy", "high", "unknown"],
  );
  assert.equal(
    matchProviders([p("zero", 0, "green")], { ...base, maxFee: 0 }).length,
    1,
  );
});
test("clinical emergency bypasses all convenience constraints and preserves species matching", () => {
  const all = [
    p("near-expensive", 400, "red"),
    p("far", 200, "unknown", 38.1),
    { ...p("cat-only", 10, "green"), species: ["Cat"] },
  ];
  assert.deepEqual(
    matchProviders(
      all,
      {
        ...base,
        radius: 1,
        maxFee: 50,
        activityLevel: "green",
        sortBy: "price",
        available: true,
      },
      true,
    ).map((p) => p.id),
    ["near-expensive", "far"],
  );
});
