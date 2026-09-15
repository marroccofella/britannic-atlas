// Fail-first contracts from MOMM architecture review
// rev_20260903132605_5tjb. These cover the engine-owned seams; the dialogue,
// browser, and visual modules carry their more detailed cassette/unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answer, decideExpedition } from "../lib/brain.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORACLE = path.resolve(HERE, "..");
const SERVER_SOURCE = fs.readFileSync(path.join(ORACLE, "server.mjs"), "utf8");
const LEARNING_SOURCE = fs.readFileSync(path.join(ORACLE, "lib", "learning.mjs"), "utf8");

function fakeAnswerModel(meta = {}) {
  return async ({ onDelta }) => {
    onDelta(`A careful Manx answer. <<meta>>${JSON.stringify({
      confidence: 0.35,
      used: [],
      status: "model_prior",
      gaps: ["the latest official figure"],
      expedition: true,
      researchable: true,
      lateral_hint: "",
      ...meta,
    })}`);
    return { costUsd: 0, model: "fixture" };
  };
}

test("model expedition flag is advisory for a strong supported answer", () => {
  const decision = decideExpedition({
    meta: { expedition: true, gaps: ["optional history"] },
    confidence: 0.9,
    focus: { coverage: "strong" },
    status: "verified",
    researchable: true,
  });
  assert.equal(decision.needed, false);
});

test("an ordinary weak answer offers research but cannot spend without consent", async () => {
  const kb = new KnowledgeBase(":memory:");
  let enqueued = 0;
  const events = [];
  const result = await answer({
    kb,
    question: "What is the latest official resident population of the Isle of Man?",
    sessionId: "consent",
    emit: (type, data) => events.push({ type, data }),
    expeditions: { enqueue() { enqueued += 1; return { queued: true, id: "x_bad" }; } },
    root: ORACLE,
    runModel: fakeAnswerModel(),
  });
  assert.equal(enqueued, 0);
  assert.equal(kb.openGaps().length, 0);
  assert.equal(result.researchOffered, true);
  assert.equal(events.some((e) => e.type === "expedition"), false);
  kb.close();
});

test("a refused expedition admission never creates a gap", async () => {
  const kb = new KnowledgeBase(":memory:");
  const result = await answer({
    kb,
    question: "What is the latest official resident population of the Isle of Man?",
    sessionId: "budget",
    emit() {},
    expeditions: { enqueue() { return { queued: false, reason: "hourly budget spent" }; } },
    root: ORACLE,
    wantExpedition: true,
    runModel: fakeAnswerModel(),
  });
  assert.equal(result.queued?.queued, false);
  assert.equal(kb.openGaps().length, 0);
  kb.close();
});

test("ordinary retrieval excludes unsupported and contested hypotheses", () => {
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "A speculative Isle of Man harbour anomaly with no supporting evidence.", topic: "Isle of Man harbour", kind: "lateral", sources: [], support: 0 });
  kb.upsertClaim({ text: "The Isle of Man Government administers Manx harbours.", topic: "Isle of Man harbour", kind: "learned", sources: [{ url: "https://www.gov.im/harbours" }], support: 2 });
  const rows = kb.search("Isle of Man harbour", { jurisdiction: "Isle of Man" });
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((claim) => ["verified", "corroborated", "single_source"].includes(claim.status)));
  kb.close();
});

test("Recently learned is a promoted-evidence view, never a hypothesis feed", () => {
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "An unsupported Manx brass-plate theory that must remain private.", topic: "Isle of Man", kind: "lateral", sources: [], support: 0 });
  kb.upsertClaim({ text: "A sourced Isle of Man administrative fact suitable for display.", topic: "Isle of Man", kind: "learned", sources: [{ url: "https://www.gov.im/about-the-government", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }, { url: "https://tynwald.org.im/about", verification: { status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z" } }], support: 2 });
  const rows = kb.recentLearned(10, { jurisdiction: "Isle of Man" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "verified");
  kb.close();
});

test("unsupported lateral hypotheses are neither persisted nor emitted verbatim", () => {
  assert.doesNotMatch(LEARNING_SOURCE, /hypotheses:\s*hypotheses\.map/);
  assert.doesNotMatch(LEARNING_SOURCE, /if \(!v\) \{\s*findings\.push\(\{ claim: h\.hypothesis/);
});

test("server owns MOMM episode hydration and rejects local capability episodes", () => {
  assert.match(SERVER_SOURCE, /POST[^\n]*\/api\/deliberate|p === "\/api\/deliberate"/);
  assert.match(SERVER_SOURCE, /kb\.getEpisode\(/);
  assert.match(SERVER_SOURCE, /status\s*===\s*["']local["']|eligibleForDeliberation/);
  assert.doesNotMatch(SERVER_SOURCE, /body\.(?:answer|replacementAnswer|spec)/);
});

test("canvas requests are server-derived and share bounded MOMM admission", () => {
  assert.match(SERVER_SOURCE, /p === "\/api\/canvas"/);
  assert.match(SERVER_SOURCE, /mommAdmission|MommAdmission|mommAllowance/);
  assert.doesNotMatch(SERVER_SOURCE, /body\.spec/);
});

test("explicit research creates a gap only after successful admission", () => {
  const expeditionBlock = SERVER_SOURCE.slice(SERVER_SOURCE.indexOf('p === "/api/expedition"'), SERVER_SOURCE.indexOf('p === "/api/dream"'));
  const enqueueAt = expeditionBlock.indexOf("expeditions.enqueue");
  const gapAt = expeditionBlock.indexOf("kb.addGap");
  assert.ok(enqueueAt >= 0 && gapAt > enqueueAt, "queue admission must happen before gap persistence");
});
