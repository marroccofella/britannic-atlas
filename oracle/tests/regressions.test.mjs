// Regressions from the momm peer review of the Oracle sources
// (run rev_20260902172308_i2qc: codex REJECT, copilot MODIFY, grok MODIFY).
// One test per reproduced defect, so none of them can come back.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgeBase, deriveStatus, evidenceKey, isManxText, isPrimarySource } from "../lib/kb.mjs";
import { parseClaudeOutput, resolveClaude } from "../lib/claude.mjs";
import { curiosityTarget } from "../lib/curiosity.mjs";
import { ensureSeeded } from "../lib/seed.mjs";
import { originAllowed, isJsonRequest, safeStaticPath } from "../lib/http.mjs";
import { combineEvidence, ExpeditionQueue } from "../lib/learning.mjs";
import { interpretReport } from "../lib/momm.mjs";
import { Bus } from "../lib/bus.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("re-ingesting identical evidence does not inflate support (codex/copilot CRITICAL)", () => {
  const kb = new KnowledgeBase(":memory:");
  const claim = { text: "Sark replaced its feudal legislature with a wholly elected Chief Pleas in 2008.", sources: [{ url: "https://www.gov.gg/sark" }], support: 2, confidence: 0.8 };
  assert.equal(kb.upsertClaim(claim).claim.support, 2);
  const again = kb.upsertClaim(claim);
  assert.equal(again.claim.support, 2, "the same evidence seen twice is still one piece of evidence");
  assert.equal(again.claim.contradict, 0);
  const fresh = kb.upsertClaim({ ...claim, sources: [{ url: "https://www.legislation.gov.uk/sark" }], support: 1 });
  assert.equal(fresh.claim.support, 3, "genuinely new evidence still counts");
  assert.equal(evidenceKey({ sources: [{ url: "b" }, { url: "a" }], support: 1 }), evidenceKey({ sources: [{ url: "a" }, { url: "b" }], support: 1 }), "the key ignores source order");
  assert.notEqual(evidenceKey({ sources: [{ url: "a" }], support: 1 }), evidenceKey({ sources: [{ url: "a" }], support: 2 }));
  assert.equal(evidenceKey({ explicit: "seed:1" }), "seed:1");
  kb.close();
});

test("feedback cannot be replayed, can be changed, and rejects invalid votes (codex WARNING)", () => {
  const kb = new KnowledgeBase(":memory:");
  const c = kb.upsertClaim({ text: "Gibraltar retains a tax system distinct from the United Kingdom's.", sources: [{ url: "https://www.gibraltar.gov.gi/tax" }], support: 2 }).claim;
  const ep = kb.recordEpisode({ sessionId: "s", question: "q", answer: "a", confidence: 0.75, status: "verified", claimsUsed: [c.id] });

  assert.deepEqual(kb.setFeedback(ep, 0), { error: "vote must be 1 or -1" }, "zero must not be read as a downvote");
  assert.deepEqual(kb.setFeedback(ep, "rubbish"), { error: "vote must be 1 or -1" });
  assert.equal(kb.getClaim(c.id).unhelpful, 0);

  kb.setFeedback(ep, 1);
  assert.equal(kb.setFeedback(ep, 1).unchanged, true);
  assert.equal(kb.getClaim(c.id).helpful, 1, "a repeated vote counts once");
  assert.equal(kb.calibrationSummary().samples, 1);
  assert.equal(kb.calibrationSummary().buckets[0].empirical, 1);

  assert.equal(kb.setFeedback(ep, -1).changed, true);
  const after = kb.getClaim(c.id);
  assert.equal(after.helpful, 0, "changing the vote reverses the previous one");
  assert.equal(after.unhelpful, 1);
  assert.equal(kb.calibrationSummary().samples, 1, "one episode is one calibration sample however often it is voted on");
  assert.equal(kb.calibrationSummary().buckets[0].empirical, 0);
  kb.close();
});

