import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

import { Bus, attachBus } from "../lib/bus.mjs";
import { DialogueSessions, createDialogueState } from "../lib/dialogue.mjs";
import {
  ExpeditionQueue,
  buildResearchPreview,
  classifyResearchOutcome,
  isOfficialManxSource,
  runExpedition,
} from "../lib/learning.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = readFileSync(path.join(ORACLE, "server.mjs"), "utf8");

function queueKb() {
  const queued = [];
  const finished = [];
  const progress = [];
  let next = 0;
  return {
    queued, finished, progress,
    expeditionsSince: () => 0,
    queueExpedition(input) { queued.push(input); return `x_${++next}`; },
    beginExpedition: () => true,
    finishExpedition(id, patch) { finished.push({ id, ...patch }); },
    updateExpeditionProgress(id, patch) { progress.push({ id, ...patch }); },
  };
}

test("source confirmation is a session-owned research-only job while deep keeps all four strategies", () => {
  const kb = queueKb();
  const events = [];
  const queue = new ExpeditionQueue({ kb, bus: { publish: (type, data) => events.push({ type, data }) }, root: ORACLE });
  queue.pump = async () => {};

  const quick = queue.enqueue({ sessionId: "s_quick", question: "Check the current Manx population", reason: "confirmed", mode: "official_sources", strategies: ["research", "adversarial"] });
  const deep = queue.enqueue({ sessionId: "s_deep", question: "Investigate Manx port resilience", reason: "deep", mode: "deep", strategies: ["research", "adversarial", "cross_model", "lateral"] });

  assert.equal(quick.mode, "official_sources");
  assert.deepEqual(kb.queued[0].strategies, ["research"]);
  assert.equal(kb.queued[0].sessionId, "s_quick");
  assert.equal(kb.queued[0].mode, "official_sources");
  assert.deepEqual(kb.queued[1].strategies, ["research", "adversarial", "cross_model", "lateral"]);
  assert.equal(deep.mode, "deep");
  assert.equal(events[0].data.sessionId, "s_quick");
  assert.equal(Object.hasOwn(queue.status().queued[0], "sessionId"), false, "health status must not disclose session ownership");
});

test("de-duplication keeps quick and deep research distinct but collapses same-mode repeats", () => {
  const kb = queueKb();
  const queue = new ExpeditionQueue({ kb, bus: { publish() {} }, root: ORACLE });
  queue.pump = async () => {};

  const quick = queue.enqueue({ sessionId: "s_modes", question: "Check the Manx flag", reason: "source check", mode: "official_sources" });
  const quickAgain = queue.enqueue({ sessionId: "s_modes", question: "Check the Manx flag", reason: "source check", mode: "official_sources" });
  const deep = queue.enqueue({ sessionId: "s_modes", question: "Check the Manx flag", reason: "think harder", mode: "deep" });
  const deepAgain = queue.enqueue({ sessionId: "s_modes", question: "Check the Manx flag", reason: "think harder", mode: "deep" });

  assert.equal(quick.queued, true);
  assert.deepEqual({ queued: quickAgain.queued, alreadyRunning: quickAgain.alreadyRunning, id: quickAgain.id }, { queued: false, alreadyRunning: true, id: quick.id });
  assert.equal(deep.queued, true, "a deep review must not be swallowed by the quick source check");
  assert.notEqual(deep.id, quick.id);
  assert.deepEqual({ queued: deepAgain.queued, alreadyRunning: deepAgain.alreadyRunning, id: deepAgain.id }, { queued: false, alreadyRunning: true, id: deep.id });
  assert.deepEqual(kb.queued.map((job) => job.mode), ["official_sources", "deep"]);
});

