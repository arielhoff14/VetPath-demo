"use client";
import { speciesGroups, exoticTypes, farmTypes } from "@/lib/species";
export function SpeciesFields({
  species,
  subtype,
  setSpecies,
  setSubtype,
  filter = false,
}: {
  species: string;
  subtype: string;
  setSpecies: (s: string) => void;
  setSubtype: (s: string) => void;
  filter?: boolean;
}) {
  const types =
    species === "Exotics"
      ? exoticTypes
      : species === "Farm animals"
        ? farmTypes
        : [];
  return (
    <>
      <label className="field">
        <span>{filter ? "Pet species" : "Species"}</span>
        <select
          aria-label={filter ? "Pet species" : "Species"}
          name="species"
          required={!filter}
          value={species}
          onChange={(e) => {
            setSpecies(e.target.value);
            setSubtype("");
          }}
        >
          {filter ? (
            <option>Any pet</option>
          ) : (
            <option value="">Choose species</option>
          )}
          {speciesGroups.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {types.length > 0 && (
        <label className="field">
          <span>Animal type</span>
          <select
            name="speciesSubtype"
            aria-label="Animal type"
            required={!filter}
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
          >
            <option value="">
              {filter ? "Choose type for a better match" : "Choose animal type"}
            </option>
            {types.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      {species === "Other species" && (
        <label className="field">
          <span>Animal type</span>
          <input
            name="speciesSubtype"
            aria-label="Animal type"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            required={!filter}
            maxLength={80}
            placeholder="For example, axolotl"
          />
        </label>
      )}
    </>
  );
}