test("an unevidenced adversarial pass is not a second source (evidence gate)", () => {
  const finding = { claim: "x", confidence: 0.8, sources: [{ url: "https://www.gov.uk/a", title: "a" }] };
  const hollow = combineEvidence({ finding, twin: { verdict: "original_holds", evidence: [], note: "found nothing against it" } });
  assert.equal(hollow.support, 1);
  assert.equal(hollow.status, "single_source", "silence from the adversary must not promote a claim");
  const real = combineEvidence({ finding, twin: { verdict: "original_holds", evidence: [{ url: "https://www.legislation.gov.uk/b", title: "b" }] } });
  assert.equal(real.support, 2);
  assert.equal(real.status, "single_source", "citation lists do not establish claim support");
  const unverifiedLateral = combineEvidence({ finding: { kind: "lateral", sources: [], confidence: 0.2 } });
  assert.equal(unverifiedLateral.support, 0, "a route without evidence cannot count as support");
});

test("a reviewer declaring near-zero confidence does not count as agreement (evidence gate)", () => {
  const report = { reviewers: [
    { agent: "grok", status: "success", verdict: "MODIFY", confidence: 0.1, summary: "no grounded findings" },
    { agent: "codex", status: "success", verdict: "ACCEPT", confidence: 0.9, summary: "checked" },
  ], findings: [] };
  const r = interpretReport(report, 2);
  assert.deepEqual(r.perClaim[0].agree, ["codex"]);
  assert.equal(r.reviewers.find((x) => x.agent === "grok").ignored, "confidence below agreement threshold");
});

test("an expedition that learns nothing leaves its gap open (codex WARNING)", () => {
  const kb = new KnowledgeBase(":memory:");
  const question = "who audits the Pitcairn Islands' accounts?";
  const gap = kb.addGap(question, "thin");
  const id = kb.startExpedition({ question, reason: "thin", strategies: [] });
  const learned = []; // mirrors runExpedition's ingest gate with nothing found
  kb.finishExpedition(id, { status: learned.length ? "done" : "empty", summary: "nothing found", learned });
  if (learned.length) kb.resolveGapsFor(question, id);
  assert.equal(kb.getExpedition(id).status, "empty");
  assert.equal(kb.openGaps().length, 1, "an unanswered gap must stay open so the engine tries again");
  assert.equal(kb.openGaps()[0].id, gap);
  kb.close();
});

test("an empty strategy list falls back to the defaults instead of doing nothing (codex WARNING)", () => {
  const kb = new KnowledgeBase(":memory:");
  const q = new ExpeditionQueue({ kb, bus: new Bus(), root: REPO_ROOT });
  q.pump = async () => {}; // never spend money in a test
  const r = q.enqueue({ question: "does Tristan da Cunha have a resident magistrate?", reason: "test", strategies: [] });
  assert.equal(r.queued, true);
  assert.deepEqual(kb.getExpedition(r.id).strategies, q.defaultStrategies());
  kb.close();
});

test("an interrupted seed is completed on the next start, not locked in (codex WARNING)", async () => {
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "A partial seed left exactly one claim behind before the process died.", kind: "seed", support: 2, sources: [{ url: "https://www.gov.uk/x" }] });
  const first = await ensureSeeded(kb, REPO_ROOT);
  assert.notEqual(first.skipped, true, "a claim count above zero must not be mistaken for a completed seed");
  assert.ok(kb.count() > 10, `expected the full corpus, got ${kb.count()}`);
  assert.ok(kb.getMeta("seeded_at"));
  assert.equal((await ensureSeeded(kb, REPO_ROOT)).skipped, true, "a completed seed is not repeated");
  kb.close();
});

