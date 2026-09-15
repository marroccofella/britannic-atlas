import { buildTerritoryContextAnswers, contextReviewedAt, contextTerritories } from "../../context/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("territory");
  const territory = requested ? contextTerritories.find((item) => item.slug === requested || item.name.toLowerCase() === requested.toLowerCase()) : undefined;
  if (requested && !territory) return Response.json({ error: "Unknown territory", validTerritories: contextTerritories.map((item) => item.slug) }, { status: 400 });
  if (territory) return Response.json({ name: `${territory.name}: 100 structural context answers`, territory: territory.name, dateModified: contextReviewedAt, count: 100, url: `${url.origin}/territories/${territory.slug}/context`, answers: buildTerritoryContextAnswers(territory.slug) }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
  return Response.json({ name: "1,400 British Overseas Territory structural context answers", dateModified: contextReviewedAt, count: 1400, territoryCount: 14, territories: contextTerritories.map((item) => ({ slug: item.slug, name: item.name, code: item.code, url: `${url.origin}/territories/${item.slug}/context`, api: `${url.origin}/api/context?territory=${item.slug}`, answers: buildTerritoryContextAnswers(item.slug) })) }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
