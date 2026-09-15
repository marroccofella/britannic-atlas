// What the ledger holds, spoken from the ledger. The user is building the
// Manx knowledge base by talking to Mannin, so they need to hear where it is
// strong, where it is thin, and what to say next. Nothing here calls a model
// or spends anything; the numbers come straight from the tables.
import { STATUS_RANK, coverageFor } from "./kb.mjs";

// Strongest first when spoken; STATUS_RANK ascends.
const LIVE_STATUSES = STATUS_RANK.filter((s) => s !== "retracted").reverse();
const STATUS_LABEL = { verified: "verified", corroborated: "corroborated", single_source: "single-source", contested: "contested", hypothesis: "hypothesis" };

/**
 * The research brief queued for "learn about X". A bare subject would be
 * refused by the spend gate as an unfinished request, and a fuller question
 * gives the expedition its shape: facts, official sources, disputes, myths.
 */
export function buildOutQuestion(subject, jurisdiction="Isle of Man") {
  return `What are the established facts, official ${jurisdiction} sources, disputed points and common misunderstandings about ${String(subject).trim().replace(/[.?!]+$/, "")}?`;
}

const plural = (n, word, pluralWord = word + "s") => `${n} ${n === 1 ? word : pluralWord}`;
const spokenDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
function statusList(byStatus) {
  const parts = LIVE_STATUSES.filter((s) => byStatus[s]).map((s) => `${byStatus[s]} ${STATUS_LABEL[s] || s}${s === "hypothesis" && byStatus[s] !== 1 ? "es" : ""}`);
  return parts.length ? parts.join(", ") : "none";
}

/**
 * @param kb the ledger
 * @param subject null for the whole Manx ledger, or a subject to map
 * @param retrieval health stats from ManxRetrieval.stats(), if any
 */
export function knowledgeMap(kb, subject, { retrieval = null } = {}) {
  const overview = kb.ledgerOverview({ jurisdiction: "Isle of Man" });
  const gaps = kb.openGaps(50, { jurisdiction: "Isle of Man" });
  if (subject) {
    const matches = kb.search(subject, { limit: 41, jurisdiction: "IM", allowedStatuses: LIVE_STATUSES });
    const claims=matches.slice(0,40),limited=matches.length>40;
    const byStatus = {}; for (const c of claims) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const official = claims.filter((c) => c.sources.some((s) => s.primary)).length;
    const newest = claims.map((c) => c.verified_at || c.created_at).filter(Boolean).sort().pop() || null;
    const related = gaps.filter((g) => coverageFor(subject, [g.question]).level !== "none").slice(0, 3);
    const gapLine = related.length ? ` ${plural(related.length, "open gap")} ${related.length === 1 ? "touches" : "touch"} it, for example “${related[0].question}”.` : "";
    const speech = claims.length
      ? `On ${subject} ${limited?"I found more than 40 matching claims; this summary covers only the first 40":"I hold "+plural(claims.length, "claim")+" in the Manx ledger"}: ${statusList(byStatus)}. ${limited ? `Of these 40, ${official} cite` : official === claims.length && claims.length > 1 ? "All cite" : official === 1 ? "1 cites" : `${official} cite`} primary sources${newest ? `, and the most recent ledger record date${limited?" in this sample":""} is ${spokenDate(newest)}, not a source publication date` : ""}.${gapLine} To deepen it, say “learn about ${subject}”. To check one point, say “search for” and the point.`
      : `I found no keyword matches for ${subject}. Relevant information may use different wording.${gapLine} Say “learn about ${subject}” and I’ll build it out: official Manx sources first, then an adversarial and cross-model check, storing only what is sourced.`;
    return { subject, speech, summary: { subject, claims: claims.length, limited, method:"keyword", byStatus, official, newest, dateKind:"ledger_record", gaps: related.map((g) => g.question) } };
  }
  const index = retrieval?.ledger ? ` The semantic index covers ${retrieval.ledger.indexed} of ${retrieval.ledger.indexable} sourced claims.` : "";
  const oldest = gaps[0] ? `, one queued question being “${gaps[0].question}”` : "";
  const speech = `The Manx ledger holds ${plural(overview.live, "live claim")} across ${plural(overview.topics, "topic")}: ${statusList(overview.byStatus)}. ${overview.official} cite primary sources. ${plural(overview.recent, "claim")} ${overview.recent === 1 ? "was" : "were"} added in the last ${overview.recentDays} days, and ${plural(overview.gapsOpen, "gap")} ${overview.gapsOpen === 1 ? "is" : "are"} open${oldest}.${index} To grow it, say “learn about” and a subject. To see where a subject is thin, ask how well I know it.`;
  return { subject: null, speech, summary: { ...overview, index: retrieval?.ledger || null, gaps: gaps.slice(0, 5).map((g) => g.question) } };
}
