// The user builds the Manx ledger by talking to Mannin. "Learn about X" must
// queue the full research pass on a named subject without a second prompt,
// "how well do you know X" must answer from the ledger for free and say what
// to build next, and an ordinary "what do you know about X" must stay an
// ordinary question.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { interactionCommand } from "../lib/interaction-policy.mjs";
import { resolveDialogue, createDialogueState } from "../lib/dialogue.mjs";
import { isResearchable } from "../lib/brain.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";
import { knowledgeMap, buildOutQuestion } from "../lib/knowledge-map.mjs";

test("build-out and knowledge-map phrasings are parsed; negations and ordinary questions are not", () => {
  const cases = [
    ["learn about the TT races", { kind: "learn", subject: "the TT races" }],
    ["Learn more about Manx planning appeals.", { kind: "learn", subject: "Manx planning appeals" }],
    ["build out the knowledge base on Manx housing", { kind: "learn", subject: "Manx housing" }],
    ["build out housing", { kind: "learn", subject: "housing" }],
    ["add Manx ferry timetables to the ledger", { kind: "learn", subject: "Manx ferry timetables" }],
    ["teach yourself about Tynwald Day", { kind: "learn", subject: "Tynwald Day" }],
    ["expand your knowledge on Manx Gaelic", { kind: "learn", subject: "Manx Gaelic" }],
    ["can you learn about the Manx cat", { kind: "learn", subject: "the Manx cat" }],
    ["how well do you know the TT races?", { kind: "knowledge_map", subject: "the TT races" }],
    ["what do you have on ferries", { kind: "knowledge_map", subject: "ferries" }],
    ["where are the gaps", { kind: "knowledge_map", subject: null }],
    ["how big is your knowledge base?", { kind: "knowledge_map", subject: null }],
    ["what's missing from the ledger on housing", { kind: "knowledge_map", subject: "housing" }],
    ["knowledge map for planning", { kind: "knowledge_map", subject: "planning" }],
  ];
  for (const [raw, expected] of cases) assert.deepEqual(interactionCommand(raw), expected, raw);
  for (const raw of ["don't learn about the TT races", "never add that to the ledger", "add a chart", "what do you know about the TT races?", "learn", "add the TT to my calendar"]) {
    const command = interactionCommand(raw);
    assert.ok(!command || !["learn", "knowledge_map"].includes(command.kind), raw);
  }
});

test("'learn about X' queues the full research pass on a brief the spend gate accepts", () => {
  const turn = resolveDialogue("learn about the TT races", createDialogueState());
  assert.equal(turn.route, "research");
  assert.equal(turn.intent, "learn");
  assert.equal(turn.researchMode, "deep");
  assert.deepEqual(turn.strategies, ["research", "adversarial", "cross_model", "lateral"]);
  assert.equal(turn.canonical, buildOutQuestion("the TT races"));
  assert.ok(isResearchable(turn.canonical, { explicit: true }), "a bare subject would have been refused as unfinished; the brief is not");
  assert.equal(turn.pendingAction.kind, "research");
  assert.equal(turn.pendingAction.label, "the TT races");
  assert.match(turn.speech, /build out the ledger on the TT races/);
  assert.match(turn.speech, /Only sourced findings are stored/);
  assert.equal(turn.jurisdiction, "Isle of Man");
});

test("a low-confidence spoken 'learn' asks for confirmation before any spend, and a referential one binds to the last subject", () => {
  const spoken = resolveDialogue("learn about the TT races", createDialogueState(), { source: "speech", recognitionConfidence: 0.4 });
  assert.notEqual(spoken.route, "research");
  const state = { ...createDialogueState(), lastAnswerSubject: "Manx income tax personal allowance", lastAnswerJurisdiction: "Isle of Man" };
  const bound = resolveDialogue("learn more about that", state);
  assert.equal(bound.route, "research");
  assert.equal(bound.pendingAction.label, "Manx income tax personal allowance");
  const nothing = resolveDialogue("learn more about that", createDialogueState());
  assert.equal(nothing.route, "clarify");
  assert.match(nothing.speech, /Which public factual subject/);
});

test("knowledge-map phrasings route locally and 'what do you know about' stays an ordinary answer", () => {
  const map = resolveDialogue("how well do you know the TT races?", createDialogueState());
  assert.equal(map.route, "knowledge_map");
  assert.equal(map.subject, "the TT races");
  assert.equal(map.conversationMeta, true);
  assert.equal(resolveDialogue("how big is your knowledge base", createDialogueState()).subject, null);
  assert.equal(resolveDialogue("what do you know about the TT races?", createDialogueState()).route, "answer");
});

