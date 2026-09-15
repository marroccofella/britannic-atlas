import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answer, decideExpedition, isResearchable, weakestStatus } from "../lib/brain.mjs";
import { curiosityTarget } from "../lib/curiosity.mjs";
import { createDialogueState, resolveDialogue } from "../lib/dialogue.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";
import { ExpeditionQueue } from "../lib/learning.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_SOURCE = readFileSync(path.join(ORACLE, "public", "app.js"), "utf8");
const SERVER_SOURCE = readFileSync(path.join(ORACLE, "server.mjs"), "utf8");

function fakeModel(meta, result = { model: "test", costUsd: 0 }) {
  return async ({ onDelta }) => {
    onDelta(`A cautious answer. <<meta>>${JSON.stringify({ confidence: 0.4, used: [], status: "model_prior", gaps: [], expedition: false, researchable: true, lateral_hint: "", ...meta })}`);
    return result;
  };
}

test("a foreign one-turn answer cannot become the next Manx follow-up", () => {
  const prior = resolveDialogue("Tell me about Isle of Man infrastructure", createDialogueState());
  const foreign = resolveDialogue("What is company law in Jersey?", prior.state);
  const resumed = resolveDialogue("tell me more", foreign.state);
  assert.equal(resumed.route, "answer");
  assert.equal(resumed.jurisdiction, "Isle of Man");
  assert.match(resumed.canonical, /Isle of Man infrastructure/i);
  assert.doesNotMatch(resumed.canonical, /Jersey/i);

  const freshForeign = resolveDialogue("Show me a map of Jersey", createDialogueState());
  assert.equal(resolveDialogue("tell me more", freshForeign.state).route, "clarify");
});

test("unconfirmed ambient speech cannot enter specialised paid routes", () => {
  const speech = { source: "speech", recognitionConfidence: 0.95 };
  for (const phrase of [
    "Road infrastructure is in the news today",
    "There are maps on the table",
    "The radio said tell me about infrastructure and then stopped",
  ]) assert.equal(resolveDialogue(phrase, createDialogueState(), speech).route, "clarify", phrase);
});

test("a user's confirmed speech fragment is accepted exactly once", () => {
  const low = { source: "speech", recognitionConfidence: 0.1 };
  assert.equal(resolveDialogue("Manx companies", createDialogueState(), low).route, "clarify");
  assert.equal(resolveDialogue("Manx companies", createDialogueState(), { ...low, confirmed: true }).route, "answer");
  assert.equal(resolveDialogue("Douglas harbour", createDialogueState(), { ...low, confirmed: true }).route, "answer");
});

test("named British jurisdictions override one turn without contradictory Manx wording", () => {
  for (const [question, expected] of [
    ["What is company law in the Cayman Islands?", "Cayman Islands"],
    ["Tell me about Falkland Islands infrastructure", "Falkland Islands"],
    ["How are companies registered in Saint Helena?", "Saint Helena"],
  ]) {
    const turn = resolveDialogue(question, createDialogueState());
    assert.equal(turn.jurisdiction, expected, question);
    assert.match(turn.canonical, new RegExp(expected, "i"));
    assert.doesNotMatch(turn.canonical, /specifically for the Isle of Man/i);
  }
});

test("a foreign one-turn override announces the return to the Manx default", async () => {
  const kb = new KnowledgeBase(":memory:");
  const resolution = resolveDialogue("What is the population of Jersey?", createDialogueState());
  const events = [];
  await answer({
    kb, question: resolution.raw, resolution, sessionId: "foreign-announcement",
    emit: (type, data) => events.push({ type, data }),
    runModel: fakeModel({ researchable: false, expedition: false }),
  });
  const scope = events.find((event) => event.type === "scope")?.data;
  assert.equal(scope.persistent, false);
  assert.match(scope.announcement, /this answer only/i);
  assert.match(scope.announcement, /unqualified follow-up returns to the Isle of Man/i);
  kb.close();
});

