// Does the answer actually follow from the evidence it cites?
//
// Status used to be inherited from whichever claim IDs the model *said* it
// relied on, and coverage was measured against the question rather than the
// answer. So an answer of "Ramsey is the capital" could cite the verified
// Douglas claim and be displayed as verified at 99%. The claim ID is the
// model's own assertion; treating it as proof made the whole evidence gate
// circular.
//
// This is a cheap lexical entailment check, deliberately fail-closed: the
// specific, checkable things an answer asserts — names, places, figures, dates
// — must appear in the evidence it cites. It cannot understand meaning, so it
// never promotes anything; it only caps, and it reports exactly which terms
// went unbacked so the interface can say so out loud.

import { tokens } from "./kb.mjs";

const stem = (term) => (term.length >= 6 ? term.slice(0, 5) : term);
// Names are keyed on a longer prefix than ordinary words: five letters made
// "Castletown" and "Castle Rushen" the same key, so an answer naming the one
// was "entailed" by evidence naming only the other.
const nameKey = (word) => (word.length >= 8 ? word.slice(0, 7) : word);
// A denial is a claim of its own. Evidence that "Douglas is the capital" must
// not entail "Douglas is not the capital" because every name matched.
const NEGATION_RE = /\b(?:not|never|no longer|isn't|aren't|wasn't|weren't|doesn't|don't|didn't|cannot|can't|won't|neither|nor)\b/i;
function negationMismatch(answer, claims) {
  if (claims.some((claim) => NEGATION_RE.test(String(claim?.text || "")))) return null;
  for (const sentence of String(answer || "").split(/(?<=[.!?])\s+/)) {
    if (!NEGATION_RE.test(sentence) || !salientTerms(sentence).length) continue;
    return sentence.trim().slice(0, 80);
  }
  return null;
}

// A UTC ISO timestamp and its readable rendering carry the same date/time.
// Preserve the values; never replace them with a fetch time or today's date.
const comparableText = (text) => String(text || "").replace(/\b(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?Z\b/g,
  (_, date, time, seconds) => date + " " + time + (seconds && seconds !== "00" ? ":" + seconds : "") + " UTC");

// Capitalisation carries no claim for these: they open sentences or join them.
const NOT_A_NAME = new Set([
  "the", "a", "an", "and", "or", "but", "if", "so", "then", "there", "here", "this", "that", "these", "those",
  "in", "on", "at", "to", "of", "for", "with", "by", "from", "as", "into", "over", "under", "between",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "they", "them", "their", "we", "our",
  "you", "your", "he", "she", "his", "her", "not", "no", "yes", "what", "who", "which", "when", "where",
  "why", "how", "both", "each", "any", "all", "some", "one", "two", "three", "first", "second",
  // Discourse openers that begin a sentence with a capital but assert nothing.
  "however", "although", "though", "while", "whereas", "because", "since", "unless", "until",
  "also", "still", "yet", "now", "today", "again", "just", "only", "even", "much", "many", "more", "most",
  "put", "given", "beyond", "rather", "instead", "meanwhile", "otherwise", "overall", "briefly", "plainly",
  "legally", "formally", "strictly", "broadly", "roughly", "about", "regarding", "note", "beware",
  "aye", "right", "okay", "ok", "nearby", "coverage",
  // Comparatives and connectives that open a sentence.
  "like", "unlike", "such", "hence", "thus", "therefore", "similarly", "likewise", "equally", "essentially", "typically",
]);

/**
 * The checkable assertions in a piece of prose: names and figures. Ordinary
 * words carry no factual weight on their own, and adverbs ending in -ly are
 * discourse, so both are ignored.
 */
export function salientTerms(text) {
  const found = new Map();
  const source = comparableText(text);
  for (const match of source.matchAll(/\b\d[\d,.]*\b/g)) {
    const digits = match[0].replace(/[,.]+$/, "").replace(/,/g, "");
    if (digits.replace(/\./g, "").length >= 2) found.set(`n:${digits}`, match[0]);
  }
  for (const word of source.match(/[A-Z][A-Za-z'’-]{2,}/g) || []) {
    const lower = word.toLowerCase().replace(/’/g,"'").replace(/'s$/, "");
    if (/^(?:i|you|we|they|he|she|it|that|there|what|who)'(?:ll|ve|re|d|m|s)$/.test(lower)) continue;
    if (NOT_A_NAME.has(lower) || lower.endsWith("ly")) continue;
    found.set(`w:${nameKey(lower)}`, word);
  }
  return [...found].map(([key, display]) => ({ key, display }));
}

function evidenceKeys(claims) {
  const keys = new Set();
  for (const claim of Array.isArray(claims) ? claims : []) {
    const text = comparableText(`${claim?.text || ""} ${claim?.topic || ""}`);
    // Resolve this local shorthand only when the cited evidence names Manx geography.
    if (/\bIsle of Man\b/i.test(text)) keys.add(`w:${nameKey("island")}`);
    for (const token of tokens(text)) { keys.add(`w:${stem(token)}`); keys.add(`w:${nameKey(token)}`); }
    // Use the same name boundaries on both sides (for example Open-Meteo).
    for (const term of salientTerms(text)) keys.add(term.key);
    for (const match of text.matchAll(/\b\d[\d,.]*\b/g)) {
      const digits = match[0].replace(/[,.]+$/, "").replace(/,/g, "");
      if (digits.replace(/\./g, "").length >= 2) keys.add(`n:${digits}`);
    }
  }
  return keys;
}

/**
 * The number terms of the answer whose nearest name in the same sentence never
 * appears in a single piece of evidence together with that number.
 */
function numbersOutOfRole(answer, claims) {
  const perClaim = (Array.isArray(claims) ? claims : []).map((claim) => evidenceKeys([claim]));
  if (!perClaim.length) return [];
  const out = [];
  for (const sentence of comparableText(answer).split(/(?<=[.!?])\s+/)) {
    const names = [];
    for (const match of sentence.matchAll(/[A-Z][A-Za-z'’-]{2,}/g)) {
      const lower = match[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, "");
      if (NOT_A_NAME.has(lower) || lower.endsWith("ly") || /^(?:i|you|we|they|he|she|it|that|there|what|who)'/.test(lower)) continue;
      names.push({ key: `w:${nameKey(lower)}`, at: match.index });
    }
    if (!names.length) continue;
    for (const match of sentence.matchAll(/\b\d[\d,.]*\b/g)) {
      const digits = match[0].replace(/[,.]+$/, "").replace(/,/g, "");
      if (digits.replace(/\./g, "").length < 2) continue;
      const key = `n:${digits}`;
      const before = names.filter((n) => n.at < match.index).at(-1);
      const nearest = before || names.find((n) => n.at > match.index);
      if (!nearest) continue;
      if (!perClaim.some((keys) => keys.has(key) && keys.has(nearest.key))) out.push({ key, display: match[0] });
    }
  }
  return out;
}

/** Tolerance before an otherwise well-supported answer is capped. */
export const ENTAILMENT_STRONG = 0.85;
export const ENTAILMENT_WEAK = 0.5;

export function entailmentCheck({ answer, claims = [] } = {}) {
  const terms = salientTerms(answer);
  if (!Array.isArray(claims) || !claims.length) {
    return { verdict: "uncited", ratio: 0, terms: terms.length, unsupported: terms.map((t) => t.display).slice(0, 8) };
  }
  const evidence = evidenceKeys(claims);
  const unsupported = terms.filter((term) => !evidence.has(term.key));
  // A figure is only backed when it sits beside its own name: "Douglas had
  // 7,845 residents" is not carried by evidence that gives Ramsey 7,845.
  for (const term of numbersOutOfRole(answer, claims)) if (!unsupported.some((u) => u.key === term.key)) unsupported.push(term);
  const negated = negationMismatch(answer, claims);
  if (negated) unsupported.push({ key: "negation", display: `the denial in “${negated}”` });
  const total = terms.length + (negated ? 1 : 0);
  const ratio = total ? (total - unsupported.length) / total : 1;
  const verdict = !unsupported.length ? "entailed"
    : ratio < ENTAILMENT_WEAK ? "unsupported"
      : ratio < ENTAILMENT_STRONG ? "partial"
        : "mostly_entailed";
  return { verdict, ratio: Number(ratio.toFixed(2)), terms: total, unsupported: unsupported.map((term) => term.display).slice(0, 8) };
}

/**
 * Cap a claim-derived status by what the answer actually says. This only ever
 * lowers a status: entailment is evidence that an answer is *not* supported,
 * never evidence that it is.
 */
export function boundStatusByEntailment(status, entailment) {
  if (!entailment) return status;
  if (entailment.verdict === "uncited" || entailment.verdict === "unsupported") return "model_prior";
  if (entailment.verdict === "partial") return ["verified", "corroborated"].includes(status) ? "single_source" : status;
  // One invented term in an otherwise backed answer still costs the top badge.
  if (entailment.verdict === "mostly_entailed") return status === "verified" ? "corroborated" : status;
  return status;
}

/** One plain sentence a person can act on, or empty when nothing was unbacked. */
export function entailmentNotice(entailment) {
  if (!entailment?.unsupported?.length || entailment.verdict === "entailed") return "";
  const list = entailment.unsupported.slice(0, 4).join(", ");
  return `The evidence cited for this answer does not mention ${list}, so those parts are not source-verified.`;
}
