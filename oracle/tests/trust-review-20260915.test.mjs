// Defects found by the 15 September 2026 trust review, each reproduced from
// the transcript or data that exposed it. The suite was green while users
// reported refusals, mis-directed paid research, false states and a ledger
// that could not be trusted; these pin the behaviour that was actually wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDialogue, createDialogueState } from "../lib/dialogue.mjs";
import { interactionCommand, clockQuestion } from "../lib/interaction-policy.mjs";
import { answer } from "../lib/brain.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";
import { entailmentCheck, boundStatusByEntailment } from "../lib/entailment.mjs";
import { persistPublicEvidence, sourceExcerptSeal } from "../lib/evidence-ledger.mjs";
import { ConversationStore } from "../lib/conversations.mjs";
import { reviewTarget } from "../lib/review-target.mjs";
import { conversationRepairQuestion } from "../public/conversation-policy.mjs";
import { reasoningRequest } from "../public/reasoning-check.mjs";
import { META_MARKER } from "../lib/segmenter.mjs";
import { isManxPlaceText } from "../lib/scope.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fresh = () => createDialogueState();
const afterAnswer = (question = "What is Tynwald?") => {
  const turn = resolveDialogue(question, fresh(), { turnId: "t1", clientTurn: 1 });
  return { ...turn.state, lastCompletedKey: turn.semanticKey, lastAnswerSubject: turn.canonical, lastAnswerJurisdiction: "Isle of Man" };
};

test("a named subject after research, look into or dig into is the subject researched, not the previous one", () => {
  const state = afterAnswer();
  for (const raw of ["Research the Manx Grand Prix", "Look into the Steam Packet's finances", "Can you dig into the TT races please"]) {
    const turn = resolveDialogue(raw, state);
    assert.equal(turn.route, "research", raw);
    assert.doesNotMatch(turn.canonical, /tynwald/i, raw);
  }
  assert.match(resolveDialogue("Research the Manx Grand Prix", state).canonical, /Manx Grand Prix/);
  const deep = resolveDialogue("Go deeper on the TT races", fresh());
  assert.equal(deep.route, "research");
  assert.equal(deep.researchMode, "deep");
  assert.match(deep.canonical, /TT races/);
  assert.notEqual(resolveDialogue("Research the Manx Grand Prix", fresh()).route, "clarify", "the subject was in the sentence");
  assert.deepEqual(interactionCommand("research that"), null, "a referential research request still binds to the pending offer");
});

test("questions about Manx Utilities are answered as asked, not replaced by the infrastructure overview", () => {
  for (const raw of ["Who runs Manx Utilities?", "How much does Manx Utilities charge per unit of electricity?", "What is the Manx Utilities Authority?"]) {
    const turn = resolveDialogue(raw, fresh());
    assert.equal(turn.route, "answer", raw);
    assert.doesNotMatch(turn.canonical, /covering ports/, raw);
    assert.match(turn.canonical, /manx utilities/i, raw);
  }
  assert.match(resolveDialogue("Tell me about the infrastructure", fresh()).canonical, /covering ports|infrastructure/i, "a broad request still gets the overview");
});

test("homonyms and Manx place names do not send a question abroad", () => {
  const manx = ["Where can I buy a TT jersey in Douglas?", "Are Jersey cows farmed on the Island?", "Is there an Iceland supermarket in Douglas?", "Did the Prince of Wales open the new Douglas promenade?", "Is turkey served at the Tynwald Day feast?", "Is Manx bone china still made in Peel?"];
  for (const raw of manx) assert.equal(resolveDialogue(raw, fresh()).jurisdiction, "Isle of Man", raw);
  const crossBorder = ["How do I get to the Island from the UK?", "Which ferries run from Douglas to Ireland?", "Is Douglas bigger than Monaco?", "Is Peel in England?"];
  for (const raw of crossBorder) assert.match(resolveDialogue(raw, fresh()).jurisdiction, /^Isle of Man and /, raw);
  assert.equal(resolveDialogue("What is the corporation tax rate in Jersey?", fresh()).jurisdiction, "Jersey", "a real Jersey question still goes to Jersey");
  assert.match(resolveDialogue("How does Guernsey tax compare with Jersey?", fresh()).jurisdiction, /^(?:Guernsey|Jersey)$/);
  assert.ok(isManxPlaceText("the harbour at Port St Mary"));
});