test("the Claude CLI resolves to a real executable, never a shell fallback (copilot WARNING)", () => {
  const oldPath = process.env.PATH, oldBin = process.env.ORACLE_CLAUDE_BIN, oldAppData = process.env.APPDATA;
  process.env.ORACLE_CLAUDE_BIN = fileURLToPath(import.meta.url);
  try {
    const r = resolveClaude();
    assert.equal(r.shell, false, "shell:true would mangle the JSON schema argument on Windows");
    assert.equal(r.cmd, fileURLToPath(import.meta.url), "the unit test uses its own fixture path, not an installed CLI");
    process.env.PATH = ""; delete process.env.ORACLE_CLAUDE_BIN; process.env.APPDATA = path.join(REPO_ROOT, "no-such-appdata");
    assert.throws(() => resolveClaude(), /not found/, "a missing CLI must fail loudly, not silently corrupt the request");
  }
  finally {
    if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath;
    if (oldAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = oldAppData;
    if (oldBin === undefined) delete process.env.ORACLE_CLAUDE_BIN; else process.env.ORACLE_CLAUDE_BIN = oldBin;
  }
});

test("state-changing requests are same-origin and JSON only (codex CRITICAL)", () => {
  const host = "127.0.0.1:4242";
  assert.equal(originAllowed({ headers: {} }, host), true, "a same-origin fetch and curl send no Origin");
  assert.equal(originAllowed({ headers: { origin: "http://127.0.0.1:4242" } }, host), true);
  assert.equal(originAllowed({ headers: { origin: "https://evil.example" } }, host), false);
  assert.equal(originAllowed({ headers: { origin: "null" } }, host), false);
  assert.equal(isJsonRequest({ headers: { "content-type": "text/plain;charset=UTF-8" } }), false, "the CORS-safelisted form post must be refused");
  assert.equal(isJsonRequest({ headers: { "content-type": "application/json; charset=utf-8" } }), true);
  assert.equal(isJsonRequest({ headers: {} }), false);
});

test("static paths cannot escape the public directory (copilot NITPICK)", () => {
  const root = path.join("D:", "app", "public");
  assert.equal(safeStaticPath(root, "/"), path.join(root, "index.html"));
  assert.equal(safeStaticPath(root, "/app.js"), path.join(root, "app.js"));
  assert.equal(safeStaticPath(root, "/../server.mjs"), null);
  assert.equal(safeStaticPath(root, "/%2e%2e/server.mjs"), null);
  assert.equal(safeStaticPath(path.join("D:", "app", "pub"), "/../pub-evil/x"), null, "a sibling sharing the prefix is not inside");
});

test("Manx curiosity targets follow priority and ignore foreign ledger pollution", () => {
  const kb = new KnowledgeBase(":memory:");
  assert.equal(curiosityTarget(kb), null, "an empty ledger has nothing to dream about");
  kb.upsertClaim({ text: "The Falkland Islands run their own fisheries licensing regime.", topic: "Falklands", kind: "seed", sources: [{ url: "https://www.gov.fk/fisheries" }], support: 2 });
  assert.equal(curiosityTarget(kb), null, "foreign material cannot become an autonomous Manx target");
  kb.upsertClaim({ text: "The Isle of Man runs its own harbours under Manx public administration.", topic: "Isle of Man infrastructure", kind: "seed", sources: [{ url: "https://www.gov.im/harbours" }, { url: "https://tynwald.org.im/harbours" }], support: 2 });
  assert.match(curiosityTarget(kb).reason, /curiosity/);
  kb.upsertClaim({ text: "A weakly evidenced claim about Isle of Man harbour capacity.", topic: "Isle of Man infrastructure", kind: "learned", sources: [{ url: "https://example.com/x" }], confidence: 0.2 });
  assert.match(curiosityTarget(kb).reason, /weakest/);
  kb.addGap("what is the current capacity of Isle of Man harbours?", "thin");
  assert.match(curiosityTarget(kb).reason, /open gap/);
  assert.equal(curiosityTarget(kb, { forcedQuestion: "why?" }).question, "why?");
  kb.close();
});

test("randomClaim with no exclusion does not silently skip untopiced claims (copilot suggestion)", () => {
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "A verified claim carrying no topic at all, which must remain reachable.", sources: [{ url: "https://www.gov.uk/y" }, { url: "https://www.parliament.uk/y" }], support: 2 });
  assert.ok(kb.randomClaim(), "an empty excludeTopic must mean no filter");
  assert.equal(kb.randomClaim({ excludeTopic: "" })?.topic, "");
  kb.close();
});

// The live session on 2 September 2026 showed speech-recognition noise
// launching paid expeditions: "What is the capital?" cost $1.25, "Oracle M8
// against." $1.08, "I have." $0.88 and "I have been." $0.80. Every string
// below is a real transcript from that session.
test("microphone noise never launches a paid expedition", async () => {
  const { isResearchable, decideExpedition } = await import("../lib/brain.mjs");
  const junk = ["I have been.", "I have.", "Well.", "Any.", "Oracle M8 against.", "Some dump cloth.", "What is the capital?", "That's funny to both got gay kids talking about."];
  for (const q of junk) {
    const cheap = isResearchable(q);
    const decision = decideExpedition({ meta: { expedition: true, gaps: ["everything"] }, confidence: 0.1, focus: { coverage: "none" }, status: "model_prior", researchable: cheap });
    assert.equal(decision.needed, false, `"${q}" must not spend money`);
  }
  const real = ["What's the capital of Isle of Man?", "How many people live there today?", "How do I register a UK vehicle in Manx within the first 24 hours?", "What are the Sovereign Base Areas of Akrotiri and Dhekelia?"];
  for (const q of real) {
    assert.equal(isResearchable(q), true, `"${q}" is a real question`);
    assert.equal(decideExpedition({ meta: { expedition: true }, confidence: 0.2, focus: { coverage: "none" }, status: "model_prior", researchable: true }).needed, true);
  }
});

