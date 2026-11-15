export const speciesGroups = [
  "Dog",
  "Cat",
  "Exotics",
  "Farm animals",
  "Other species",
] as const;
export const exoticTypes = [
  "Rabbit",
  "Bird",
  "Reptile",
  "Small mammal",
  "Other exotic",
];
export const farmTypes = [
  "Horse",
  "Donkey",
  "Cattle",
  "Goat",
  "Sheep",
  "Pig",
  "Poultry",
  "Other farm",
];
export const allSpeciesValues = [
  ...speciesGroups,
  ...exoticTypes,
  ...farmTypes,
];
export function normalizeSpecies(species: string, subtype = "") {
  if (exoticTypes.includes(species))
    return { species: "Exotics", subtype: species };
  if (farmTypes.includes(species))
    return { species: "Farm animals", subtype: species };
  return {
    species,
    subtype: ["Dog", "Cat", "Any pet"].includes(species) ? "" : subtype.trim(),
  };
}
export function providerSpecies(values: string[]) {
  return {
    species: [...new Set(values.map((v) => normalizeSpecies(v).species))],
    species_subtypes: [
      ...new Set(
        values.map((v) => normalizeSpecies(v).subtype).filter(Boolean),
      ),
    ],
  };
}
export function speciesMatch(
  provider: {
    species: string[];
    species_subtypes?: string[];
    species_list_complete?: boolean;
  },
  species: string,
  subtype = "",
): "confirmed" | "unknown" | "mismatch" {
  if (species === "Any pet") return "confirmed";
  const requested = normalizeSpecies(species, subtype);
  const accepted = providerSpecies(provider.species);
  const subtypes = [
    ...accepted.species_subtypes,
    ...(provider.species_subtypes || []),
  ];
  if (!accepted.species.length) return "unknown";
  if (!accepted.species.includes(requested.species))
    return provider.species_list_complete === false ? "unknown" : "mismatch";
  if (
    ["Exotics", "Farm animals", "Other species"].includes(requested.species)
  ) {
    if (!requested.subtype)
      return requested.species === "Other species" ? "unknown" : "confirmed";
    if (!subtypes.length) return "unknown";
    return subtypes.some(
      (s) => s.toLowerCase() === requested.subtype.toLowerCase(),
    )
      ? "confirmed"
      : provider.species_list_complete === false
        ? "unknown"
        : "mismatch";
  }
  return "confirmed";
}
export function speciesLabel(species: string, subtype?: string) {
  return subtype ? `${species} · ${subtype}` : species;
}