test("a short new subject after Mannin asked a question is a new subject, not the reply", () => {
  const state = { ...afterAnswer(), pendingQuestion: "Would you like the 2024 figures?", pendingQuestionSubject: "What is Tynwald?" };
  const fresh_ = resolveDialogue("Manx cat colours", state);
  assert.doesNotMatch(fresh_.canonical, /answers your question/);
  assert.match(fresh_.canonical, /Manx cat colours/);
  assert.match(resolveDialogue("2024 figures", state).canonical, /answers your question/);
  assert.match(resolveDialogue("yes please", state).canonical, /answers your question/);
});

test("every spoken route into paid research is read back first when recognition is doubtful or unmeasured", () => {
  const state = { ...afterAnswer(), pendingAction: { kind: "research", subject: "What is Tynwald?", status: "offered", jurisdiction: "Isle of Man", origin: { kind: "turn", semanticKey: afterAnswer().lastCompletedKey, turnId: "t1", clientTurn: 1 } } };
  for (const raw of ["go deeper", "research that", "yes", "Research the Manx Grand Prix"]) {
    assert.equal(resolveDialogue(raw, state, { source: "speech", recognitionConfidence: 0.5 }).route, "clarify", `${raw} at 0.5`);
    assert.equal(resolveDialogue(raw, state, { source: "speech" }).route, "clarify", `${raw} with no confidence`);
  }
  assert.equal(resolveDialogue("Research the Manx Grand Prix", state, { source: "speech", recognitionConfidence: 0.9 }).route, "research");
  assert.equal(resolveDialogue("Research the Manx Grand Prix", state, { source: "speech", recognitionConfidence: 0.5, confirmed: true }).route, "research");
});

test("'based on our conversation' followed by a factual question is a factual question", () => {
  assert.equal(conversationRepairQuestion("Based on our conversation, what is the population of Douglas?"), false);
  assert.equal(conversationRepairQuestion("Based on our conversation, do you think you are doing a good job?"), true);
  const turn = resolveDialogue("Based on our conversation, what is the population of Douglas?", fresh());
  assert.ok(!turn.conversationMeta, "not a self-assessment");
  assert.match(turn.canonical, /Isle of Man/);
});

test("bare Manx subjects are answered, typed or spoken", () => {
  assert.equal(resolveDialogue("Tynwald", fresh()).route, "answer");
  assert.match(resolveDialogue("Peel?", fresh()).canonical, /Tell me about Peel/);
  assert.equal(resolveDialogue("Tynwald Day", fresh(), { source: "speech", recognitionConfidence: 0.9 }).route, "answer");
  assert.equal(resolveDialogue("population of Douglas", fresh(), { source: "speech", recognitionConfidence: 0.9 }).route, "answer");
  assert.equal(resolveDialogue("The Manx parliament is called Tynwald, right", fresh(), { source: "speech", recognitionConfidence: 0.9 }).route, "answer");
});

test("'find opportunities to invest' is a question, not a Socratic assessment", () => {
  assert.equal(reasoningRequest("Where can I find opportunities to invest on the Isle of Man?"), null);
  assert.ok(reasoningRequest("Assess the weaknesses in this plan: open a hotel in Peel"), "an explicit assessment still is one");
});

