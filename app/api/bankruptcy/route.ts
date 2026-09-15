import { buildTerritoryInsolvencyAnswers, getTerritoryInsolvencyProfile, territoryInsolvencyProfiles, territoryInsolvencyReviewedAt } from "../../bankruptcy/territory-data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("territory");
  const profile = requested ? getTerritoryInsolvencyProfile(requested) : undefined;
  if (requested && !profile) return Response.json({ error: "Unknown territory", validTerritories: territoryInsolvencyProfiles.map((item) => item.slug) }, { status: 400 });
  if (profile) return Response.json({ name: `${profile.name}: 100 insolvency answers`, territory: profile.name, dateModified: territoryInsolvencyReviewedAt, disclaimer: "General legal information only; not legal advice.", url: `${url.origin}/territories/${profile.slug}/insolvency`, count: 100, sources: profile.sources, answers: buildTerritoryInsolvencyAnswers(profile.slug).map(({ sources: _sources, ...answer }) => answer) }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
  return Response.json({ name: "1,400 British Overseas Territory insolvency answers", dateModified: territoryInsolvencyReviewedAt, count: 1400, territoryCount: 14, disclaimer: "General legal information only; not legal advice.", territories: territoryInsolvencyProfiles.map((item) => ({ slug: item.slug, name: item.name, code: item.code, url: `${url.origin}/territories/${item.slug}/insolvency`, api: `${url.origin}/api/bankruptcy?territory=${item.slug}`, regime: item.regime, sources: item.sources, answers: buildTerritoryInsolvencyAnswers(item.slug).map(({ sources: _sources, ...answer }) => answer) })) }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
