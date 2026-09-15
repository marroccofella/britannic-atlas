import { networkPlaces, sharedPractice } from "../../network/data";
import { appDestination, destinationScope, networkApps } from "../../network/routing";

const headers = { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" };

export function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("place");
  const place = networkPlaces.find(p => p.slug === slug);
  if (slug && !place) return Response.json({ error: "Unknown place", places: networkPlaces.map(p => ({ slug: p.slug, name: p.name })) }, { status: 400, headers });
  return Response.json({ schemaVersion: 1, purpose: "Navigation and editorial contract; not a merged evidence corpus", context: place ?? null, places: networkPlaces, sharedPractice, handoff: { privateConversationTransfer: false, autoSubmit: false, localAppRequiresRunning: true }, apps: networkApps.map(app => ({ ...app, destination: appDestination(app, place), destinationScope: destinationScope(app, place), access: app.id === "mannin" ? "local" : "site-sign-in" })) }, { headers });
}
