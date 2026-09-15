import { places } from "../../explore/data";
import { manxFocusedSubset } from "../../manx/data";

const placeProfiles = places.map((place) => place.slug === "isle-of-man" ? { ...place, focusedSubset: manxFocusedSubset } : place);

export function GET() {
  return Response.json({ title: "Britannic Atlas place profiles", updatedAt: "2026-08-23", count: placeProfiles.length, places: placeProfiles }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