test("case- and space-distinct session owners never share a de-duplicated research job", () => {
  const kb = queueKb();
  const queue = new ExpeditionQueue({ kb, bus: { publish() {} }, root: ORACLE });
  queue.pump = async () => {};

  const first = queue.enqueue({ sessionId: "Session-A", question: "Check Manx population", reason: "test", mode: "official_sources" });
  const differentCase = queue.enqueue({ sessionId: "session-a", question: "Check Manx population", reason: "test", mode: "official_sources" });
  const trailingSpace = queue.enqueue({ sessionId: "Session-A ", question: "Check Manx population", reason: "test", mode: "official_sources" });

  assert.equal(first.queued, true);
  assert.equal(differentCase.queued, true);
  assert.equal(trailingSpace.queued, true);
  assert.equal(new Set([first.id, differentCase.id, trailingSpace.id]).size, 3);
  assert.deepEqual(kb.queued.map((job) => job.sessionId), ["Session-A", "session-a", "Session-A "]);
});

test("official-source previews distinguish official evidence from merely sourced material", () => {
  const acceptedOfficialUrls = [
    "https://consult.gov.im/release",
    "https://gov.im./release",
    "https://CONSULT.GOV.IM./release",
  ];
  for (const url of acceptedOfficialUrls) assert.equal(isOfficialManxSource({ url }), true, url);
  const rejectedOfficialUrls = [
    "https://www.gov.uk/report",
    "https://example.ac.uk/paper",
    "https://evil-gov.im.example/report",
    "https://xn--gv-5ja.im/report",
  ];
  for (const url of rejectedOfficialUrls) {
    assert.equal(isOfficialManxSource({ url }), false, url);
    const outcome = classifyResearchOutcome({ mode: "official_sources", learned: [{ answersQuestion: true, status: "single_source", sources: [url] }] });
    assert.equal(outcome.answered, false, `${url} must not satisfy an official Manx source check`);
  }
  const accepted = classifyResearchOutcome({ mode: "official_sources", learned: [{ answersQuestion: true, status: "single_source", sources: ["https://consult.gov.im/release"] }] });
  assert.equal(accepted.answered, true);
  const unofficial = buildResearchPreview({
    mode: "official_sources", strategies: ["research"], spoken: "An official Manx source confirms that the flag is blue.", unresolved: [],
    findings: [{ claim: "A sufficiently long answer from a secondary source.", topic: "population", confidence: 0.7, answersQuestion: true, sources: [{ url: "https://example.com/report", title: "Report", publisher: "Example" }] }],
  });
  assert.equal(unofficial.officialRequested, true);
  assert.equal(unofficial.officialSourceFound, false);
  assert.equal(unofficial.deeperChecksPending, false);
  assert.equal(unofficial.sources[0].official, false);
  assert.doesNotMatch(unofficial.summary, /official Manx source confirms|flag is blue/i, "unsupported model prose must not be presented as an official result");
  assert.match(unofficial.summary, /provisional/i);
  assert.match(unofficial.summary, /sufficiently long answer from a secondary source/i);
  assert.match(unofficial.summary, /none .* official|no official/i);

  const official = buildResearchPreview({
    mode: "official_sources", strategies: ["research"], unresolved: [],
    findings: [{ claim: "A sufficiently long answer from an official Manx source.", topic: "population", confidence: 0.8, answersQuestion: true, sources: [{ url: "https://www.gov.im/news/official-release", title: "Official release", publisher: "Isle of Man Government" }] }],
  });
  assert.equal(official.officialSourceFound, true);
  assert.equal(official.sources[0].official, true);

  const notOfficial = classifyResearchOutcome({ mode: "official_sources", learned: [{ answersQuestion: true, status: "single_source", sources: ["https://example.com/report"] }] });
  assert.deepEqual({ status: notOfficial.status, result: notOfficial.result, answered: notOfficial.answered }, { status: "partial", result: "official_source_not_found", answered: false });
});