function ledger() {
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "The Steam Packet ferry sails between Douglas and Heysham throughout the year.", topic: "Isle of Man ferries", jurisdiction: "IM", kind: "learned", sources: [{ url: "https://www.gov.im/ferries", publisher: "Isle of Man Government", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }, { url: "https://www.steam-packet.com/timetable", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }], support: 2 });
  kb.upsertClaim({ text: "A winter ferry timetable reduces the Liverpool sailings.", topic: "Isle of Man ferries", jurisdiction: "IM", kind: "learned", sources: [{ url: "https://www.steam-packet.com/winter" }] });
  kb.upsertClaim({ text: "The House of Keys dissolves ahead of a general election.", topic: "Isle of Man elections", jurisdiction: "IM", kind: "seed", status: "verified", support: 2, sources: [{ url: "https://www.tynwald.org.im/elections", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }, { url: "https://www.gov.im/elections", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }] });
  kb.upsertClaim({ text: "A retracted fixture claim about ferries that must not be counted.", topic: "Isle of Man ferries", jurisdiction: "IM", status: "retracted" });
  kb.addGap("How often do the ferries run in winter?", "requested", { jurisdiction: "Isle of Man" });
  kb.addGap("What is the Manx word for rainbow?", "requested", { jurisdiction: "Isle of Man" });
  return kb;
}

test("a subject map counts live claims by status and sourcing, names a touching gap, and says how to build it out", (t) => {
  const kb = ledger(); t.after(() => kb.close());
  const map = knowledgeMap(kb, "ferries");
  assert.equal(map.summary.claims, 2, "the retracted claim is not counted");
  assert.deepEqual(map.summary.byStatus, { verified: 1, single_source: 1 });
  assert.equal(map.summary.official, 1);
  assert.deepEqual(map.summary.gaps, ["How often do the ferries run in winter?"]);
  assert.match(map.speech, /2 claims in the Manx ledger: 1 verified, 1 single-source/);
  assert.match(map.speech, /1 open gap touches it/);
  assert.match(map.speech, /say “learn about ferries”/);
  const empty = knowledgeMap(kb, "lighthouses");
  assert.equal(empty.summary.claims, 0);
  assert.match(empty.speech, /no keyword matches for lighthouses/);
  assert.match(empty.speech, /learn about lighthouses/);
});

test("the whole-ledger map speaks size, sourcing, growth, gaps and index coverage", (t) => {
  const kb = ledger(); t.after(() => kb.close());
  const overview = kb.ledgerOverview({ jurisdiction: "Isle of Man" });
  assert.equal(overview.live, 3); assert.equal(overview.topics, 2); assert.equal(overview.recent, 3); assert.equal(overview.official, 2); assert.equal(overview.gapsOpen, 2);
  assert.deepEqual(kb.topicSummary({ jurisdiction: "Isle of Man" }).map((r) => [r.topic, r.n, r.verified]), [["Isle of Man ferries", 2, 1], ["Isle of Man elections", 1, 1]]);
  const map = knowledgeMap(kb, null, { retrieval: { ledger: { indexable: 3, indexed: 2, missing: 1, stale: 0 } } });
  assert.match(map.speech, /3 live claims across 2 topics: 2 verified, 1 single-source/);
  assert.match(map.speech, /2 cite primary sources/);
  assert.match(map.speech, /3 claims were added in the last 7 days, and 2 gaps are open/);
  assert.match(map.speech, /semantic index covers 2 of 3 sourced claims/);
  assert.match(map.speech, /say “learn about” and a subject/);
  assert.equal(knowledgeMap(kb, null).speech.includes("semantic index"), false, "no index, no claim about one");
});

const root = fileURLToPath(new URL("../../", import.meta.url));
async function freePort() { const s = createServer(); s.listen(0, "127.0.0.1"); await once(s, "listening"); const port = s.address().port; await new Promise((resolve) => s.close(resolve)); return port; }

test("over HTTP a knowledge map is answered without a model and 'learn about' reaches the expedition queue", { timeout: 40000 }, async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "oracle-knowledge-build-")); let child;
  t.after(async () => { if (child && child.exitCode === null) { const stopped = once(child, "exit"); child.kill(); await stopped; } rmSync(directory, { recursive: true, force: true }); });
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "oracle/server.mjs"], { cwd: root, env: { ...process.env, ORACLE_DB: path.join(directory, "test.db"), ORACLE_PORT: String(port), ORACLE_EXPEDITIONS: "off" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { let output = ""; const timer = setTimeout(() => reject(new Error("Oracle startup timed out: " + output)), 20000);
    child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("[oracle] listening")) { clearTimeout(timer); resolve(); } });
    child.stderr.on("data", (chunk) => { output += chunk; }); child.once("error", (error) => { clearTimeout(timer); reject(error); }); child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Oracle stopped (${code}): ${output}`)); }); });
  const post = (url, body) => fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const session = (await (await post("/api/conversations", {})).json()).conversation.id;
  const map = await (await post("/api/ask", { sessionId: session, requestId: "r_map", clientTurn: 1, question: "how big is your knowledge base?", source: "typed" })).text();
  assert.match(map, /The Manx ledger holds \d+ live claims across \d+ topics/);
  assert.match(map, /"mode":"conversation"/);
  assert.match(map, /"costUsd":0/);
  const learn = await (await post("/api/ask", { sessionId: session, requestId: "r_learn", clientTurn: 2, question: "learn about the TT races", source: "typed" })).text();
  assert.match(learn, /expeditions disabled/, "the request reached the expedition queue, which this test keeps switched off");
  assert.doesNotMatch(learn, /"costUsd":0\.0[1-9]/, "no model call was made");
  const brain = await (await fetch(base + "/api/brain")).json();
  assert.ok(brain.overview.live > 0); assert.ok(Array.isArray(brain.topics));
});
