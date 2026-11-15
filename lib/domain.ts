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
  const species = /cat|kitten/.test(s)
    ? "Cat"
    : /rabbit|bunny/.test(s)
      ? "Rabbit"
      : /bird|parrot/.test(s)
        ? "Bird"
        : /reptile|snake|lizard/.test(s)
          ? "Reptile"
          : /dog|puppy/.test(s)
            ? "Dog"
            : undefined;
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
  return { emergency, species, service, location };
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
        p.species.includes(f.species)
          ? `${f.species} care listed`
          : "Species acceptance needs confirmation",
        p.services.includes(f.service)
          ? `${f.service} listed`
          : `${p.category} provider`,
      ],
    }))
    .filter((p) => {
      if (emergency && p.category !== "Emergency") return false;
      if (
        !emergency &&
        f.service !== "Any care" &&
        !p.services.includes(f.service) &&
        p.category !== f.service
      )
        return false;
      if (
        f.species !== "Any pet" &&
        p.species.length &&
        !p.species.includes(f.species)
      )
        return false;
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