test("autonomous Manx targets retain jurisdiction even when their wording is neutral", () => {
  const gapTarget = curiosityTarget({
    openGaps: () => [{ question: "How many berths are operational?", reason: "thin", jurisdiction: "IM" }],
    weakestClaims: () => [],
    randomClaim: () => null,
  });
  assert.equal(gapTarget.jurisdiction, "Isle of Man");

  const weakTarget = curiosityTarget({
    openGaps: () => [],
    weakestClaims: () => [{ text: "The main harbour has limited capacity.", trust: 0.2, jurisdiction: "IM" }],
    randomClaim: () => null,
  });
  assert.equal(weakTarget.jurisdiction, "Isle of Man");
});

test("legacy Manx scope is backfilled from the originating provenance question", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "oracle-provenance-"));
  const file = path.join(dir, "legacy.db");
  let kb = null;
  try {
    kb = new KnowledgeBase(file);
    const inserted = kb.upsertClaim({
      text: "The main harbour has a breakwater and several operational berths.",
      topic: "Ports",
      provenance: { question: "What is the Isle of Man port capacity?" },
    }).claim;
    assert.equal(inserted.jurisdiction, null);
    kb.close();
    kb = null;
    kb = new KnowledgeBase(file);
    assert.equal(kb.getClaim(inserted.id).jurisdiction, "IM");
    kb.close();
    kb = null;
  } finally {
    kb?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("queueing alone does not consume a gap attempt or claim that work is running", () => {
  const kb = new KnowledgeBase(":memory:");
  const question = "What is the current Isle of Man harbour capacity?";
  kb.addGap(question, "thin");
  const queue = new ExpeditionQueue({ kb, bus: { publish() {} }, root: ORACLE, enabled: true, useMomm: false, useLateral: false });
  queue.pump = async () => {};
  const accepted = queue.enqueue({ question, reason: "test", strategies: ["research"], jurisdiction: "Isle of Man" });
  assert.equal(accepted.queued, true);
  assert.equal(kb.getExpedition(accepted.id).status, "queued");
  assert.equal(kb.getExpedition(accepted.id).jurisdiction, "IM");
  assert.equal(queue.queue[0].jurisdiction, "Isle of Man");
  assert.equal(kb.openGaps(1)[0].attempt_count, 0);
  kb.close();
});

test("same-session concurrent confirmations deduplicate one topic but retain an unrelated topic", async () => {
  const kb = new KnowledgeBase(":memory:");
  const queue = new ExpeditionQueue({ kb, bus: { publish() {} }, root: ORACLE, enabled: true, useMomm: false, useLateral: false });
  queue.pump = async () => {};
  const population = { sessionId: "two-topics", question: "What is the current Isle of Man population?", reason: "confirmed", strategies: ["research"], jurisdiction: "Isle of Man" };
  const companies = { sessionId: "two-topics", question: "What are the current Isle of Man company incorporation requirements?", reason: "confirmed", strategies: ["research"], jurisdiction: "Isle of Man" };

  const [first, duplicate, unrelated] = await Promise.all([
    Promise.resolve().then(() => queue.enqueue(population)),
    Promise.resolve().then(() => queue.enqueue(population)),
    Promise.resolve().then(() => queue.enqueue(companies)),
  ]);

  assert.equal(first.queued, true);
  assert.equal(duplicate.queued, false);
  assert.equal(duplicate.alreadyRunning, true);
  assert.equal(duplicate.id, first.id);
  assert.equal(unrelated.queued, true);
  assert.notEqual(unrelated.id, first.id);
  assert.equal(queue.queue.length, 2);
  assert.notEqual(queue.queue[0].researchKey, queue.queue[1].researchKey);
  assert.deepEqual(queue.status().queued.map((job) => job.question), [population.question, companies.question]);
  kb.close();
});

test("automatic research carries the resolved Manx jurisdiction into its expedition", async () => {
  const kb = new KnowledgeBase(":memory:");
  let enqueued = null;
  const resolution = resolveDialogue("What is the current Isle of Man harbour capacity?", createDialogueState());
  await answer({
    kb,
    question: resolution.raw,
    resolution,
    sessionId: "scoped-expedition",
    emit() {},
    expeditions: { enqueue(job) { enqueued = job; return { queued: true, id: "x_scoped" }; } },
    wantExpedition: true,
    runModel: fakeModel({ confidence: 0.2, status: "model_prior", expedition: true, gaps: ["current harbour capacity"] }),
  });
  assert.equal(enqueued?.jurisdiction, "Isle of Man");
  kb.close();
});

test("request admission fails closed for malformed limits and same-session overlap", async () => {
  const { boundedPositiveInt, ActiveRequestRegistry } = await import("../lib/http.mjs");
  assert.equal(boundedPositiveInt("not-a-number", 4), 4);
  assert.equal(boundedPositiveInt("0", 4), 4);
  const registry = new ActiveRequestRegistry(2);
  const first = { controller: new AbortController() };
  assert.equal(registry.admit({ sessionId: "same", requestId: "r1", operation: first }).ok, true);
  assert.equal(registry.admit({ sessionId: "same", requestId: "r2", operation: { controller: new AbortController() } }).ok, false);
  assert.equal(registry.admit({ sessionId: "other", requestId: "r3", operation: { controller: new AbortController() } }).ok, true);
  assert.equal(registry.admit({ sessionId: "third", requestId: "r4", operation: { controller: new AbortController() } }).status, 429);
  registry.release("r1", first);
  assert.equal(registry.size, 1);
});

test("a duplicate dialogue acknowledgement completes locally without occupying answer capacity", async () => {
  const { ActiveRequestRegistry } = await import("../lib/http.mjs");
  const sessions = new (await import("../lib/dialogue.mjs")).DialogueSessions();
  const first = sessions.resolve("ack-session", "Tell me about infrastructure");
  sessions.markInFlight("ack-session", first);
  const duplicate = sessions.preview("ack-session", "Tell me about infrastructure");
  assert.equal(duplicate.route, "ack");
  assert.equal(duplicate.semanticKey, first.semanticKey);
  const registry = new ActiveRequestRegistry(1);
  assert.equal(registry.completeLocal({ sessionId: "ack-session", requestId: "ack-local", clientTurn: 1 }).ok, true);
  assert.equal(registry.size, 0);
});

test("a newer local turn fences every state write from the interrupted answer", async () => {
  const { ActiveRequestRegistry } = await import("../lib/http.mjs");
  const registry = new ActiveRequestRegistry(2);
  const old = { controller: new AbortController() };
  assert.equal(registry.admit({ sessionId: "fenced", requestId: "old", clientTurn: 1, operation: old }).ok, true);
  const local = registry.completeLocal({ sessionId: "fenced", requestId: "local", clientTurn: 2, replacePrevious: true });
  assert.equal(local.ok, true);
  assert.equal(local.previous?.operation, old);
  assert.equal(registry.release("old", old), false, "a superseded answer may clean up but must not commit conversation state");
  assert.equal(registry.size, 0);
});

test("request ids, client turns and replacements remain identity-safe until work settles", async () => {
  const { ActiveRequestRegistry } = await import("../lib/http.mjs");
  const registry = new ActiveRequestRegistry(3);
  const old = { controller: new AbortController() };
  assert.equal(registry.admit({ sessionId: "same", requestId: "old", clientTurn: 1, operation: old }).ok, true);
  assert.equal(registry.release("old", old), true);
  assert.equal(registry.admit({ sessionId: "same", requestId: "old", clientTurn: 2, operation: { controller: new AbortController() } }).error, "duplicate request");

  const current = { controller: new AbortController() };
  assert.equal(registry.admit({ sessionId: "same", requestId: "current", clientTurn: 2, operation: current }).ok, true);
  assert.equal(registry.admit({ sessionId: "same", requestId: "late", clientTurn: 1, replacePrevious: true, operation: { controller: new AbortController() } }).error, "stale conversation turn");
  assert.equal(registry.admit({ sessionId: "same", requestId: "equal", clientTurn: 2, replacePrevious: true, operation: { controller: new AbortController() } }).error, "stale conversation turn");
  assert.equal(registry.getSession("same").operation, current);
  assert.equal(registry.size, 1);
  const other = { controller: new AbortController() };
  assert.equal(registry.admit({ sessionId: "other", requestId: "other", clientTurn: 1, operation: other }).ok, true);
  const replacement = { controller: new AbortController() };
  const replaced = registry.admit({ sessionId: "same", requestId: "replacement", clientTurn: 3, replacePrevious: true, operation: replacement });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.previous.operation, current);
  assert.equal(registry.size, 3, "the terminating operation must still count toward the cap");
  assert.equal(registry.admit({ sessionId: "full", requestId: "full", clientTurn: 1, operation: { controller: new AbortController() } }).status, 429);
  let emptyResolved = false;
  const empty = registry.whenEmpty().then(() => { emptyResolved = true; });
  await Promise.resolve();
  assert.equal(emptyResolved, false);
  assert.equal(registry.release("current", current), false, "the replaced operation is cleaned up but cannot commit stale state");
  assert.equal(registry.getSession("same").operation, replacement);
  assert.equal(registry.size, 2);
  registry.release("replacement", replacement);
  registry.release("other", other);
  await empty;
  assert.equal(registry.size, 0);
  assert.equal(registry.admit({ sessionId: "same", requestId: "older-after-release", clientTurn: 2, operation: { controller: new AbortController() } }).error, "stale conversation turn");

  const capacity = new ActiveRequestRegistry(1);
  const blocker = { controller: new AbortController() };
  assert.equal(capacity.admit({ sessionId: "blocker", requestId: "blocker", clientTurn: 1, operation: blocker }).ok, true);
  const rejected = { sessionId: "retry", requestId: "retry-id", clientTurn: 1, operation: { controller: new AbortController() } };
  assert.equal(capacity.admit(rejected).status, 429);
  capacity.release("blocker", blocker);
  assert.equal(capacity.admit(rejected).ok, true, "capacity rejection must not consume the id or turn");
});

