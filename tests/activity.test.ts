import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateActivity, ownerActivity, localDay } from "../lib/activity";
import { normalizeSpecies, speciesMatch } from "../lib/species";
const now = Date.parse("2026-11-15T12:00:00Z");
const input = {
  rooms: 5,
  doctors: 3,
  support: 5,
  workload: 0,
  verified_at: new Date(now).toISOString(),
};
test("activity exact thresholds and all limiting resources", () => {
  for (const [workload, tone] of [
    [5.9, "green"],
    [6, "yellow"],
    [8.49, "yellow"],
    [8.5, "red"],
    [20, "red"],
  ] as const)
    assert.equal(calculateActivity({ ...input, workload }, now).tone, tone);
  assert.equal(calculateActivity({ ...input, doctors: 1 }, now).capacity, 4);
  assert.deepEqual(calculateActivity({ ...input, doctors: 1 }, now).limiting, [
    "Doctors",
  ]);
  assert.deepEqual(calculateActivity({ ...input, support: 1 }, now).limiting, [
    "Clinical support staff",
  ]);
  assert.deepEqual(calculateActivity({ ...input, rooms: 1 }, now).limiting, [
    "Rooms",
  ]);
});
test("stale, missing, future and zero capacity are unconfirmed", () => {
  for (const verified_at of [
    null,
    new Date(now - 3600000).toISOString(),
    new Date(now + 1).toISOString(),
  ])
    assert.equal(
      calculateActivity({ ...input, verified_at }, now).tone,
      "unknown",
    );
  assert.equal(
    calculateActivity({ ...input, doctors: 0 }, now).tone,
    "unknown",
  );
});
test("override requires fresh resources, a reason and future expiry; acceptance stays separate", () => {
  const override = {
    override_tone: "red",
    override_reason: "Two rooms undergoing cleaning",
    override_until: new Date(now + 60000).toISOString(),
  };
  assert.equal(calculateActivity({ ...input, ...override }, now).tone, "red");
  assert.equal(
    calculateActivity({ ...input, ...override }, now + 60000).tone,
    "green",
  );
  assert.equal(
    calculateActivity({ ...input, ...override, override_reason: "" }, now).tone,
    "green",
  );
  assert.equal(
    calculateActivity({ ...input, ...override, doctors: 0 }, now).tone,
    "unknown",
  );
  const closed = calculateActivity(
    { ...input, closed_on: localDay(new Date(now)) },
    now,
  );
  assert.equal(closed.tone, "green");
  assert.equal(closed.accepting, false);
  assert.equal("capacity" in ownerActivity(closed), false);
});
test("canonical species preserve subtype and reject unsupported species", () => {
  assert.deepEqual(normalizeSpecies("Rabbit"), {
    species: "Exotics",
    subtype: "Rabbit",
  });
  assert.equal(
    speciesMatch({ species: ["Dog", "Cat"] }, "Exotics", "Rabbit"),
    "mismatch",
  );
  assert.equal(
    speciesMatch({ species: ["Exotics"] }, "Exotics", "Rabbit"),
    "unknown",
  );
  assert.equal(
    speciesMatch(
      { species: ["Exotics"], species_subtypes: ["Bird"] },
      "Exotics",
      "Rabbit",
    ),
    "mismatch",
  );
  assert.equal(
    speciesMatch({ species: ["Rabbit"] }, "Exotics", "Rabbit"),
    "confirmed",
  );
  assert.equal(
    speciesMatch(
      { species: ["Farm animals"], species_subtypes: ["Goat"] },
      "Farm animals",
      "Goat",
    ),
    "confirmed",
  );
  assert.equal(
    speciesMatch({ species: [] }, "Other species", "Axolotl"),
    "unknown",
  );
});
