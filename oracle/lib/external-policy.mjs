// Narrow projection policy for material sent to external peer-review tools.

// eslint-disable-next-line no-control-regex -- reviewer-bound text must lose terminal/control bytes
const clean = (value, max = 600) => String(value ?? "").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function safeForExternalPeerReview(...values) {
  const text = values.map((value) => String(value || "")).join(" ");
  if (text.length > 12_000) return false;
  // Credentials, private paths, contact details and long digit runs.
  if (/(?:\b(?:password|passcode|api[ _-]?key|secret token|confidential)\b|[A-Z]:\\|\/Users\/|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?\d[\s().-]*){9,}\d\b)/i.test(text)) return false;
  // A person's own medical, financial or identity details. Public questions
  // about those subjects still pass: "how do I open a bank account" is not
  // "my bank account number". Found on 15 September 2026 when "a chart of my
  // own medical records" was accepted for external review.
  if (/\b(?:my|our|his|her|their)\s+(?:own\s+)?(?:address|phone|email|account|medical|health|bank|salary|wages?|income|tax return|benefits?|pension|mortgage|debts?|passport|driving licence|national insurance|ni number|date of birth|criminal record|convictions?|diagnos[ie]s|prescriptions?|medications?|medicines?|conditions?|illness(?:es)?|therapy|treatment|records?|payslips?|statements?)\b/i.test(text)) return false;
  if (/\b(?:sort code|account number|card number|iban|national insurance number|ni number|passport number|date of birth|dob)\b|\b\d{2}-\d{2}-\d{2}\b|\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/i.test(text)) return false;
  return true;
}

export function sanitisePublicSourceUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.includes(":")) return "";
    if (/^(?:0|10|127|169\.254|192\.168)\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return "";
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.href.slice(0, 320);
  } catch { return ""; }
}

/** Public Manx answers include explicitly scoped cross-border questions. */
// Content review is available for any explicitly scoped public topic. This does
// not widen Manx factual-ledger ingestion or bypass the separate privacy checks.
export function publicReviewScope(jurisdiction){return typeof jurisdiction==='string'&&Boolean(jurisdiction.trim())&&jurisdiction.length<=120&&safeForExternalPeerReview(jurisdiction);}

export function manxReviewScope(jurisdiction) {
  return /^(?:IM|Isle of Man)(?:$| and )/i.test(String(jurisdiction||''));
}

export function publicManxClaimsForVisual(claims) {
  return (Array.isArray(claims) ? claims : []).filter((claim) => {
    if (!["verified", "corroborated", "single_source"].includes(claim?.status)) return false;
    if (claim?.jurisdiction && claim.jurisdiction !== "IM") return false;
    return safeForExternalPeerReview(claim?.text);
  }).slice(0, 12).map((claim) => {
    const sources = (Array.isArray(claim.sources) ? claim.sources : []).slice(0, 4).map((source) => {
      const publisher = clean(source?.publisher, 100), title = clean(source?.title, 160);
      if (!sanitisePublicSourceUrl(source?.url) || !safeForExternalPeerReview(publisher, title) || (!publisher && !title)) return null;
      return { publisher, title };
    }).filter(Boolean);
    if (!sources.length) return null;
    return { text: clean(claim.text, 500), status: claim.status, verified_at: clean(claim.verified_at, 40), sources };
  }).filter(Boolean);
}