test("active cancellation aborts in-flight research and prevents a late preview or finish", async () => {
  const queued = queueKb();
  const events = [];
  let releaseModel;
  let routeStarted;
  const started = new Promise((resolve) => { routeStarted = resolve; });
  let modelSignal;
  const kb = {
    ...queued,
    focus: () => ({ claims: [] }),
    upsertClaim() { throw new Error("cancelled research must not be ingested"); },
    resolveGapsFor() { throw new Error("cancelled research must not resolve gaps"); },
  };
  const runModel = ({ signal }) => {
    modelSignal = signal;
    routeStarted();
    return new Promise((resolve) => {
      releaseModel = () => resolve({
        isError: false, costUsd: 0.01, webSearches: 1, stderr: "", text: "",
        structured: {
          findings: [{ claim: "This late finding must never be shown after cancellation.", topic: "cancel", confidence: 0.8, volatility: "live", answers_question: true, sources: [{ url: "https://www.gov.im/late", title: "Late" }] }],
          unresolved: [], spoken_summary: "This late answer must not be shown.",
        },
      });
    });
  };
  const queue = new ExpeditionQueue({
    kb, root: ORACLE, bus: { publish: (type, data) => events.push({ type, data }) },
    runExpeditionFn: (input) => runExpedition({ ...input, runModel }),
  });

  const admission = queue.enqueue({ sessionId: "s_cancel", question: "Check a live Manx fact", reason: "test cancellation", mode: "official_sources" });
  await started;
  assert.equal(queue.cancel(admission.id, "s_cancel").cancelled, true);
  assert.equal(modelSignal.aborted, true, "active cancellation must reach the in-flight model signal");
  releaseModel();
  await queue.whenIdle();

  assert.equal(events.some((event) => event.type === "expedition.preview"), false);
  assert.equal(events.some((event) => event.type === "expedition.finished"), false);
  assert.equal(queued.progress.some((patch) => patch.preview), false);
  assert.equal(queued.finished.at(-1).status, "interrupted");
});

test("an abort observed immediately after the research route returns cannot persist a preview", async () => {
  const controller = new AbortController();
  const persisted = [];
  const events = [];
  const kb = {
    focus: () => ({ claims: [] }),
    updateExpeditionProgress: (id, patch) => persisted.push({ id, ...patch }),
    finishExpedition() { throw new Error("an aborted expedition must not finish itself"); },
    upsertClaim() { throw new Error("an aborted expedition must not ingest"); },
  };
  const runModel = async () => {
    controller.abort();
    return {
      isError: false, costUsd: 0.01, webSearches: 1, stderr: "", text: "",
      structured: {
        findings: [{ claim: "This finding arrives on the cancellation boundary.", topic: "cancel", confidence: 0.8, volatility: "live", answers_question: true, sources: [{ url: "https://www.gov.im/boundary", title: "Boundary" }] }],
        unresolved: [], spoken_summary: "This boundary answer must not be shown.",
      },
    };
  };

  await assert.rejects(
    runExpedition({
      kb, root: ORACLE, bus: { publish: (type, data) => events.push({ type, data }) },
      id: "x_boundary", sessionId: "s_boundary", question: "Check a boundary case",
      reason: "test", mode: "official_sources", signal: controller.signal, runModel,
    }),
    /cancelled/i,
  );
  assert.equal(events.some((event) => event.type === "expedition.preview"), false);
  assert.equal(events.some((event) => event.type === "expedition.finished"), false);
  assert.equal(persisted.some((patch) => patch.preview), false);
});

