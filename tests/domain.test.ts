import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  interpret,
  matchProviders,
  liveAvailability,
  allowedStage,
  normalizedPhone,
  type Provider,
} from "../lib/domain";
import { parseSheet } from "../lib/importer";
const provider = (v: Partial<Provider>): Provider => ({
  id: "p",
  name: "Test",
  city: "San Francisco",
  category: "Emergency",
  phone: null,
  address: null,
  website: null,
  lat: 37.77,
  lng: -122.42,
  species: ["Dog", "Cat"],
  services: ["Emergency"],
  hours: "Unknown",
  scope: "",
  cost_note: "Unknown",
  exam_fee: null,
  source_url: "https://example.com",
  source_checked: "2026-11-14",
  source_kind: "public",
  source_notes: "",
  partner: false,
  availability: "Unknown",
  availability_at: null,
  updated_at: "",
  version: 1,
  simulated: false,
  ...v,
});
test("emergency language wins over price, radius and availability preferences", () => {
  assert.equal(
    interpret("my cat cannot breathe, cheapest option please").emergency,
    true,
  );
  const p = [
    provider({
      id: "gp",
      category: "General practice",
      lat: 37.7749,
      lng: -122.4194,
    }),
    provider({ id: "far", lat: 37.2 }),
    provider({ id: "near", lat: 37.78 }),
  ];
  const result = matchProviders(
    p,
    {
      species: "Cat",
      service: "General practice",
      location: "San Francisco",
      available: true,
      radius: 1,
    },
    true,
  );
  assert.deepEqual(
    result.map((x) => x.id),
    ["near", "far"],
  );
});
test("unknown species is explicitly retained for confirmation, unsupported species excluded", () => {
  const p = [
    provider({ id: "unknown", species: [] }),
    provider({ id: "dog", species: ["Dog"] }),
  ];
  const result = matchProviders(p, {
    species: "Rabbit",
    service: "Any care",
    location: "San Francisco",
    available: false,
    radius: 25,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "unknown");
  assert.match(result[0].reasons[0], /confirmation/);
});
test("stale capacity is unknown, never accepting", () => {
  assert.equal(
    liveAvailability(
      provider({
        availability: "Accepting",
        availability_at: new Date(Date.now() - 3600001).toISOString(),
      }),
    ),
    "Unknown",
  );
  assert.equal(
    liveAvailability(
      provider({
        availability: "Accepting",
        availability_at: new Date().toISOString(),
      }),
    ),
    "Accepting",
  );
});
test("patient stage transitions require review and handoff coordination", () => {
  assert.equal(allowedStage("New", "Discharged"), false);
  assert.equal(allowedStage("New", "Reviewing"), true);
  assert.equal(allowedStage("Reviewing", "Arrived"), true);
  assert.equal(allowedStage("In care", "Transferred"), false);
});
test("spreadsheet preamble and all five source interviews are retained", () => {
  const rows = parseSheet(readFileSync("data/hospitals.csv", "utf8"));
  assert.equal(rows.length, 5);
  assert.equal(rows[0]["Interview ID"], "PVES-001");
  assert.equal(
    normalizedPhone(rows[3]["Hospital phone"]),
    normalizedPhone(rows[4]["Hospital phone"]),
  );
});
test("invalid spreadsheet is rejected instead of silently imported", () => {
  assert.throws(() => parseSheet("name,phone\nFake,123"), /Expected/);
});

test("all regional ZIPs, city/state spellings and ZIP+4 resolve without a network dependency", async () => {
  const { postalPlaces, locate, locationInText } =
    await import("../lib/locations");
  assert.ok(Object.keys(postalPlaces).length > 550);
  for (const zip of [
    "94103",
    "94110",
    "94112",
    "95112",
    "94954",
    "94558",
    "95401",
    "94534",
    "94401",
    "94607",
  ])
    assert.ok(locate(zip), zip);
  for (const [zip, [city, lat, lng]] of Object.entries(postalPlaces)) {
    assert.deepEqual(locate(zip), [lat, lng], zip);
    assert.deepEqual(locate(`${city}, CA ${zip}-1234`), [lat, lng]);
    assert.ok(locate(`${city}, California`), city);
  }
  assert.deepEqual(locate(" San José, CA "), locate("San Jose"));
  assert.equal(locationInText("dog needs care near 95112"), "95112");
  assert.equal(locationInText("cat in San Ramon needs help"), "san ramon");
  assert.equal(locationInText("pet care in mountains"), undefined);
  assert.equal(locate("99999"), undefined);
  assert.equal(locate("San Jose, CA 99999"), undefined);
});
test("default list includes every location; invalid entered locations never silently show all", () => {
  const p = [
    provider({ id: "sf" }),
    provider({ id: "unknown", lat: null, lng: null }),
    provider({ id: "sj", lat: 37.3382, lng: -121.8863 }),
  ];
  const f = {
    species: "Any pet",
    service: "Any care",
    location: "",
    available: false,
    radius: 25,
  };
  assert.equal(matchProviders(p, f).length, 3);
  assert.equal(matchProviders(p, { ...f, location: "99999" }).length, 0);
  assert.deepEqual(
    matchProviders(p, { ...f, location: "95112" }).map((x) => x.id),
    ["sj"],
  );
});
test("regional spreadsheet parser retains all 28 sources and geocodes all identified branches", async () => {
  const { parseDirectoryCsv, addressLocation } =
    await import("../lib/directory");
  const rows = parseDirectoryCsv(
    readFileSync("data/pricing-comparison.csv", "utf8"),
    "pricing",
  );
  const audits = parseDirectoryCsv(
    readFileSync("data/website-audit.csv", "utf8"),
    "audit",
  );
  assert.equal(rows.length, 28);
  assert.equal(audits.length, 28);
  for (const row of rows.filter(
    (r) => r["Hospital street address"] !== "Not verified",
  )) {
    const geo = addressLocation(row["Hospital street address"]);
    assert.ok(geo.lat && geo.lng, row.Hospital);
    assert.ok(geo.lat > 37 && geo.lat < 39 && geo.lng < -121 && geo.lng > -123);
  }
  assert.throws(
    () => parseDirectoryCsv("Name,City\nBad,Nowhere", "pricing"),
    /Expected/,
  );
});
