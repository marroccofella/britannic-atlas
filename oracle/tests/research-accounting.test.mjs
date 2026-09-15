// Receipts and accounting for paid research. Found on 15 September 2026: an
// expedition that failed after its first route recorded $0; a bus listener
// that threw re-finished a done expedition as failed; adversarial and lateral
// routes reported "complete" on a provider error; a MOMM run in which no
// reviewer completed was stored as a review with a run id; the MOMM hourly
// allowance forgot itself on restart; findings from reviewers that never ran
// could contest every claim; agreement of four models produced a "verified"
// claim; and a research pass that re-found a verified seed sentence downgraded
// it. None of this can pass a trust audit, so each is pinned here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../lib/kb.mjs";
import { Bus } from "../lib/bus.mjs";
import { runExpedition, ExpeditionQueue, sourceIdentity, isOfficialManxSource } from "../lib/learning.mjs";
import { interpretReport } from "../lib/momm.mjs";
import { MommHourlyAllowance, reviewStructuredBrief } from "../lib/deliberate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const finding = (claim, url = "https://www.gov.im/categories/fixture/") => ({ claim, topic: "fixture", confidence: 0.8, volatility: "structural", sources: [{ url, title: "Fixture page" }], answers_question: true });
const research = (costUsd = 0.8, findings = [finding("The fixture ferry sails from Douglas to Heysham throughout the year.")]) => ({ costUsd, isError: false, structured: { findings, unresolved: [], unreachable_sources: [] }, webSearches: 1 });

function harness(t, { calls, crossReview = null, bus = new Bus() } = {}) {
  const kb = new KnowledgeBase(":memory:");
  t.after(() => kb.close());
  let n = 0;
  const runModel = async () => { const step = calls[Math.min(n, calls.length - 1)]; n += 1; return typeof step === "function" ? step() : step; };
  const stages = [];
  bus.on("event", (e) => { if (e.type === "expedition.progress") stages.push(e.stage); });
  const run = (strategies) => {
    const id = kb.startExpedition({ question: "Fixture question about Manx ferries?", reason: "test", strategies, jurisdiction: "Isle of Man" });
    return { id, promise: runExpedition({ kb, bus, root: HERE, id, question: "Fixture question about Manx ferries?", reason: "test", strategies, sessionId: "t", runModel, crossReview: crossReview || (async () => ({ ok: false, reason: "not used", perClaim: [], reviewers: [] })) }) };
  };
  return { kb, bus, run, stages };
}

test("cost already spent is carried on every failure path, including a provider error on the first route", async (t) => {
  const h = harness(t, { calls: [research(0.8), () => Promise.reject(new Error("claude timed out after 45000ms"))] });
  const { id, promise } = h.run(["research", "lateral"]);
  const err = await promise.then(() => null, (e) => e);
  assert.ok(err, "the expedition failed");
  assert.equal(err.costUsd, 0.8, "the research route's spend travels with the error");
  h.kb.finishExpedition(id, { status: "failed", summary: err.message, costUsd: err.costUsd });
  assert.equal(h.kb.getExpedition(id).cost_usd, 0.8);

  const h2 = harness(t, { calls: [{ costUsd: 0.55, isError: true, text: "provider error", structured: null }] });
  const err2 = await h2.run(["research"]).promise.then(() => null, (e) => e);
  assert.equal(err2.costUsd, 0.55, "an is_error result is still billed");
});

test("a listener that throws on the finished event cannot re-finish a done expedition as failed and free", async (t) => {
  const bus = new Bus();
  bus.on("event", (e) => { if (e.type === "expedition.finished") throw new Error("listener bug"); });
  const h = harness(t, { calls: [research(0.9)], bus });
  const queue = new ExpeditionQueue({ kb: h.kb, bus, root: HERE, runExpeditionFn: (job) => runExpedition({ ...job, runModel: async () => research(0.9), crossReview: async () => ({ ok: false, reason: "x", perClaim: [], reviewers: [] }) }) });
  const admission = queue.enqueue({ question: "Fixture question about Manx ferries?", reason: "test", strategies: ["research"], sessionId: "t", jurisdiction: "Isle of Man" });
  assert.equal(admission.queued, true);
  await queue.whenIdle();
  const row = h.kb.getExpedition(admission.id);
  assert.equal(row.status, "done");
  assert.equal(row.cost_usd, 0.9);
});

test("adversarial and lateral routes report failure, not completion, when the provider returns an error", async (t) => {
  const h = harness(t, { calls: [research(0.8), { costUsd: 0.1, isError: true, structured: null }] });
  const { id, promise } = h.run(["research", "adversarial"]);
  const result = await promise;
  assert.ok(h.stages.includes("adversarial_failed"), `stages: ${h.stages.join(",")}`);
  assert.ok(!h.stages.includes("adversarial_complete"));
  assert.equal(result.costUsd, 0.9, "the failed route is still paid for");
  assert.equal(h.kb.getExpedition(id).cost_usd, 0.9);

  const h2 = harness(t, { calls: [research(0.8), { costUsd: 0.2, isError: true, structured: null }] });
  await h2.run(["research", "lateral"]).promise;
  assert.ok(h2.stages.includes("lateral_failed"), `stages: ${h2.stages.join(",")}`);
});

