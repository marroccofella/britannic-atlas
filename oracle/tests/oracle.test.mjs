import { test } from "node:test";
import assert from "node:assert/strict";
import { SentenceSegmenter, MetaGuard, parseMeta, speakable, META_MARKER } from "../lib/segmenter.mjs";
import { KnowledgeBase, deriveStatus, trust, coverageFor, ftsQuery, claimId, isPrimarySource } from "../lib/kb.mjs";
import { pickOperators, buildLateralPrompt, OPERATORS, pickConcept } from "../lib/lateral.mjs";
import { interpretReport, buildBrief } from "../lib/momm.mjs";
import { combineEvidence, spokenAddendum } from "../lib/learning.mjs";
import { decideExpedition, weakestStatus, renderFocus } from "../lib/brain.mjs";

// ---------- segmenter ----------
test("segmenter splits on sentence ends but not abbreviations or decimals", () => {
  const seg = new SentenceSegmenter();
  const out = [...seg.push("Mr. Smith paid 3.5 per cent. Then he left for St. Helena! Was it far? Yes, "), ...seg.push("it was. "), ...seg.flush()];
  assert.deepEqual(out, ["Mr. Smith paid 3.5 per cent.", "Then he left for St. Helena!", "Was it far?", "Yes, it was."]);
});
test("segmenter handles chunk boundaries mid-sentence", () => {
  const seg = new SentenceSegmenter();
  const parts = ["Tynwald is the parlia", "ment of the Isle of Man. It sits in Doug", "las."];
  const out = parts.flatMap((p) => seg.push(p)).concat(seg.flush());
  assert.deepEqual(out, ["Tynwald is the parliament of the Isle of Man.", "It sits in Douglas."]);
});
test("meta guard keeps the marker out of speech even when split across chunks", () => {
  const g = new MetaGuard();
  let spoken = "";
  for (const chunk of ["The answer is forty-two. <", "<me", "ta>>{\"confidence\":0.9,\"used\":[\"c_1\"]}"]) spoken += g.push(chunk);
  spoken += g.flush();
  assert.equal(spoken, "The answer is forty-two. ");
  assert.deepEqual(parseMeta(g.meta), { confidence: 0.9, used: ["c_1"] });
});
test("meta guard releases a false-alarm prefix", () => {
  const g = new MetaGuard();
  let spoken = g.push("Values < 3 <<not meta");
  spoken += g.flush();
  assert.equal(spoken, "Values < 3 <<not meta");
  assert.equal(g.inMeta, false);
});
test("speakable strips tags, markdown and urls", () => {
  assert.equal(speakable("**Tynwald** [c_abc123] sits at https://tynwald.org.im/ in Douglas."), "Tynwald sits at in Douglas.");
  assert.equal(speakable("This is well established [c_500a5233f9]. It's a Crown Dependency [c_b215494a4e], not the UK."), "This is well established. It's a Crown Dependency, not the UK.");
});

