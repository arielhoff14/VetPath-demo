import { speciesMatch, speciesLabel } from "./species";
import { locate, locationInText } from "./locations";
export { locate, places } from "./locations";
export type Provider = {
  id: string;
  name: string;
  city: string;
  category: string;
  phone: string | null;
  address: string | null;
  postal_code?: string | null;
  coordinate_source?: string;
  address_checked?: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  species: string[];
  species_subtypes?: string[];
  fictional?: boolean;
  activity?: {
    tone: string;
    label: string;
    updated_at: string | null;
    acceptance: string;
    accepting: boolean;
    fresh: boolean;
    overridden: boolean;
  } | null;
  services: string[];
  hours: string;
  scope: string;
  cost_note: string;
  exam_fee: number | null;
  source_url: string;
  source_checked: string;
  source_kind: string;
  source_notes: string;
  partner: boolean;
  availability: string;
  availability_at: string | null;
  updated_at: string;
  version: number;
  simulated: boolean;
  field_overrides?: string[];
  distance?: number;
  reasons?: string[];
};
export type Filters = {
  species: string;
  subtype?: string;
  service: string;
  location: string;
  radius: number;
  available: boolean;
  lat?: number;
  lng?: number;
};
export function distance(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180;
  const v =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
export function liveAvailability(p: Provider) {
  if (p.activity)
    return !p.activity.accepting
      ? "Not accepting today"
      : !p.activity.fresh
        ? "Unknown"
        : "Accepting";
  return p.availability_at &&
    Date.now() - new Date(p.availability_at).getTime() < 60 * 60 * 1000
    ? p.availability
    : "Unknown";
}
export function interpret(text: string) {
  const s = text.toLowerCase();
  const emergency =
    /breath|seizur|collaps|unconscious|poison|toxin|hit by|severe bleed|can't (pee|urinate)|cannot (pee|urinate)|chocolate|not breathing/.test(
      s,
    );
  let species: string | undefined;
  let subtype: string | undefined;
  if (/\b(cat|kitten|feline)\b/.test(s)) species = "Cat";
  else if (/\b(dog|puppy|canine|pup)\b/.test(s)) species = "Dog";
  else if (/\b(rabbit|bunny)\b/.test(s)) {
    species = "Exotics";
    subtype = "Rabbit";
  } else if (/\b(parrot|bird|cockatiel|budgie)\b/.test(s)) {
    species = "Exotics";
    subtype = "Bird";
  } else if (
    /\b(reptile|snake|lizard|gecko|tortoise|turtle|bearded dragon)\b/.test(s)
  ) {
    species = "Exotics";
    subtype = "Reptile";
  } else if (/\b(guinea pig|hamster|ferret|gerbil|chinchilla)\b/.test(s)) {
    species = "Exotics";
    subtype = "Small mammal";
  } else if (
    /\b(horse|pony|cattle|cow|goat|sheep|pig|chicken|hen|duck|poultry)\b/.test(
      s,
    )
  ) {
    species = "Farm animals";
    subtype = /horse|pony/.test(s)
      ? "Horse"
      : /cattle|cow/.test(s)
        ? "Cattle"
        : /goat/.test(s)
          ? "Goat"
          : /sheep/.test(s)
            ? "Sheep"
            : /pig/.test(s)
              ? "Pig"
              : "Poultry";
  } else if (/\b(exotic|exotics)\b/.test(s)) species = "Exotics";
  else if (/\b(farm|livestock)\b/.test(s)) species = "Farm animals";
  else if (/\b(fish|hedgehog|axolotl|other species)\b/.test(s)) {
    species = "Other species";
    subtype = s.match(/fish|hedgehog|axolotl/)?.[0];
  }
  const service = emergency
    ? "Emergency"
    : /neuro|spinal/.test(s)
      ? "Neurology"
      : /surg/.test(s)
        ? "Surgery"
        : /ultrasound/.test(s)
          ? "Ultrasound"
          : /urgent|vomit|limp|diarrhea/.test(s)
            ? "Urgent care"
            : undefined;
  const location = locationInText(text);
  return { emergency, species, subtype, service, location };
}
export function matchProviders(
  providers: Provider[],
  f: Filters,
  emergency = false,
) {
  const coords =
    f.lat !== undefined && f.lng !== undefined
      ? [f.lat, f.lng]
      : locate(f.location);
  if (f.location.trim() && !coords) return [];
  return providers
    .map((p) => ({
      ...p,
      distance:
        coords && p.lat !== null && p.lng !== null
          ? distance(coords[0], coords[1], p.lat, p.lng)
          : undefined,
      reasons: [
        speciesMatch(p, f.species, f.subtype) === "confirmed"
          ? f.species === "Any pet"
            ? "Choose a species to check eligibility"
            : `${speciesLabel(f.species, f.subtype)} care listed`
          : "Species acceptance needs confirmation",
        p.services.includes(f.service)
          ? `${f.service} listed`
          : `${p.category} provider`,
      ],
    }))
    .filter((p) => {
      if (emergency && (p.category !== "Emergency" || p.fictional))
        return false;
      if (
        !emergency &&
        f.service !== "Any care" &&
        !p.services.includes(f.service) &&
        p.category !== f.service
      )
        return false;
      if (speciesMatch(p, f.species, f.subtype) === "mismatch") return false;
      if (coords && p.distance === undefined) return false;
      if (!emergency && p.distance !== undefined && p.distance > f.radius)
        return false;
      if (!emergency && f.available && liveAvailability(p) !== "Accepting")
        return false;
      return true;
    })
    .sort((a, b) =>
      emergency
        ? (a.distance ?? 999) - (b.distance ?? 999)
        : Number(liveAvailability(b) === "Accepting") -
            Number(liveAvailability(a) === "Accepting") ||
          (a.distance ?? 999) - (b.distance ?? 999),
    );
}
export function normalizedPhone(v: string) {
  return v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}
export const stages = [
  "New",
  "Reviewing",
  "Expected",
  "Arrived",
  "In care",
  "Discharged",
  "Transferred",
];
export function allowedStage(from: string, to: string) {
  const transitions: Record<string, string[]> = {
    New: ["Reviewing"],
    Reviewing: ["Expected", "Arrived"],
    Expected: ["Arrived"],
    Arrived: ["In care"],
    "In care": ["Discharged"],
    Discharged: [],
    Transferred: [],
  };
  return from === to || transitions[from]?.includes(to);
}