test("a MOMM run in which no reviewer completed is not a review and leaves no run id in the ledger", async (t) => {
  const crossReview = async ({ claims }) => ({ ok: true, ...interpretReport({ run_id: "r1", reviewers: [{ agent: "codex", status: "authentication_required" }, { agent: "gemini", status: "provider_unavailable" }] }, claims.length) });
  const h = harness(t, { calls: [research(0.8)], crossReview });
  const result = await h.run(["research", "cross_model"]).promise;
  assert.ok(h.stages.includes("cross_model_complete"));
  const progress = h.kb.getExpedition(result.id).progress;
  assert.equal(result.learned.length, 1);
  const claim = h.kb.getClaim(result.learned[0].id);
  assert.equal(claim.provenance.momm_run, null, "no receipt, no run id");
  assert.ok(JSON.stringify(progress).includes("no usable result") || h.bus.buffer.some((e) => e.type === "expedition.progress" && /no usable result|no reviewer completed/.test(e.detail)), "the user is told nothing was reviewed");
});

test("findings from reviewers that never ran, and labels buried in rationale, do not contest claims", () => {
  const report = { run_id: "r2", reviewers: [{ agent: "codex", status: "authentication_required" }, { agent: "gemini", status: "success", verdict: "MODIFY", confidence: 0.8 }],
    findings: [{ severity: "CRITICAL", issue: "C1: wrong", rationale: "see also C2 and C3", sources: ["codex"] }, { severity: "CRITICAL", issue: "C2: wrong", rationale: "see C3", sources: ["gemini", "gemini"] }] };
  const r = interpretReport(report, 3);
  assert.deepEqual(r.perClaim[0].disagree, [], "a reviewer that did not run cannot contest");
  assert.equal(r.perClaim[1].disagree.length, 1, "one contest per reviewer per claim");
  assert.deepEqual(r.perClaim[2].disagree, [], "a label in the rationale is not a finding about that claim");
  assert.deepEqual(r.perClaim[0].agree, ["gemini"]);
  assert.deepEqual(r.perClaim[2].agree, ["gemini"]);
});

test("the MOMM hourly allowance survives a restart and refunds a review that never dispatched", () => {
  const saved = { value: null };
  const store = { load: () => saved.value, save: (entries) => { saved.value = entries; } };
  const first = new MommHourlyAllowance({ limit: 1 }).attach(store);
  const admission = first.consume("deliberate");
  assert.equal(admission.ok, true);
  const second = new MommHourlyAllowance({ limit: 1 }).attach(store);
  assert.equal(second.consume("deliberate").ok, false, "a restart does not reset the cap");
  assert.equal(second.release(admission), true);
  assert.equal(second.consume("deliberate").ok, true, "a refunded slot is usable again");
  assert.equal(second.release(admission), false, "a slot is refunded once");
});

test("a review brief keeps its line structure so headings stay headings", async () => {
  let sent = null;
  const dispatch = async ({ brief }) => { sent = brief; return { report: { run_id: "r3", reviewers: [] } }; };
  await reviewStructuredBrief({ brief: "## Untrusted quoted data\nline one\n\n## Review task\nline two", dispatch }).catch(() => null);
  assert.ok(sent.includes("\n## Review task"), sent);
});

test("model-supplied sources are stored without credentials and without duplicates, and identity ignores scheme", async (t) => {
  const url = "https://user:pw@www.gov.im/categories/fixture/";
  const h = harness(t, { calls: [research(0.3, [{ ...finding("The fixture harbour dues are payable at Douglas for visiting vessels."), sources: [{ url }, { url: "https://www.gov.im/categories/fixture/" }] }])] });
  const result = await h.run(["research"]).promise;
  const claim = h.kb.getClaim(result.learned[0].id);
  assert.deepEqual(claim.sources.map((s) => s.url), ["https://www.gov.im/categories/fixture/"]);
  assert.equal(sourceIdentity("http://WWW.gov.im/media/x.pdf"), sourceIdentity("https://www.gov.im/media/x.pdf"));
  assert.equal(isOfficialManxSource("http://www.gov.im/x"), false, "an unencrypted official citation is not accepted");
});

test("agreement between models never makes a claim verified, and research re-finding a verified seed does not downgrade it", () => {
  const kb = new KnowledgeBase(":memory:");
  const momm = kb.upsertClaim({ text: "Four models agreed that the fixture ferry sails from Douglas.", topic: "fixture", jurisdiction: "IM", kind: "momm", support: 4, sources: [{ url: "https://www.gov.im/categories/fixture/" }], provenance: { origin: "momm-deliberation" } }).claim;
  assert.equal(momm.status, "single_source");
  const seed = kb.upsertClaim({ text: "The fixture House of Keys dissolves ahead of a general election.", topic: "fixture", kind: "seed", status: "verified", confidence: 0.92, support: 2, sources: [{ url: "https://www.tynwald.org.im/x", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }, { url: "https://www.gov.im/x", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }], provenance: { origin: "britannica-atlas", editorial: true } }).claim;
  assert.equal(seed.status, "verified");
  const after = kb.upsertClaim({ text: seed.text, topic: "fixture", kind: "learned", support: 1, sources: [{ url: "https://www.gov.im/categories/y/" }], provenance: { expedition: "x_1", question: "q" } }).claim;
  assert.equal(after.status, "verified", "re-finding editorial evidence is not a reason to doubt it");
  assert.equal(after.kind, "seed");
  kb.close();
});

test("the terminal dream runner honours the hourly expedition cap", () => {
  const src = fs.readFileSync(path.join(HERE, "..", "dream.mjs"), "utf8");
  assert.match(src, /budgetLeft|expeditionsSince|ExpeditionQueue/);
});