test("the server uses identity-safe admission and handles both shutdown signals", () => {
  assert.doesNotMatch(SERVER_SOURCE, /const MAX_IN_FLIGHT = Number\(/);
  assert.match(SERVER_SOURCE, /new ActiveRequestRegistry\(/);
  assert.match(SERVER_SOURCE, /process\.on\("SIGTERM"/);
  assert.match(SERVER_SOURCE, /clientTurn:\s*body\.clientTurn/);
  assert.match(SERVER_SOURCE, /activeAnswers\.whenEmpty\(\)/);
  assert.match(SERVER_SOURCE, /expeditions\.whenIdle\(\)/);
  assert.match(APP_SOURCE, /sessionStorage\.setItem\([^\n]*clientTurn/);
  assert.doesNotMatch(SERVER_SOURCE, /server\.close\(\);\s*kb\.close\(\);\s*process\.exit/);
});

test("MOMM and canvas work is cancelled by scope and drained before the knowledge base closes", () => {
  const resetStart = SERVER_SOURCE.indexOf('p === "/api/session/reset"');
  const resetEnd = SERVER_SOURCE.indexOf('p === "/api/feedback"', resetStart);
  const resetBody = SERVER_SOURCE.slice(resetStart, resetEnd);
  // Leaving a conversation must not destroy paid work (15 September 2026:
  // "New conversation" killed a running research check and a MOMM review).
  // Only the explicit Stop cancels reviews, canvases and research.
  assert.doesNotMatch(resetBody, /stopToolWork|reviewJobs\.stop|expeditions\.cancelSession|visualActions\.delete/, "reset must not cancel MOMM, canvas or research work owned by the conversation");
  const stopStart = SERVER_SOURCE.indexOf('p === "/api/tools/stop"');
  const stopBody = SERVER_SOURCE.slice(stopStart, resetStart);
  assert.match(stopBody, /reviewJobs\.stop\(sessionId\)/);
  assert.match(stopBody, /stopToolWork\(\{\s*sessionId\s*\}\)/, "Stop cancels MOMM and canvas work owned by the conversation");
  assert.match(stopBody, /expeditions\.cancelSession\(sessionId\)/, "Stop cancels the conversation's research");

  const deliberateStart = SERVER_SOURCE.indexOf('p === "/api/deliberate"');
  const canvasStart = SERVER_SOURCE.indexOf('p === "/api/canvas"');
  const expeditionStart = SERVER_SOURCE.indexOf('p === "/api/expedition"');
  assert.match(SERVER_SOURCE.slice(deliberateStart, canvasStart), /reviewJobs.start/);
  assert.match(SERVER_SOURCE.slice(SERVER_SOURCE.indexOf("async function executeReview"),SERVER_SOURCE.indexOf("const reviewJobs")),/trackToolWork\([^]*kind:\s*"deliberate"/);
  assert.match(SERVER_SOURCE.slice(canvasStart, expeditionStart), /trackToolWork\([^]*kind:\s*"canvas"/);
  assert.match(SERVER_SOURCE.slice(canvasStart, expeditionStart), /if \(visualAction\.cancelled\)[^]*superseded/);

  const shutdownStart = SERVER_SOURCE.indexOf("async function shutdown()");
  const shutdownBody = SERVER_SOURCE.slice(shutdownStart);
  assert.match(shutdownBody, /stopToolWork\(\)/);
  assert.match(shutdownBody, /whenToolWorkEmpty\(\)/);
  assert.ok(shutdownBody.indexOf("await drained") < shutdownBody.indexOf("kb.close()"));
});

test("foreign episodes are excluded from a later Manx model prompt", async () => {
  const kb = new KnowledgeBase(":memory:");
  kb.recordEpisode({
    sessionId: "scoped-history",
    question: "JERSEY-ONLY-CONTEXT",
    resolvedQuestion: "Answer this for Jersey: company law",
    jurisdiction: "Jersey",
    answer: "A Jersey answer.",
    confidence: 0.5,
    status: "model_prior",
  });
  kb.recordEpisode({ sessionId: "scoped-history", question: "all", resolvedQuestion: "MANX-CANONICAL-REQUEST", jurisdiction: "Isle of Man", answer: "MANX-ANSWER", confidence: 0.5, status: "model_prior" });
  kb.recordEpisode({ sessionId: "different-session", question: "OTHER-SESSION-MANX", resolvedQuestion: "OTHER-SESSION-MANX", jurisdiction: "Isle of Man", answer: "Other.", confidence: 0.5, status: "model_prior" });
  kb.recordEpisode({ sessionId: "scoped-history", question: "LEGACY-NULL", answer: "Legacy.", confidence: 0.5, status: "model_prior" });
  for (let i = 0; i < 6; i += 1) kb.recordEpisode({ sessionId: "scoped-history", question: `JERSEY-NEWER-${i}`, resolvedQuestion: `JERSEY-NEWER-${i}`, jurisdiction: "Jersey", answer: "Foreign.", confidence: 0.5, status: "model_prior" });
  const scoped = kb.sessionHistory("scoped-history", 1, { jurisdiction: "Isle of Man" });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].resolved_question, "MANX-CANONICAL-REQUEST");

  let prompt = "";
  const resolution = resolveDialogue("What taxes apply in the Isle of Man?", createDialogueState());
  const result = await answer({
    kb,
    question: resolution.raw,
    resolution,
    sessionId: "scoped-history",
    emit() {},
    runModel: async (options) => {
      prompt = options.prompt;
      options.onDelta('A Manx answer. <<meta>>{"confidence":0.5,"used":[],"status":"model_prior","gaps":[],"expedition":false,"researchable":true,"lateral_hint":""}');
      return { model: "test", costUsd: 0 };
    },
  });
  assert.match(prompt, /MANX-CANONICAL-REQUEST/);
  assert.doesNotMatch(prompt, /JERSEY-ONLY-CONTEXT/);
  assert.doesNotMatch(prompt, /JERSEY-NEWER|LEGACY-NULL|OTHER-SESSION-MANX|User request: all/);
  const stored = kb.getEpisode(result.episodeId);
  assert.equal(stored.jurisdiction, "IM");
  assert.equal(stored.resolved_question, resolution.canonical);
  kb.close();
});

test("untrusted evidence URLs never become anchor hrefs directly", async () => {
  assert.doesNotMatch(APP_SOURCE, /link\.href\s*=\s*s\.url/);
  assert.match(APP_SOURCE, /safeExternalHref\(s\.url\)/);
  assert.match(APP_SOURCE, /safeMapWorkspaceHref\((?:d|action)\.fullHref\)/, "map workspaces use the narrower origin and path allowlist");
  const { safeExternalHref } = await import("../public/policy.mjs");
  assert.equal(safeExternalHref("javascript:alert(1)"), null);
  assert.equal(safeExternalHref("data:text/html,bad"), null);
  assert.equal(safeExternalHref("https://www.gov.im/about"), "https://www.gov.im/about");
});

test("Stop clears conversation resume hooks and stale speech callbacks are generation-guarded", () => {
  const hush = APP_SOURCE.match(/function hush\([^]*?\n {2}\}/)?.[0] || "";
  assert.match(hush, /drainHook\s*=\s*null/);
  assert.match(hush, /wantListening\s*=\s*false/);
  assert.match(hush, /stopListening\(\{discard:\s*true\}\)/);
  assert.match(APP_SOURCE, /speechGeneration/);
});

test("a stream failure is rendered once so its specific error is not overwritten", () => {
  const askBody = APP_SOURCE.slice(APP_SOURCE.indexOf("async function ask("), APP_SOURCE.indexOf("function handle("));
  const streamBody=askBody.slice(askBody.indexOf('const reader ='));
  assert.equal((streamBody.match(/markIncomplete\(/g) || []).length, 1);
});

test("the main answer badge validates status before using it as a CSS class", () => {
  const metaBody = APP_SOURCE.slice(APP_SOURCE.indexOf('else if (event === "meta")'), APP_SOURCE.indexOf('else if (event === "expedition")'));
  assert.match(metaBody, /STATUSES\.includes\(d\.status\)/);
});

test("explicit Go deeper still respects the model's no-research veto", async () => {
  const kb = new KnowledgeBase(":memory:");
  let enqueued = 0;
  const resolution = resolveDialogue("Explain Isle of Man company registration", createDialogueState());
  const result = await answer({
    kb,
    question: resolution.raw,
    resolution,
    sessionId: "model-veto",
    emit() {},
    expeditions: { enqueue() { enqueued += 1; return { queued: true, id: "never" }; } },
    wantExpedition: true,
    runModel: fakeModel({ researchable: false, expedition: false }),
  });
  assert.equal(enqueued, 0);
  assert.equal(result.queued, null);
  assert.equal(decideExpedition({ meta: { researchable: false }, confidence: 0.2, focus: { coverage: "none" }, status: "model_prior", researchable: true }).researchable, false);
  kb.close();
});

test("answer metadata tolerates absent source arrays and model cost", async () => {
  const kb = new KnowledgeBase(":memory:");
  kb.focus = () => ({
    coverage: "strong", coverageRatio: 1, budgetUsed: 20,
    claims: [{ id: "c_missing", status: "verified", trust: 0.9, topic: "Isle of Man ports", text: "Isle of Man ports include Douglas harbour.", sources: null }],
  });
  let meta;
  const resolution = resolveDialogue("What ports does the Isle of Man have?", createDialogueState());
  await answer({
    kb,
    question: resolution.raw,
    resolution,
    sessionId: "missing-fields",
    emit(type, data) { if (type === "meta") meta = data; },
    runModel: fakeModel({ used: ["c_missing"], confidence: 0.8 }, { model: "test" }),
  });
  assert.equal(Number.isFinite(meta.costUsd), true);
  assert.deepEqual(meta.used[0].sources, []);
  kb.close();
});

test("local actions with no speech never append the literal word undefined", async () => {
  const events = [];
  await answer({
    kb: null,
    question: "local action",
    resolution: { route: "action", canonical: "local action", jurisdiction: "Isle of Man", action: { kind: "noop" } },
    sessionId: "local",
    emit(type, data) { events.push({ type, data }); },
  });
  assert.ok(events.filter((event) => event.type === "token" || event.type === "sentence").every((event) => typeof event.data.text === "string"));
});

test("repeated model tags count as one relied-on claim", async () => {
  const kb = new KnowledgeBase(":memory:");
  const claim = { id: "c_once", status: "verified", trust: 0.9, topic: "Isle of Man ports", text: "Isle of Man ports include Douglas harbour.", sources: [] };
  kb.focus = () => ({ coverage: "strong", coverageRatio: 1, budgetUsed: 20, claims: [claim] });
  let touched = null;
  let meta = null;
  kb.touchUsed = (ids) => { touched = ids; };
  const resolution = resolveDialogue("What ports does the Isle of Man have?", createDialogueState());
  await answer({ kb, question: resolution.raw, resolution, sessionId: "dedupe", emit(type, data) { if (type === "meta") meta = data; }, runModel: fakeModel({ used: [claim.id, claim.id], confidence: 0.8 }) });
  assert.deepEqual(touched, [claim.id]);
  assert.equal(meta.used.length, 1);
  kb.close();
});

test("unknown evidence status fails closed and decisions have a consistent shape", () => {
  assert.equal(weakestStatus([{ status: "verified" }, { status: "unknown status" }]), "model_prior");
  const decision = decideExpedition({ meta: {}, confidence: 0.9, focus: { coverage: "strong" }, status: "verified", researchable: true });
  assert.equal(decision.researchable, true);
});

test("legacy gaps explicitly caused by misunderstood speech are not research targets", async () => {
  const { isResearchableGap } = await import("../lib/brain.mjs");
  assert.equal(isResearchableGap({ question: "Many. Is that what you're calling IOM? Well, the monks Oracle.", reason: "gaps: what the user actually meant to ask" }), false);
  assert.equal(isResearchableGap({ question: "What is the current Isle of Man harbour capacity?", reason: "ledger coverage thin" }), true);
});

test("the spend gate evaluates the resolved Manx question, not an ambiguous raw fragment", () => {
  const capital = resolveDialogue("What is the capital?", createDialogueState());
  const topic = resolveDialogue("Manx ports", createDialogueState());
  assert.equal(isResearchable("What is the capital?"), false, "the historic raw microphone fragment remains blocked");
  assert.equal(isResearchable(capital.canonical), true, "the Manx-first resolved question is researchable");
  assert.equal(isResearchable(topic.canonical, { explicit: true }), true, "Go deeper receives the completed canonical subject");
});

test("research buttons use checked JSON requests and weak citations are labelled honestly", () => {
  assert.match(APP_SOURCE, /async function postJson\(/);
  assert.match(APP_SOURCE, /if \(!response\.ok\) throw new Error/);
  assert.match(APP_SOURCE, /Sources consulted; they do not fully support this answer/);
});

test("Go deeper is offered only for a completed Manx answer", () => {
  const metaBody = APP_SOURCE.slice(APP_SOURCE.indexOf('else if (event === "meta")'), APP_SOURCE.indexOf('else if (event === "expedition")'));
  assert.match(metaBody, /d\.jurisdiction\s*===\s*"Isle of Man"[^]*lastResolvedQuestion\s*=\s*d\.resolvedQuestion/);
  assert.match(metaBody, /else\s+lastResolvedQuestion\s*=\s*""/);
});

test("finished research attaches only by its unique expedition id", () => {
  const finishBody = APP_SOURCE.slice(APP_SOURCE.indexOf('es.addEventListener("expedition.finished"'), APP_SOURCE.indexOf("loadBrain();\n  fetch"));
  assert.doesNotMatch(finishBody, /querySelector\("\.q"\)/);
  assert.match(finishBody, /turns\.get\(`expedition:/);
});
