import { doctoralDossiers, doctoralReviewedAt, doctoralSources } from "../../doctoral/data";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: "Britannic Atlas doctoral comparative-law knowledge base",
    dateModified: doctoralReviewedAt,
    educationalLevel: "Doctorate",
    methodology: ["Characterise", "Validate", "Connect", "Bridge", "Filter", "State effect"],
    count: doctoralDossiers.length,
    sourceCount: doctoralSources.length,
    dossiers: doctoralDossiers.map((dossier) => ({ ...dossier, url: `${origin}/doctoral/${dossier.slug}`, sources: dossier.sourceIds.map((id) => doctoralSources.find((source) => source.id === id)).filter(Boolean) })),
    sourceRegister: doctoralSources,
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