// ---------- knowledge base ----------
test("status is derived from evidence, never asserted", () => {
  const read = { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" };
  const gov = [{ url: "https://www.gov.im/x", verification: read }, { url: "https://tynwald.org.im/y", verification: read }];
  const blog = [{ url: "https://example.com/x" }, { url: "https://example.org/y" }];
  assert.equal(deriveStatus({ sources: gov, support: 2 }), "verified");
  assert.equal(deriveStatus({ sources: blog, support: 2 }), "corroborated");
  assert.equal(deriveStatus({ sources: blog, support: 1 }), "single_source");
  assert.equal(deriveStatus({ sources: [], support: 0, kind: "lateral" }), "hypothesis");
  assert.equal(deriveStatus({ sources: gov, support: 2, contradict: 2 }), "contested");
  assert.equal(deriveStatus({ sources: gov, support: 3, contradict: 1 }), "verified");
  assert.equal(isPrimarySource({ url: "https://www.legislation.gov.uk/ukpga/1981/61" }), true);
  assert.equal(isPrimarySource({ url: "https://en.wikipedia.org/wiki/Tynwald" }), false);
});
test("trust decays with age at the volatility half-life and rewards helpful claims", () => {
  const now = Date.parse("2026-09-02T00:00:00Z");
  const base = { status: "verified", confidence: 0.9, volatility: "live", verified_at: "2026-09-01T00:00:00Z", helpful: 0, unhelpful: 0 };
  const fresh = trust(base, now);
  const stale = trust({ ...base, verified_at: "2026-06-01T00:00:00Z" }, now);
  const structural = trust({ ...base, volatility: "structural", verified_at: "2026-06-01T00:00:00Z" }, now);
  assert.ok(fresh > stale, "live claims lose trust after months");
  assert.ok(structural > stale, "structural claims decay slower");
  assert.ok(trust({ ...base, helpful: 5 }, now) > fresh);
  assert.ok(trust({ ...base, unhelpful: 5 }, now) < fresh);
  assert.ok(trust({ ...base, status: "hypothesis" }, now) < trust({ ...base, status: "single_source" }, now));
});
test("fts query and coverage", () => {
  assert.equal(ftsQuery("What is the Tynwald of the Isle of Man?"), '"tynwa"* OR "isle" OR "man"');
  assert.equal(ftsQuery("the of and"), null);
  assert.equal(coverageFor("Who sits in Tynwald in Douglas?", ["Tynwald sits in Douglas on the Isle of Man"]).level, "strong");
  assert.equal(coverageFor("Who governs Bermuda's insurance market?", ["Tynwald sits in Douglas"]).level, "none");
});
test("upsert merges evidence and upgrades status; feedback feeds calibration and attention", () => {
  const kb = new KnowledgeBase(":memory:");
  const first = kb.upsertClaim({ text: "Tynwald is the parliament of the Isle of Man and claims continuous existence since 979.", topic: "Isle of Man", sources: [{ url: "https://example.org/tynwald" }], confidence: 0.6 });
  assert.equal(first.created, true);
  assert.equal(first.claim.status, "single_source");
  const second = kb.upsertClaim({ text: "Tynwald is the parliament of the Isle of Man and claims continuous existence since 979.", sources: [{ url: "https://www.tynwald.org.im/about" }], confidence: 0.9 });
  assert.equal(second.created, false);
  assert.equal(second.claim.support, 2);
  assert.equal(second.claim.status, "corroborated", "two publishers cited, neither page read yet");
  assert.equal(second.claim.sources.length, 2);
  assert.equal(second.claim.id, claimId("tynwald is the parliament of the isle of man and claims continuous existence since 979."));

  kb.upsertClaim({ text: "Bermuda is the oldest continuously self-governing British Overseas Territory.", topic: "Bermuda", sources: [{ url: "https://www.gov.bm/x" }], support: 2 });
  const focus = kb.focus("What is Tynwald on the Isle of Man?");
  assert.equal(focus.claims[0].id, second.claim.id);
  assert.equal(focus.coverage, "strong");
  assert.ok(focus.budgetUsed > 0);

  assert.equal(kb.calibrationAdjust(0.85), 0.85, "no adjustment until 5 samples");
  for (let i = 0; i < 5; i += 1) {
    const ep = kb.recordEpisode({ sessionId: "s1", question: `q${i}`, answer: "a", confidence: 0.85, status: "verified", claimsUsed: [second.claim.id] });
    kb.setFeedback(ep, -1);
  }
  assert.ok(Math.abs(kb.calibrationAdjust(0.85) - 0.425) < 0.01, "five wrong answers at 85% halve the spoken confidence");
  assert.equal(kb.getClaim(second.claim.id).unhelpful, 5);
  assert.equal(kb.calibrationSummary().samples, 5);
  const contested = kb.contradictClaim(second.claim.id, "not since 979, the date is traditional", "codex");
  assert.equal(contested.contradict, 1);
  assert.equal(contested.status, "corroborated", "one contradiction against two supports does not flip it");
  kb.contradictClaim(second.claim.id, "again", "grok");
  assert.equal(kb.getClaim(second.claim.id).status, "contested");

  const gap = kb.addGap("who is the Lieutenant Governor?", "thin");
  assert.equal(kb.addGap("who is the Lieutenant Governor?", "thin"), gap, "gaps dedupe while open");
  const x = kb.startExpedition({ question: "who is the Lieutenant Governor?", reason: "thin", strategies: ["research"] });
  kb.finishExpedition(x, { status: "done", summary: "ok", learned: [{ id: "c_1" }], costUsd: 0.2, durationMs: 100 });
  kb.resolveGapsFor("who is the Lieutenant Governor?", x);
  assert.equal(kb.openGaps().length, 0);
  assert.equal(kb.recentExpeditions(1)[0].learned.length, 1);
  assert.equal(kb.stats().expeditions.n, 1);
  kb.close();
});

// ---------- lateral ----------
test("lateral operators are distinct and the prompt carries the question", () => {
  const ops = pickOperators(4, () => 0.5);
  assert.equal(new Set(ops.map((o) => o.id)).size, 4);
  assert.ok(OPERATORS.length >= 8);
  const prompt = buildLateralPrompt({ question: "Why does Sark have no cars?", focusClaims: [{ text: "Sark is in the Bailiwick of Guernsey." }], operators: ops, concept: pickConcept(() => 0.1), strayClaim: "Gibraltar uses the pound." });
  assert.match(prompt, /Sark have no cars/);
  assert.match(prompt, /Gibraltar uses the pound/);
  assert.match(prompt, /RANDOM CONCEPT/);
});

// ---------- momm interpretation ----------
test("momm report maps findings and verdicts to per-claim agreement", () => {
  const report = {
    run_id: "rev_1", evidence: { ledger_url: "file:///ledger.html" },
    reviewers: [
      { agent: "codex", status: "success", verdict: "MODIFY", confidence: 0.8, summary: "C2 is wrong" },
      { agent: "grok", status: "success", verdict: "ACCEPT", confidence: 0.7, summary: "all fine" },
      { agent: "copilot", status: "authentication_required", verdict: null },
    ],
    findings: [
      { severity: "CRITICAL", issue: "C2: the office was abolished in 2019", rationale: "see gov.uk", sources: ["codex"] },
      { severity: "NITPICK", issue: "C3: unsure about the date", sources: ["codex"] },
    ],
  };
  const r = interpretReport(report, 3);
  assert.deepEqual(r.perClaim[0].agree, ["codex", "grok"]);
  assert.deepEqual(r.perClaim[1].agree, ["grok"]);
  assert.equal(r.perClaim[1].disagree[0].agent, "codex");
  assert.equal(r.perClaim[1].disagree[0].severity, "CRITICAL");
  assert.equal(r.perClaim[2].unsure.length, 1);
  assert.deepEqual(r.perClaim[2].agree, ["grok"]);
  assert.equal(r.successes, 2);
  assert.equal(r.ledgerUrl, "file:///ledger.html");
  assert.match(buildBrief({ question: "q", claims: [{ text: "x", sources: [] }] }), /C1\. x/);
});

test("research progress and returned results are recoverable by the originating browser session", () => {
  const kb = new KnowledgeBase(":memory:");
  const id = kb.queueExpedition({
    question: "What are the colours of the Manx flag?",
    reason: "requested by the user",
    strategies: ["research"],
    jurisdiction: "Isle of Man",
    sessionId: "session-return",
  });
  kb.beginExpedition(id);
  kb.updateExpeditionProgress(id, {
    stage: "source_check_complete",
    detail: "First source pass ready",
    preview: {
      summary: "The first sourced answer is ready while deeper checks continue.",
      findings: [{ text: "The flag has a red field.", sources: [{ url: "https://www.gov.im/flag", title: "Flag" }] }],
    },
  });
  kb.finishExpedition(id, { status: "done", summary: "Source check complete.", learned: [{ id: "c_flag" }] });

  const mine = kb.expeditionsForSession("session-return");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, id);
  assert.equal(mine[0].progress.stage, "source_check_complete");
  assert.equal(mine[0].preview.findings[0].text, "The flag has a red field.");
  assert.equal(kb.expeditionsForSession("different-session").length, 0);
  kb.close();
});

