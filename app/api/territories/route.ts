import { territoryDossiers } from "../../territories/data";

export function GET() {
  return Response.json({ name: "Britannic Atlas Overseas Territory Dossiers", updatedAt: "2026-08-16", count: territoryDossiers.length, territories: territoryDossiers.map((territory) => ({ ...territory, url: `/territories/${territory.slug}` })) }, { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}