test("the first sourced pass is persisted and emitted as an early preview before completion", async () => {
  const persisted = [];
  const finished = [];
  const events = [];
  const kb = {
    focus: () => ({ claims: [] }),
    randomClaim: () => null,
    updateExpeditionProgress: (id, patch) => persisted.push({ id, ...patch }),
    upsertClaim(input) {
      return { created: true, claim: { id: "c_preview", text: input.text, status: "single_source", confidence: input.confidence, kind: input.kind, sources: input.sources } };
    },
    finishExpedition: (id, patch) => finished.push({ id, ...patch }),
    resolveGapsFor() {},
  };
  const modelCalls = [];
  const runModel = async (input) => {
    modelCalls.push(input);
    return ({
    isError: false, costUsd: 0.01, webSearches: 1, stderr: "", text: "",
    structured: {
      findings: [{ claim: "The Isle of Man Government publishes an official population release.", topic: "Manx population", confidence: 0.9, volatility: "periodic", answers_question: true, sources: [{ url: "https://www.gov.im/news/official-release", title: "Population release", publisher: "Isle of Man Government" }] }],
      unresolved: [], spoken_summary: "An official population release was found.",
    },
    });
  };

  const result = await runExpedition({
    kb, bus: { publish: (type, data) => events.push({ type, data }) }, root: ORACLE,
    id: "x_preview", sessionId: "s_preview", question: "What is the current Manx population?", reason: "confirmed",
    strategies: ["research"], mode: "official_sources", runModel,
  });

  const previewIndex = events.findIndex((event) => event.type === "expedition.preview");
  const finishIndex = events.findIndex((event) => event.type === "expedition.finished");
  assert.ok(previewIndex >= 0 && previewIndex < finishIndex);
  assert.equal(events[previewIndex].data.sessionId, "s_preview");
  assert.equal(events[previewIndex].data.preview.officialSourceFound, true);
  assert.ok(persisted.some((patch) => patch.preview?.officialSourceFound === true));
  assert.ok(persisted.some((patch) => patch.progress?.stage === "complete" && patch.progress?.result === "answered"));
  assert.equal(finished[0].status, "done");
  assert.equal(result.result, "answered");
  assert.deepEqual(modelCalls[0].tools, ["WebSearch", "WebFetch"]);
  for (const host of ["gov.im", "tynwald.org.im", "judgments.im", "iomfsa.im", "manxnationalheritage.im"]) assert.match(modelCalls[0].prompt, new RegExp(host.replaceAll(".", "\\.")));
});

test("an unsuccessful official check keeps the sourced answer and adds an exact Manx-official caveat", async () => {
  const persisted = [];
  const finished = [];
  const events = [];
  const kb = {
    focus: () => ({ claims: [] }),
    updateExpeditionProgress: (id, patch) => persisted.push({ id, ...patch }),
    upsertClaim(input) {
      return {
        created: false,
        claim: {
          id: "c_unofficial",
          text: input.text,
          status: "corroborated",
          confidence: input.confidence,
          kind: input.kind,
          // This official URL belongs to an older expedition and must not
          // authenticate the evidence found by the current source check.
          sources: [...input.sources, { url: "https://www.gov.im/historical-release" }],
        },
      };
    },
    finishExpedition: (id, patch) => finished.push({ id, ...patch }),
    resolveGapsFor() { throw new Error("an incomplete official check must not close the gap"); },
  };
  const runModel = async () => ({
    isError: false, costUsd: 0.01, webSearches: 1, stderr: "", text: "",
    structured: {
      findings: [{ claim: "A UK report contains a useful but non-Manx-official answer.", topic: "Manx check", confidence: 0.7, volatility: "periodic", answers_question: true, sources: [{ url: "https://www.gov.uk/report", title: "UK report", publisher: "UK Government" }] }],
      unresolved: [], spoken_summary: "An official Manx source confirms the answer completely.",
    },
  });

  const result = await runExpedition({ kb, bus: { publish: (type, data) => events.push({ type, data }) }, root: ORACLE, id: "x_unofficial", sessionId: "s_unofficial", question: "Check this Manx fact", reason: "confirmed", mode: "official_sources", runModel });

  assert.equal(result.result, "official_source_not_found");
  assert.doesNotMatch(result.summary, /official Manx source confirms the answer completely/i);
  assert.match(result.summary, /provisional/i);
  assert.match(result.summary, /UK report contains a useful but non-Manx-official answer/i);
  assert.match(result.summary, /no official Manx source/i);
  assert.deepEqual(result.learned[0].sources, ["https://www.gov.uk/report"], "returned evidence must be scoped to this expedition");
  assert.equal(finished[0].status, "partial");
  assert.ok(persisted.some((patch) => patch.progress?.result === "official_source_not_found"));
  assert.equal(events.find((event) => event.type === "expedition.finished").data.officialSourceFound, false);
});