// ---------- learning gate ----------
test("evidence combination derives status and confidence", () => {
  const finding = { claim: "x", confidence: 0.8, sources: [{ url: "https://www.gov.uk/a", title: "a" }] };
  const solo = combineEvidence({ finding });
  assert.equal(solo.status, "single_source");
  const strong = combineEvidence({ finding, twin: { verdict: "original_holds", evidence: [{ url: "https://example.com/b", title: "b" }] }, momm: { agree: ["codex", "grok"], disagree: [], unsure: [] } });
  assert.equal(strong.status, "single_source", "model-selected citations need independent claim verification");
  assert.equal(strong.support, 2, "model votes do not add source support");
  assert.equal(strong.sources.length, 2);
  assert.ok(strong.confidence > solo.confidence);
  const attacked = combineEvidence({ finding, twin: { verdict: "counter_holds", note: "abolished", evidence: [] }, momm: { agree: [], disagree: [{ agent: "codex", severity: "CRITICAL", note: "wrong" }], unsure: [] } });
  assert.equal(attacked.status, "contested");
  assert.equal(attacked.notes.length, 2);
});
test("spoken addendum reads naturally", () => {
  const s = spokenAddendum({ question: "Who governs Sark?", learned: [{ text: "Sark's Chief Pleas is its legislature.", status: "verified", kind: "learned", answersQuestion: true }, { text: "h", status: "hypothesis", kind: "lateral" }], unresolved: ["the Seigneur's current powers"] });
  assert.match(s, /added 2 claims/);
  assert.match(s, /1 of them is verified/);
  assert.match(s, /Most useful: Sark's Chief Pleas/);
  assert.match(s, /Still open/);
  assert.match(spokenAddendum({ question: "q", learned: [] }), /could not find anything/);
});

// ---------- brain decisions ----------
test("expedition decision and status derivation", () => {
  assert.equal(weakestStatus([{ status: "verified" }, { status: "single_source" }]), "single_source");
  assert.equal(weakestStatus([]), "model_prior");
  const calm = decideExpedition({ meta: { expedition: false, gaps: [] }, confidence: 0.9, focus: { coverage: "strong" }, status: "verified" });
  assert.equal(calm.needed, false);
  const knowsItsLimits = decideExpedition({ meta: { expedition: false, gaps: ["outcome of the September election"] }, confidence: 0.85, focus: { coverage: "strong" }, status: "verified" });
  assert.equal(knowsItsLimits.needed, false, "a verified, confident answer noting an unknowable gap stays put");
  assert.equal(decideExpedition({ meta: { gaps: ["x"] }, confidence: 0.85, focus: { coverage: "strong" }, status: "corroborated" }).needed, false, "an optional gap on a strong corroborated answer is offered only when the evidence is actually weak");
  const worried = decideExpedition({ meta: { expedition: true, gaps: ["current holder"] }, confidence: 0.5, focus: { coverage: "thin" }, status: "model_prior" });
  assert.equal(worried.needed, true);
  assert.match(worried.reason, /confidence 0\.50/);
  assert.match(worried.reason, /coverage thin/);
  assert.match(worried.reason, /gaps: current holder/);
  const text = renderFocus({ coverage: "strong", claims: [{ id: "c_1", status: "verified", trust: 0.9, verified_at: "2026-08-01T00:00:00Z", topic: "T", text: "body" }] });
  assert.match(text, /\[c_1\] \(verified, trust 0.90, verified 2026-08-01, topic: T\) body/);
  assert.match(renderFocus({ coverage: "none", claims: [] }), /none relevant/);
  assert.ok(META_MARKER.length > 0);
});
