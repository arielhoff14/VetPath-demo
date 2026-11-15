import { providerSpecies } from "./species";
/** Parse affirmative spreadsheet labels; preserve exclusions as evidence, never as accepted species. */
export function parseSpeciesListing(value: string) {
  const positive = value
    .toLowerCase()
    .replace(/\b(?:no|not|does not|do not|don't|cannot|can't)\b[^.;\n]*/g, "");
  const names: [string, RegExp][] = [
    ["Dog", /\bdogs?\b|\bcanine/],
    ["Cat", /\bcats?\b|\bfeline/],
    ["Exotics", /\bexotics?\b/],
    ["Rabbit", /\brabbits?\b|\bbunn/],
    ["Bird", /\bbirds?\b|\bavians?\b|feathered/],
    ["Reptile", /\breptiles?\b|\blizards?\b|\bsnakes?\b|\bturtles?\b/],
    [
      "Small mammal",
      /pocket pets|small mammals|guinea pigs|hamsters|ferrets|chinchillas/,
    ],
    ["Horse", /\bhorses?\b/],
    ["Donkey", /\bdonkeys?\b/],
    ["Cattle", /\bcattle\b|\bcows?\b/],
    ["Goat", /\bgoats?\b/],
    ["Sheep", /\bsheep\b/],
    ["Pig", /\bpigs?\b/],
    ["Poultry", /\bpoultry\b|\bchickens?\b/],
    ["Farm animals", /farm animals|livestock/],
  ];
  return providerSpecies(
    names.filter(([, pattern]) => pattern.test(positive)).map(([name]) => name),
  );
}
export function directorySpeciesFields(
  row: Record<string, string>,
  audit?: Record<string, string>,
) {
  const raw = row["Animals Treated"] || "";
  const evidence = audit?.["Species evidence / limits"] || "";
  // Audit only affirmative, branch-specific species statements. Group menus, staff interests
  // and absence-of-evidence prose must never imply admission eligibility.
  const affirmative = evidence
    .split(/\n|(?<=\.)\s+/)
    .filter((s) =>
      /^(FAQ names|Location page advertises|Local site advertises|Homepage explicitly describes|Services page has an Exotic Pets service)/i.test(
        s,
      ),
    );
  const listed = parseSpeciesListing(raw);
  const audited = parseSpeciesListing(affirmative.join(" "));
  return {
    ...(raw.trim() || affirmative.length
      ? {
          species: [...new Set([...listed.species, ...audited.species])],
          species_subtypes: [
            ...new Set([
              ...listed.species_subtypes,
              ...audited.species_subtypes,
            ]),
          ],
        }
      : {}),
    species_list_complete: /\bonly\b/i.test(raw),
    species_evidence: [
      raw
        ? `Spreadsheet Animals Treated: ${raw}`
        : "Spreadsheet species list: not supplied.",
      evidence ? `Website audit: ${evidence}` : "",
      "Published/interview scope is not current intake acceptance. Call to confirm the exact animal and on-duty capability.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
