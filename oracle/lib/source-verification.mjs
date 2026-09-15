// Source verification: a citation is an assertion until the page has been read.
//
// A claim's "verified" status now requires at least two confirmed routes, one of
// them primary, where "confirmed" means this module fetched the cited page and
// found the claim's checkable terms in it. Every source carries the outcome of
// its last check, so a page that has disappeared stops counting as a route and
// a claim whose only citation is gone sinks to a hypothesis.
//
// Outcomes (see VERIFICATION_STATUSES in kb.mjs):
//   confirmed     page read; the claim's names and figures appear in it
//   unmatched     page read; the claim's terms are largely absent from it
//   blocked       the site refused automated reading (401/403/429/WAF page)
//   missing       the page is gone (404/410)
//   unreachable   network failure or another HTTP error; try again later
//   unverifiable  not a readable public document (binary, login, empty text)
//
// blocked, unreachable and unverifiable are not evidence against a claim; only
// "missing" removes a route, and only "confirmed" adds one.

import { createHash } from "node:crypto";
import { publicRead } from "./public-reader.mjs";
import { extractHtml, extractPdf } from "./source-content.mjs";
import { entailmentCheck } from "./entailment.mjs";

/** Share of a claim's checkable terms that must appear in the page. */
export const CONFIRM_RATIO = 0.5;
/** A source older than this is re-checked by the routine pass. */
export const RECHECK_AFTER_MS = 30 * 86_400_000;

const sha256 = (text) => createHash("sha256").update(String(text)).digest("hex");

/**
 * Corpus claims are stored as "Article title — Section heading: sentence". The
 * heading is the editor's label, not part of the assertion, so it is not
 * something the cited page has to mention.
 */