test("small directives: read back, official sources, negated instructions, politeness, timelines, clock reads, knowledge-base membership", () => {
  assert.equal(interactionCommand("Read it back to me").kind, "readback");
  assert.equal(interactionCommand("Check the official sources").official, true);
  assert.deepEqual(interactionCommand("Search the web for Tynwald and don't use MOMM"), { kind: "search", subject: "Tynwald", official: false, live: true });
  assert.equal(interactionCommand("Can you search for Manx cats please").subject, "Manx cats");
  assert.deepEqual(interactionCommand("Is Tynwald in your knowledge base?"), { kind: "knowledge_map", subject: "Tynwald" });
  assert.equal(resolveDialogue("Is Tynwald in your knowledge base?", fresh()).route, "knowledge_map");
  assert.equal(resolveDialogue("Can you give me a timeline of the TT races?", fresh()).route, "answer", "a spoken chronology, not a paid canvas");
  assert.equal(resolveDialogue("Draw me a timeline of the TT races", fresh()).route, "visual");
  for (const raw of ["What time is it?", "What's the date today?", "what day is it today"]) assert.ok(clockQuestion(raw), raw);
  assert.equal(resolveDialogue("What time is it?", fresh()).intent, "clock");
  const echo = resolveDialogue("Isle of Man", afterAnswer());
  assert.doesNotMatch(echo.canonical, /Continue the earlier request/);
});

test("the weather route survives an unreadable official page and reports its real duration", async (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  const events = {};
  await answer({ kb, question: "what's the weather", resolution: resolveDialogue("what's the weather", fresh()), sessionId: "s", emit(type, data) { events[type] = data; },
    weatherReader: async () => ({ ok: false, page: { href: "https://www.gov.im/weather" }, reason: "timed out", text: "I could not read the official forecast just now." }) });
  assert.equal(events.meta.weather.ok, false);
  assert.equal(events.meta.nextSteps[0].kind, "open_page");
  assert.ok(Number.isFinite(events.meta.durationMs));
});

test("a failed lookup for a stable fact still gets an answer; only live reads refuse outright", async (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  let modelCalls = 0;
  const runModel = async ({ onDelta }) => { modelCalls++; onDelta("The Chief Minister is named by the House of Keys after each general election. " + META_MARKER + JSON.stringify({ used: [], confidence: 0.4, expedition: false })); return { costUsd: 0.01, model: "fixture" }; };
  const liveTools = async () => ({ claims: [], calls: [{ name: "plan_lookup", status: "unavailable", code: "lookup_allowance", reason: "The lookup allowance for this hour is used up." }], costUsd: 0 });
  const events = {};
  await answer({ kb, question: "How is the Chief Minister chosen?", sessionId: "s", emit(type, data) { events[type] = data; }, runModel, liveTools });
  assert.equal(modelCalls, 1, "the model was asked");
  assert.notEqual(events.meta.answerOutcome, "source_unavailable");
  assert.ok(events.meta.answered);
  const current = {};
  modelCalls = 0;
  await answer({ kb, question: "Who is the current Chief Minister?", sessionId: "s", emit(type, data) { current[type] = data; }, runModel, liveTools });
  assert.equal(modelCalls, 0, "a question about the present is not guessed when its lookup failed");
  assert.equal(current.meta.answerOutcome, "source_unavailable");
  const live = {};
  modelCalls = 0;
  await answer({ kb, question: "What's the weather in Peel right now?", sessionId: "s", emit(type, data) { live[type] = data; }, runModel,
    liveTools: async () => ({ claims: [], calls: [{ name: "get_town_weather", status: "unavailable", reason: "timed out" }], costUsd: 0 }) });
  assert.equal(modelCalls, 0, "a failed live read is not guessed");
  assert.equal(live.meta.answerOutcome, "source_unavailable");
});

