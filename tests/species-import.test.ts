import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDirectoryCsv } from "../lib/directory";
import {
  parseSpeciesListing,
  directorySpeciesFields,
} from "../lib/species-import";
import { speciesMatch } from "../lib/species";
const pricing = parseDirectoryCsv(
  readFileSync("data/pricing-comparison.csv", "utf8"),
  "pricing",
);
const audits = parseDirectoryCsv(
  readFileSync("data/website-audit.csv", "utf8"),
  "audit",
);
const fields = (name: string) => {
  const row = pricing.find((r) => r.Hospital === name)!;
  return directorySpeciesFields(
    row,
    audits.find((a) => a["Hospital / source-row label"] === name),
  );
};
test("all spreadsheet exotic labels and explicit subtypes survive import", () => {
  for (const row of pricing) {
    const imported = directorySpeciesFields(
      row,
      audits.find((a) => a["Hospital / source-row label"] === row.Hospital),
    );
    if (/exotics|rabbits|birds/.test(row["Animals Treated"]))
      assert.ok(imported.species?.includes("Exotics"), row.Hospital);
    assert.ok(
      imported.species_evidence.includes(
        row["Animals Treated"] || "not supplied",
      ),
    );
  }
  const sj = fields("Veterinary Emergency Group (San Jose)");
  assert.deepEqual(sj.species, ["Dog", "Cat", "Exotics"]);
  assert.ok(sj.species_subtypes?.includes("Bird"));
  assert.ok(sj.species_subtypes?.includes("Reptile"));
  assert.equal(speciesMatch(sj as any, "Exotics"), "confirmed");
  assert.equal(speciesMatch(sj as any, "Exotics", "Rabbit"), "unknown");
});
test("website species evidence enriches affirmative branch statements, not group menus or staff interests", () => {
  assert.ok(
    fields("Bishop Ranch Veterinary Center & Urgent Care").species?.includes(
      "Exotics",
    ),
  );
  assert.ok(
    fields(
      "Pacific Veterinary Emergency + Specialty Hospital",
    ).species_subtypes?.includes("Small mammal"),
  );
  for (const name of [
    "MedVet (Silicon Valley)",
    "MedVet (Campbell)",
    "MedVet (Mountain View)",
    "Pet Emergency & Specialty Center or Marin",
  ])
    assert.equal(fields(name).species?.includes("Exotics"), false, name);
  assert.equal(
    speciesMatch(fields("MedVet (Campbell)") as any, "Exotics"),
    "mismatch",
  );
  const partial = fields("Pacific Veterinary Emergency + Specialty Hospital");
  assert.equal(speciesMatch(partial as any, "Dog"), "unknown");
});
test("negative species clauses never become accepted farm animals; conditional source text is retained", () => {
  const sr = fields("Veterinary Emergency Group (San Ramon)");
  assert.ok(sr.species?.includes("Dog"));
  assert.ok(sr.species_subtypes?.includes("Bird"));
  assert.ok(!sr.species?.includes("Farm animals"));
  assert.ok(sr.species_evidence.includes("No large animals"));
  assert.deepEqual(
    parseSpeciesListing("Dogs, cats, exotics. No horses, cows or goats.")
      .species,
    ["Dog", "Cat", "Exotics"],
  );
  const larkspur = fields("Veterinary Emergency Group (Larkspur)");
  assert.ok(larkspur.species_subtypes?.includes("Donkey"));
  assert.ok(larkspur.species_evidence.includes("stabilize"));
});