test("failure events keep session identity and settle only their matching dialogue action", async () => {
  const kb = queueKb();
  const events = [];
  const settled = [];
  const queue = new ExpeditionQueue({
    kb, root: ORACLE, bus: { publish: (type, data) => events.push({ type, data }) },
    runExpeditionFn: async () => { throw new Error("route unavailable"); },
    onSettled: (event) => settled.push(event),
  });
  const admission = queue.enqueue({ sessionId: "s_failed", question: "Check a current Manx figure", reason: "confirmed", mode: "official_sources" });
  await queue.whenIdle();

  const failure = events.find((event) => event.type === "expedition.failed");
  assert.equal(failure.data.sessionId, "s_failed");
  assert.equal(failure.data.id, admission.id);
  assert.equal(settled[0].status, "failed");

  const dialogue = new DialogueSessions();
  dialogue.set("s_failed", { ...createDialogueState(), pendingAction: { kind: "research", id: admission.id, subject: "subject", status: "running" } });
  dialogue.settleResearch("s_failed", "another", { status: "done" });
  assert.equal(dialogue.get("s_failed").pendingAction.id, admission.id);
  dialogue.settleResearch("s_failed", admission.id, { status: "failed" });
  assert.equal(dialogue.get("s_failed").pendingAction, null);
});

test("reset-style session cancellation cannot cancel another session's queued research", () => {
  const kb = queueKb();
  const events = [];
  const queue = new ExpeditionQueue({ kb, root: ORACLE, bus: { publish: (type, data) => events.push({ type, data }) } });
  queue.pump = async () => {};
  queue.enqueue({ sessionId: "mine", question: "Manx population", reason: "test", mode: "official_sources" });
  queue.enqueue({ sessionId: "other", question: "Manx companies", reason: "test", mode: "deep" });
  const result = queue.cancelSession("mine");
  assert.equal(result.cancelled, 1);
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].sessionId, "other");
  assert.ok(events.some((event) => event.type === "expedition.failed" && event.data.sessionId === "mine"));
});

test("SSE events carry ids and Last-Event-ID replays only later buffered events", () => {
  class Response extends EventEmitter {
    constructor() { super(); this.body = ""; }
    writeHead() {}
    write(chunk) { this.body += chunk; return true; }
  }
  const bus = new Bus();
  bus.publish("one", { value: 1 });
  bus.publish("two", { value: 2 });
  const req = { url: "/api/events?since=0", headers: { "last-event-id": "1" } };
  const res = new Response();
  attachBus(bus, req, res);
  res.emit("close");
  assert.doesNotMatch(res.body, /event: one/);
  assert.match(res.body, /id: 2\nevent: two/);
});

test("server exposes session-scoped recovery and wires research ownership through every lifecycle", () => {
  const routeStart = SERVER.indexOf('p === "/api/research"');
  const routeEnd = SERVER.indexOf('p === "/api/brain"', routeStart);
  const researchRoute = SERVER.slice(routeStart, routeEnd);
  assert.match(researchRoute, /String\(url\.searchParams\.get\("sessionId"\) \|\| ""\)\.slice\(0, 80\)/);
  assert.doesNotMatch(researchRoute, /\.trim\(\)/, "session lookup must preserve exact ownership identity");
  assert.match(SERVER, /resolution\.strategies[\s\S]*mode:\s*resolution\.researchMode[\s\S]*sessionId/);
  assert.match(SERVER, /expeditions\.cancelSession\(sessionId\)/);
  assert.match(SERVER, /onSettled:[\s\S]*dialogue\.settleResearch/);
  assert.match(SERVER, /recent:\s*publicExpeditionRows\(kb\.recentExpeditions\(8\)\)/, "the general Brain response must hide session ownership");
});
