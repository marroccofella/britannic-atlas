import { buildAnsweredQuestionBank, jurisdictionProfiles } from "../../questions/answer-data";
import { resolveKnownJurisdiction } from "../../questions/resolve-jurisdiction";
import { manxFocusedSubset } from "../../manx/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const jurisdiction = url.searchParams.get("jurisdiction")?.trim() || "United Kingdom";
  const domain = url.searchParams.get("domain");
  const lens = url.searchParams.get("lens");
  const profile = resolveKnownJurisdiction(jurisdiction);
  // An unknown jurisdiction is an error, not the United Kingdom served as if it were the answer.
  if (!profile) return Response.json({ error: "Unknown jurisdiction", jurisdictions: jurisdictionProfiles.map((p) => p.name) }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  const answers = buildAnsweredQuestionBank(profile.name).filter((item) => (!domain || item.domainSlug === domain) && (!lens || item.lensSlug === lens));
  return Response.json({
    name: "Britannic Atlas Territory Answer Library",
    purpose: "Templated research baselines for one jurisdiction, with evidence requirements and official source routes; not transaction-specific legal advice.",
    method: "Each baseline is composed from a jurisdiction profile, a domain baseline and a lens finding. It is not an individually researched answer.",
    jurisdiction: profile.name,
    jurisdictionGroup: profile.group,
    reviewedAt: "2026-08-16",
    count: answers.length,
    totalTerritories: jurisdictionProfiles.length,
    ...(profile.name === manxFocusedSubset.jurisdiction ? { focusedSubset: manxFocusedSubset } : {}),
    answers,
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