test("a bound follow-up reuses expedition findings only while the ledger still stands behind them", async (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  const claim = kb.upsertClaim({ text: "The fixture ferry sails from Douglas to Heysham throughout the year.", topic: "ferries", jurisdiction: "IM", kind: "learned", sources: [{ url: "https://www.gov.im/categories/ferries/" }], support: 1, provenance: { expedition: "x_fixture" } }).claim;
  const id = kb.startExpedition({ question: "Fixture ferries?", reason: "test", strategies: ["research"], jurisdiction: "Isle of Man", sessionId: "s" });
  kb.finishExpedition(id, { status: "done", learned: [{ id: claim.id, text: claim.text, status: "single_source", sources: [{ url: "https://www.gov.im/categories/ferries/" }] }], costUsd: 0.1 });
  const seen = [];
  const run = async () => { const events = {}; await answer({ kb, question: "and in winter?", resolution: { route: "answer", raw: "and in winter?", canonical: "Fixture ferries in winter?", jurisdiction: "Isle of Man", researchResultId: id }, sessionId: "s", emit(type, data) { events[type] = data; },
    runModel: async ({ prompt, onDelta }) => { seen.push(prompt); onDelta("Fixture. " + META_MARKER + JSON.stringify({ used: [], confidence: 0.4 })); return { costUsd: 0, model: "fixture" }; } }); return events; };
  await run();
  assert.match(seen[0], /Douglas to Heysham/, "the finding is offered while it stands");
  kb.upsertClaim({ text: claim.text, status: "retracted", support: 0 });
  await run();
  assert.doesNotMatch(seen[1], /Douglas to Heysham/, "a retracted finding is not evidence any more");
});

test("the entailment gate sees a denial, and does not confuse Castletown with Castle Rushen", () => {
  const evidence = [{ text: "Douglas is the capital of the Isle of Man.", topic: "capital" }];
  const denied = entailmentCheck({ answer: "Douglas is not the capital of the Isle of Man.", claims: evidence });
  assert.notEqual(denied.verdict, "entailed");
  assert.equal(boundStatusByEntailment("verified", denied), "single_source");
  assert.equal(entailmentCheck({ answer: "Douglas is the capital of the Isle of Man.", claims: evidence }).verdict, "entailed");
  const negatedEvidence = [{ text: "The Isle of Man is not part of the United Kingdom.", topic: "status" }];
  assert.equal(entailmentCheck({ answer: "The Isle of Man is not part of the United Kingdom.", claims: negatedEvidence }).verdict, "entailed");
  const rushen = entailmentCheck({ answer: "Castletown was the ancient capital.", claims: [{ text: "Castle Rushen stands in the south of the Island.", topic: "castles" }] });
  assert.ok(rushen.unsupported.includes("Castletown"), JSON.stringify(rushen));
});

test("the verification date moves only with fresh evidence, and expired excerpts leave search, counts and the map", (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  const seed = kb.upsertClaim({ text: "The fixture House of Keys dissolves ahead of a general election.", topic: "elections", jurisdiction: "IM", kind: "seed", support: 2, sources: [{ url: "https://www.tynwald.org.im/x", primary: true }], verifiedAt: "2026-08-23T00:00:00.000Z", provenance: { origin: "britannica-atlas", editorial: true } }).claim;
  assert.equal(seed.verified_at, "2026-08-23T00:00:00.000Z");
  const refreshed = kb.upsertClaim({ text: seed.text, topic: "elections", kind: "seed", support: 0, sources: [{ url: "https://www.tynwald.org.im/x", primary: true }], evidenceKey: "seed:99", verifiedAt: "2026-09-12T00:00:00.000Z" }).claim;
  assert.equal(refreshed.verified_at, "2026-09-12T00:00:00.000Z", "a re-seed carries the corpus review date");
  const merged = kb.upsertClaim({ text: seed.text, sources: [{ url: "https://www.gov.im/y" }], support: 0, evidenceKey: "nothing-new" }).claim;
  assert.equal(merged.verified_at, "2026-09-12T00:00:00.000Z", "a merge without new support does not reset the date");

  const stale = reading(kb, "Fixture weather reading for Douglas: 14 degrees at six o'clock.", new Date(Date.now() - 60_000).toISOString());
  assert.equal(stale.stored, 1);
  const row = kb.getClaim(stale.ids[0]);
  kb.db.prepare("UPDATE claims SET provenance=? WHERE id=?").run(JSON.stringify({ ...row.provenance, sourceEvidence: { ...row.provenance.sourceEvidence, expiresAt: "2000-01-01T00:00:00.000Z" } }), row.id);
  assert.deepEqual(kb.search("Douglas weather reading degrees", { jurisdiction: "IM" }), [], "an expired reading is not evidence");
  assert.equal(kb.ledgerOverview({ jurisdiction: "Isle of Man" }).live, 1, "the seed only");
  const current = reading(kb, "Fixture weather reading for Douglas: 15 degrees at seven o'clock.", new Date().toISOString());
  assert.deepEqual(kb.search("Douglas weather reading degrees", { jurisdiction: "IM" }).map((c) => c.id), current.ids);
  assert.equal(kb.ledgerOverview({ jurisdiction: "Isle of Man" }).live, 2, "the seed and one current excerpt");
});