test("the model's own researchable verdict can veto an expedition", async () => {
  const { decideExpedition } = await import("../lib/brain.mjs");
  const passesLocally = "Nickel creatures connected to Manx folklore stories.";
  const d = decideExpedition({ meta: { expedition: true, researchable: false }, confidence: 0.1, focus: { coverage: "none" }, status: "model_prior", researchable: true });
  assert.equal(d.needed, false, `the model must be able to veto: ${passesLocally}`);
  assert.equal(d.researchable, false);
});

test("official-source matching rejects lookalike host suffixes (momm WARNING)", () => {
  assert.equal(isPrimarySource({ url: "https://fun.org/report" }), false);
  assert.equal(isPrimarySource({ url: "https://notparliament.uk/report" }), false);
  assert.equal(isPrimarySource({ url: "https://xbailii.org/case" }), false);
  assert.equal(isPrimarySource({ url: "https://myroyal.uk/news" }), false);
  assert.equal(isPrimarySource({ url: "https://www.un.org/report" }), true);
  assert.equal(isPrimarySource({ url: "https://sub.un.org/report" }), true);
  assert.equal(isPrimarySource({ url: "https://un.org.evil.example/report" }), false);
  assert.equal(isPrimarySource({ url: "https://evilgov.im/report" }), false);
  assert.equal(isPrimarySource({ url: "https://records.parliament.xyz/report" }), false);
  assert.equal(isPrimarySource({ url: "https://parliament.uk/report" }), true);
  assert.equal(deriveStatus({ sources: [{ url: "https://fun.org/report" }], support: 2 }), "single_source", "one publisher is one route however often it is counted");
  assert.equal(deriveStatus({ sources: [{ url: "https://fun.org/report" }, { url: "https://other.example/report" }], support: 2 }), "corroborated");
});

test("a failed gap cools down instead of becoming the very next paid dream (momm WARNING)", () => {
  const kb = new KnowledgeBase(":memory:");
  const question = "what is the current capacity of Isle of Man harbours?";
  kb.addGap(question, "thin");
  const id = kb.startExpedition({ question, reason: "test", strategies: [] });
  kb.finishExpedition(id, { status: "empty", summary: "nothing reliable found", learned: [] });
  const failed = kb.openGaps(1)[0];
  assert.equal(failed.attempt_count, 1);
  assert.equal(failed.last_outcome, "empty");
  assert.ok(Date.parse(failed.next_attempt_at) > Date.now());
  assert.equal(curiosityTarget(kb), null, "a just-failed gap must not immediately spend again");
  kb.addGap("what is the Isle of Man airport's current passenger capacity?", "thin");
  assert.match(curiosityTarget(kb).question, /airport/i, "another eligible Manx gap should be selected during cooldown");
  assert.ok(kb.openGaps(10, { jurisdiction: "Isle of Man", readyOnly: true, at: Date.parse(failed.next_attempt_at) + 1 }).some((gap) => gap.id === failed.id), "the failed gap becomes eligible after its retry time");
  kb.close();
});

test("a Manx gap remains reachable behind a large foreign backlog (momm WARNING)", () => {
  const kb = new KnowledgeBase(":memory:");
  for (let i = 0; i < 120; i += 1) kb.addGap(`who audits the Bermuda accounts, question ${i}?`, "thin");
  kb.addGap("what is the current capacity of Isle of Man harbours?", "thin");
  assert.equal(kb.openGaps(1, { jurisdiction: "Isle of Man" }).length, 1);
  kb.close();
});

