import { buildQuestionBank, questionDomains, questionLenses } from "../../questions/question-data";
import { jurisdictionProfiles } from "../../questions/answer-data";
import { resolveKnownJurisdiction } from "../../questions/resolve-jurisdiction";
import { manxFocusedSubset } from "../../manx/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const requestedJurisdiction = url.searchParams.get("jurisdiction")?.trim() || "the selected jurisdiction";
  const jurisdiction = resolveKnownJurisdiction(requestedJurisdiction)?.name ?? requestedJurisdiction;
  const domain = url.searchParams.get("domain");
  const lens = url.searchParams.get("lens");
  const questions = buildQuestionBank(jurisdiction).filter((item) => (!domain || item.domainSlug === domain) && (!lens || item.lensSlug === lens));
  return Response.json({
    name: "Legal & Jurisdictional Research Question Bank",
    purpose: "Compliance, comparative-law and public-interest research; not instructions for evasion or concealment.",
    dimensions: { domains: questionDomains.length, mechanisms: questionDomains.reduce((total, item) => total + item.topics.length, 0), lenses: questionLenses.length },
    jurisdiction,
    count: questions.length,
    answerLibrary: { endpoint: `/api/answers?jurisdiction=${encodeURIComponent(jurisdiction)}`, supportedJurisdictions: jurisdictionProfiles.map((item) => item.name) },
    ...(jurisdiction === manxFocusedSubset.jurisdiction ? { focusedSubset: manxFocusedSubset } : {}),
    questions,
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