// A sealed live reading, the way the weather tools persist one.
function reading(kb, text, fetchedAt) {
  const claim = { text, topic: "Douglas weather", evidenceKind: "source_excerpt", fetchedAt, publishedAt: fetchedAt, sources: [{ url: "https://www.gov.im/weather/douglas", title: "Fixture forecast" }] };
  return persistPublicEvidence(kb, { calls: [{ name: "get_town_weather", status: "complete", url: claim.sources[0].url, fetchedAt, publishedAt: fetchedAt, evidenceSeals: [sourceExcerptSeal(claim)] }], claims: [claim] }, { question: "weather in Douglas" });
}

test("a fresh live reading of the same page retires the previous one", (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  const first = reading(kb, "Douglas is 14 degrees with light rain at 06:00 on 15 September 2026.", new Date(Date.now() - 60_000).toISOString());
  const second = reading(kb, "Douglas is 15 degrees and dry at 06:01 on 15 September 2026.", new Date().toISOString());
  assert.equal(first.stored, 1); assert.equal(second.stored, 1);
  assert.equal(second.superseded, 1, "the earlier reading is superseded");
  const ids = kb.search("Douglas degrees", { jurisdiction: "IM" }).map((c) => c.id);
  assert.deepEqual(ids, second.ids, "only the current reading is evidence");
});

test("'use MOMM' with no completed answer says so instead of buying a review of a clarification", (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  const store = new ConversationStore(kb.db);
  store.start({ id: "t1", sessionId: "s", question: "Show me a mao", resolution: { route: "clarify", jurisdiction: "Isle of Man" } });
  store.finish("t1", { answer: "Did you mean the map?", metadata: { meta: { conversationMeta: true } } });
  const target = reviewTarget(kb, "s", {});
  assert.equal(target.key, undefined);
  assert.match(target.reason, /no completed answer to review/);
});

test("client and server guards: Escape in a field, stats rendered as text, host validation, claims limit", () => {
  const app = fs.readFileSync(path.join(HERE, "..", "public", "app.js"), "utf8");
  assert.doesNotMatch(app, /\$\("#stats"\)\.innerHTML/);
  assert.match(app, /e\.code === "Escape" && !isEditableTarget\(e\.target\)/);
  assert.match(app, /queued search was cancelled/);
  assert.match(app, /\['cancelled','interrupted'\]\.includes\(record\.status\)\?'stopped'/);
  const server = fs.readFileSync(path.join(HERE, "..", "server.mjs"), "utf8");
  assert.match(server, /function hostAllowed/);
  assert.match(server, /boundedPositiveInt\(url\.searchParams\.get\("limit"\) \?\? 20, 20, \{ max: 100 \}\)/);
  assert.doesNotMatch(server.slice(server.indexOf('p === "/api/session/reset"'), server.indexOf('p === "/api/session/reset"') + 900), /expeditions\.cancelSession|reviewJobs\.stop/, "leaving a conversation does not cancel paid work");
});