test("every Manx scope path shares one predicate (momm WARNING)", async () => {
  assert.equal(isManxText("Who owns the Calf of Man?"), true);
  for (const alias of ["Isle of Man", "Manx", "Mann", "Ellan Vannin", "Calf of Man", "Tynwald", "IOM"]) assert.equal(isManxText(alias), true, alias);
  assert.equal(isManxText("Manning the harbour office"), false);
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "Mann has a distinct legal and political identity in the Irish Sea.", topic: "Mann", kind: "learned", sources: [{ url: "https://www.gov.im/about" }, { url: "https://tynwald.org.im/about" }], support: 2 });
  assert.equal(kb.recentLearned(1, { jurisdiction: "Isle of Man" }).length, 1, "SQL scope must recognise every shared Manx alias");
  const learning = await import("../lib/learning.mjs");
  assert.equal(learning.expeditionJurisdiction?.("Who owns the Calf of Man?"), "Isle of Man");
  kb.close();
});

test("a malformed expedition cap fails closed to a finite default (momm WARNING)", () => {
  const kb = new KnowledgeBase(":memory:");
  for (const value of [Number.NaN, Infinity, -1, 1.5, "six", ""]) {
    const q = new ExpeditionQueue({ kb, bus: new Bus(), root: REPO_ROOT, maxPerHour: value });
    assert.equal(q.budgetLeft(), 6, String(value));
    assert.equal(Number.isFinite(q.status().budgetLeft), true);
  }
  const off = new ExpeditionQueue({ kb, bus: new Bus(), root: REPO_ROOT, maxPerHour: 0 });
  assert.equal(off.budgetLeft(), 0);
  assert.equal(off.enqueue({ question: "A valid Isle of Man research question?", reason: "test" }).queued, false);
  assert.equal(new ExpeditionQueue({ kb, bus: new Bus(), root: REPO_ROOT, maxPerHour: "3" }).budgetLeft(), 3);
  kb.close();
});

test("old evidence keys remain idempotent after many later merges (momm NITPICK)", () => {
  const kb = new KnowledgeBase(":memory:");
  const base = { text: "A long-lived Isle of Man claim must not count the same official evidence twice.", sources: [{ url: "https://www.gov.im/evidence" }], support: 1 };
  const first = kb.upsertClaim(base).claim;
  for (let i = 0; i < 45; i += 1) kb.upsertClaim({ text: base.text, evidenceKey: `later-${i}`, support: 0 });
  assert.equal(kb.upsertClaim(base).claim.support, first.support);
  kb.close();
});

test("status is derived and cannot be promoted by an input label (momm suggestion)", () => {
  const kb = new KnowledgeBase(":memory:");
  const claim = kb.upsertClaim({ text: "An unsupported Isle of Man claim cannot label itself verified.", status: "verified", sources: [{ url: "https://example.com/claim" }], support: 1 }).claim;
  assert.equal(claim.status, "single_source");
  kb.close();
});

test("ledger transactions reject async callbacks and roll back partial feedback (momm suggestions)", () => {
  const kb = new KnowledgeBase(":memory:");
  assert.throws(() => kb.transaction(async () => {}), /synchronous/);
  const claim = kb.upsertClaim({ text: "An Isle of Man feedback transaction should be indivisible.", sources: [{ url: "https://www.gov.im/feedback" }], support: 2 }).claim;
  const episode = kb.recordEpisode({ question: "q", answer: "a", confidence: 0.8, claimsUsed: [claim.id] });
  kb.db.exec("CREATE TRIGGER reject_helpful BEFORE UPDATE OF helpful ON claims BEGIN SELECT RAISE(ABORT, 'forced test failure'); END;");
  assert.throws(() => kb.setFeedback(episode, 1), /forced test failure/);
  assert.equal(kb.getEpisode(episode).feedback, null);
  assert.equal(kb.calibrationSummary().samples, 0);
  kb.close();
});

test("Claude non-stream output accepts pretty JSON and diagnostic-prefixed compact JSON (momm suggestion)", () => {
  assert.deepEqual(parseClaudeOutput('{\n  "result": "ok",\n  "total_cost_usd": 0\n}'), { result: "ok", total_cost_usd: 0 });
  assert.deepEqual(parseClaudeOutput('diagnostic\n{"result":"last"}'), { result: "last" });
  assert.deepEqual(parseClaudeOutput('diagnostic\n{\n  "result": "pretty"\n}'), { result: "pretty" });
});