export function claimBody(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const colon = value.indexOf(": ");
  if (colon <= 0 || colon > 120) return value;
  const label = value.slice(0, colon), rest = value.slice(colon + 2).trim();
  // A heading is a short capitalised label with no sentence punctuation, and
  // what follows it starts a sentence of its own. "Tynwald sits in Douglas: it
  // has two branches" is one sentence and is left alone.
  const heading = label.includes(" — ") || (/^[A-Z][^.!?]*$/.test(label) && label.split(" ").length <= 12 && /^[A-Z‘“"']/.test(rest));
  return heading && rest ? rest : value;
}

/** How well the page carries the claim: the same lexical test the answer gate uses. */
export function matchClaimToPage(claimText, pageText) {
  const result = entailmentCheck({ answer: claimBody(claimText), claims: [{ text: pageText }] });
  return { ratio: result.ratio, terms: result.terms, unsupported: result.unsupported };
}

function classifyError(err) {
  const code = err?.code;
  const detail = String(err?.message || code || "error").slice(0, 200);
  if (["site_blocked", "rate_limited", "busy"].includes(code)) return { status: "blocked", detail };
  if (code === "http_error") return { status: /HTTP (404|410)\b/.test(detail) ? "missing" : "unreachable", detail };
  if (["url_not_public", "redirect_not_public", "redirect_loop", "redirect_limit"].includes(code)) return { status: "unverifiable", detail };
  return { status: "unreachable", detail };
}

/**
 * Fetch one cited page and decide whether it carries the claim. Never throws
 * for a website problem; only an abort propagates.
 */
export async function verifySource({ text, url, read = publicRead, signal, pdf = extractPdf, now = () => new Date().toISOString() }) {
  const checkedAt = now();
  let response;
  try { response = await read(url, { signal }); }
  catch (err) {
    if (signal?.aborted) throw err;
    const outcome = classifyError(err);
    return { ...outcome, ...(err?.archive ? { detail: `${outcome.detail} (archive: ${String(err.archive).slice(0, 40)})` } : {}), checkedAt };
  }
  const finalUrl = typeof response?.url === "string" ? response.url : url;
  // How the page was obtained travels with the check: a browser-profile read
  // or an Internet Archive snapshot is disclosed, never passed off as a plain read.
  const via = response?.archived ? "archive" : response?.profile === "browser" ? "browser" : "reader";
  const provenance = { via, ...(response?.archived ? { snapshotAt: response.archived.snapshotAt, liveOutcome: response.archived.liveOutcome } : {}) };
  const type = String(response?.headers?.["content-type"] || "");
  let pageText = "";
  try {
    if (/application\/pdf/i.test(type)) {
      const bytes = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body || "");
      const data = await pdf(bytes, { signal });
      pageText = (data?.sections || []).map((section) => section.body).join("\n");
    } else if (/html/i.test(type)) {
      pageText = extractHtml(String(response.body || "")).sections.map((section) => section.body).join("\n");
    } else if (/text\/plain|json|xml/i.test(type)) {
      pageText = String(response.body || "");
    } else {
      return { status: "unverifiable", detail: `unsupported content type ${type.slice(0, 40) || "unknown"}`, checkedAt, finalUrl, ...provenance };
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    return { status: "unverifiable", detail: String(err?.message || err).slice(0, 200), checkedAt, finalUrl, ...provenance };
  }
  if (pageText.trim().length < 40) return { status: "unverifiable", detail: "no readable text", checkedAt, finalUrl, ...provenance };
  const match = matchClaimToPage(text, pageText);
  const confirmed = match.terms === 0 || match.ratio >= CONFIRM_RATIO;
  return {
    status: confirmed ? "confirmed" : "unmatched",
    checkedAt,
    sha256: sha256(pageText),
    matched: Number(match.ratio.toFixed(2)),
    finalUrl,
    ...provenance,
    ...(confirmed ? {} : { detail: `page does not mention ${match.unsupported.slice(0, 4).join(", ")}` }),
  };
}

/**
 * Check a research finding's citations before it is stored. Pages that are
 * gone are dropped; everything else is kept with its verification attached so
 * the status derivation can tell a read page from a typed URL.
 */
export async function verifyFindingSources(text, sources, { read, signal, limit = 4 } = {}) {
  const out = [];
  for (const source of (Array.isArray(sources) ? sources : []).slice(0, limit)) {
    if (!source?.url) continue;
    signal?.throwIfAborted();
    const verification = await verifySource({ text, url: source.url, read, signal });
    if (verification.status === "missing") continue;
    out.push({ ...source, verification });
  }
  return out;
}

/**
 * The routine pass: re-check the least recently checked citations in the
 * ledger, a bounded batch at a time, and let the ledger re-derive status.
 */
export async function verifyClaimSources(kb, { limit = 10, staleMs = RECHECK_AFTER_MS, statuses, maxPerHost = 40, read, signal, now, log } = {}) {
  // A pass never leans on one publisher: official Manx hosts have blocked this
  // machine after bursts, so each host gets a bounded share of every pass.
  const perHost = new Map();
  const queue = kb.sourcesToVerify({ limit: limit * 4, staleMs, statuses }).filter((item) => {
    let host; try { host = new URL(item.url).hostname.replace(/^www\./, ""); } catch { return false; }
    const n = (perHost.get(host) || 0) + 1; perHost.set(host, n); return n <= maxPerHost;
  }).slice(0, limit);
  const summary = { checked: 0, skipped: 0, byStatus: {}, statusChanges: {}, refusingHosts: [] };
  // A host that has refused three reads in a row this pass is refusing this
  // machine, not this page: leave its remaining citations unchecked for a later pass.
  const refusals = new Map();
  for (const item of queue) {
    signal?.throwIfAborted();
    let host; try { host = new URL(item.url).hostname.replace(/^www\./, ""); } catch { host = ""; }
    if ((refusals.get(host) || 0) >= 3) { summary.skipped += 1; if (!summary.refusingHosts.includes(host)) summary.refusingHosts.push(host); continue; }
    const before = kb.getClaim(item.claimId)?.status;
    const verification = await verifySource({ text: item.text, url: item.url, read, signal, ...(now ? { now } : {}) });
    refusals.set(host, verification.status === "blocked" ? (refusals.get(host) || 0) + 1 : 0);
    const after = kb.recordSourceVerification(item.claimId, item.url, verification)?.status;
    summary.checked += 1;
    summary.byStatus[verification.status] = (summary.byStatus[verification.status] || 0) + 1;
    if (before !== after) summary.statusChanges[`${before}->${after}`] = (summary.statusChanges[`${before}->${after}`] || 0) + 1;
    if (log) log({ claimId: item.claimId, url: item.url, ...verification, before, after });
  }
  return summary;
}
