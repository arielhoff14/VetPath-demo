import postalData from "../data/bay-area-postal.json";

/** GeoNames postal centroids: all nine Bay Area counties plus Sacramento. */
export const postalPlaces = postalData as unknown as Record<
  string,
  [string, number, number, string]
>;
export function normalizeLocation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
const cityPoints = new Map<string, [number, number][]>();
for (const [city, lat, lng] of Object.values(postalPlaces)) {
  const key = normalizeLocation(city);
  cityPoints.set(key, [...(cityPoints.get(key) || []), [lat, lng]]);
}
export const places: Record<string, [number, number]> = Object.fromEntries(
  [...cityPoints].map(([city, points]) => [
    city,
    [
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
    ],
  ]),
);
Object.assign(places, {
  "san francisco": [37.7749, -122.4194],
  "san jose": [37.3382, -121.8863],
  "mission district": [37.7599, -122.4148],
  oakland: [37.8044, -122.2712],
  lafayette: [37.8858, -122.118],
  sacramento: [38.5816, -121.4944],
});
// Municipalities sharing a postal city use that ZIP's published centroid.
const cityAliases: Record<string, string> = {
  "East Palo Alto": "94303",
  "Los Altos Hills": "94022",
  Hillsborough: "94010",
  Woodside: "94062",
  "Monte Sereno": "95030",
  Tiburon: "94920",
  Belvedere: "94920",
  "St. Helena": "94574",
  "St Helena": "94574",
  Kensington: "94707",
};
for (const [city, zip] of Object.entries(cityAliases)) {
  const p = postalPlaces[zip];
  places[normalizeLocation(city)] = [p[1], p[2]];
}
export const locationSuggestions = [
  ...new Set([
    ...Object.values(postalPlaces).map((p) => p[0]),
    ...Object.keys(cityAliases),
  ]),
].sort();
export function locate(value: string): [number, number] | undefined {
  const normalized = normalizeLocation(value);
  const zip = normalized.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) {
    const p = postalPlaces[zip[1]];
    return p ? [p[1], p[2]] : undefined;
  }
  return places[
    normalized
      .replace(/,?\s*(?:usa|united states)$/, "")
      .replace(/,?\s*ca(lifornia)?$/, "")
      .trim()
  ];
}
export function locationInText(value: string) {
  const text = normalizeLocation(value);
  const zip = text.match(/\b\d{5}(?:-\d{4})?\b/);
  // Preserve an explicit unsupported ZIP so the UI can ask for a correction.
  if (zip) return zip[0];
  return Object.keys(places)
    .sort((a, b) => b.length - a.length)
    .find((city) =>
      new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
        text,
      ),
    );
}
