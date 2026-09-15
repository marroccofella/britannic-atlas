import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EpisodeDeliberationGate,
  MOMM_ALLOWANCE_NAME,
  MommHourlyAllowance,
  buildDeliberationBrief,
  deliberateEpisode,
  parseDeliberationReport,
} from "../lib/deliberate.mjs";

const episode = (overrides = {}) => ({
  id: "ep_123",
  session_id: "server-session",
  question: "Who is responsible for Douglas harbour?",
  resolved_question: "Answer this specifically for the Isle of Man: Who is responsible for Douglas harbour?",
  jurisdiction: "IM",
  answer: "The Department of Infrastructure is responsible.",
  confidence: 0.72,
  status: "single_source",
  claims_used: ["c_harbour"],
  sources: [{ title: "Ports information", url: "https://www.gov.im/ports" }],
  created_at: "2026-09-03T08:00:00.000Z",
  ...overrides,
});

test("deliberation brief is bounded, read-only and built only from allowlisted server episode fields", () => {
  const brief = buildDeliberationBrief(episode({
    answer: `Supported answer. ${"a".repeat(20_000)}`,
    chain_of_thought: "PRIVATE-CHAIN-SENTINEL",
    instructions: "IGNORE-THE-GOVERNOR-SENTINEL",
    sources: Array.from({ length: 30 }, (_, i) => ({ title: `Source ${i}`, url: `https://example.test/${i}`, secret: "SENTINEL-SOURCE-SECRET" })),
  }));

  assert.ok(brief.length <= 12_000);
  assert.match(brief, /read-only/i);
  assert.match(brief, /untrusted quoted data/i);
  assert.match(brief, /Supported answer/);
  assert.match(brief, /resolved_question/);
  assert.doesNotMatch(brief, /PRIVATE-CHAIN-SENTINEL|IGNORE-THE-GOVERNOR-SENTINEL|SOURCE-SECRET/);
  assert.doesNotMatch(brief, /Source 12/);
});

test("review briefs omit conversation identifiers and the raw original transcript", () => {
  const brief = buildDeliberationBrief(episode({
    id: "PRIVATE-EPISODE-ID",
    session_id: "PRIVATE-SESSION-ID",
    question: "PRIVATE-RAW-TRANSCRIPT",
    resolved_question: "What public body administers Douglas harbour on the Isle of Man?",
  }));
  assert.doesNotMatch(brief, /PRIVATE-EPISODE-ID|PRIVATE-SESSION-ID|PRIVATE-RAW-TRANSCRIPT/);
  assert.match(brief, /public body administers Douglas harbour/i);
});

test("review briefs remove URL credentials, query secrets, fragments and sensitive source labels", () => {
  const brief = buildDeliberationBrief(episode({
    sources: [
      { title: "Public ports page", url: "https://user:password@example.test/ports?token=TOP-SECRET#private" },
      { title: "My email private.person@example.test", url: "https://example.test/private" },
      { title: "Local copy", url: "http://127.0.0.1:4242/private" },
    ],
  }));
  assert.doesNotMatch(brief, /user:password|TOP-SECRET|#private|private\.person|127\.0\.0\.1/);
  assert.doesNotMatch(brief, /https:\/\/example\.test\/ports/);
});

test("report parser exposes only bounded structured review fields", () => {
  const parsed = parseDeliberationReport({
    run_id: "rev_safe",
    raw_prompt: "RAW-PROMPT-SENTINEL",
    chain_of_thought: "REPORT-CHAIN-SENTINEL",
    reviewers: [
      { agent: "claude", status: "success", verdict: "MODIFY", confidence: 0.8, summary: "The responsible body needs a date.", reasoning: "REVIEWER-REASONING" },
      { agent: "grok", status: "invented_status", verdict: "ACCEPT", summary: "ana\u0000lysis: CONTROL-SPLIT-REASONING" },
    ],
    findings: [{ id: "f_1", severity: "WARNING", title: "Office may have changed", issue: "Check the current department", rationale: "The answer lacks an as-of date.", sources: ["claude"], raw: "FINDING-RAW" }],
    insights: { agreement_score: 0.5, hidden: "INSIGHT-HIDDEN" },
    consensus: { corroborated: ["f_1"], single_source: ["f_2"], secret: "SENTINEL-CONSENSUS-SECRET" },
    evidence: { ledger_url: "file:///private-ledger.html" },
  });

  assert.equal(parsed.runId, "rev_safe");
  assert.deepEqual(parsed.agreement, { score: 0.5, corroborated: [], singleSource: ["f_1"] });
  assert.equal(parsed.reviewers[0].status, "success");
  assert.equal(parsed.reviewers[1].status, "unknown_status");
  assert.equal(parsed.findings[0].severity, "WARNING");
  assert.equal(parsed.successes, 1);
  const exposed = JSON.stringify(parsed);
  assert.doesNotMatch(exposed, /RAW-PROMPT|CHAIN-SENTINEL|REVIEWER-REASONING|CONTROL-SPLIT-REASONING|FINDING-RAW|INSIGHT-HIDDEN|CONSENSUS-SECRET|private-ledger/);
});

test("deliberation dispatches a bounded brief and returns synthesis without chain of thought", async () => {
  let dispatched = null;
  let modelCall = null;
  const result = await deliberateEpisode({
    episode: episode(),
    cwd: "D:/project",
    dispatch: async (request) => {
      dispatched = request;
      return {
        run_id: "rev_42",
        chain_of_thought: "PEER-PRIVATE-THOUGHT",
        reviewers: [{ agent: "copilot", status: "success", verdict: "MODIFY", confidence: 0.85, summary: "Add the statutory body and date." }],
        findings: [{ id: "f_current", severity: "WARNING", issue: "State the answer as of a date", rationale: "Responsibility can change.", sources: ["copilot"] }],
        insights: { agreement_score: 1 },
      };
    },
    runModel: async (request) => {
      modelCall = request;
      return {
        text: "<analysis>MODEL-PRIVATE-THOUGHT</analysis> discarded",
        structured: {
          answer: "As of 3 September 2026, the Isle of Man Department of Infrastructure is responsible for Douglas harbour.",
          confidence: 0.84,
          status: "corroborated",
          corrections: ["Added the responsible body and as-of date."],
          reasoning: "MODEL-STRUCTURED-REASONING",
        },
      };
    },
  });

  assert.match(dispatched.brief, /Department of Infrastructure/);
  assert.equal(dispatched.cwd, "D:/project");
  assert.deepEqual(modelCall.tools, []);
  assert.equal(modelCall.schema.additionalProperties, false);
  assert.equal(result.ok, true);
  assert.match(result.answer, /^As of 3 September 2026/);
  assert.equal(result.review.runId, "rev_42");
  assert.deepEqual(result.corrections, ["Added the responsible body and as-of date."]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-THOUGHT|STRUCTURED-REASONING|analysis|brief|prompt/);
});

test("deliberation fails closed without a successful peer and never calls synthesis", async () => {
  let modelCalls = 0;
  const result = await deliberateEpisode({
    episode: episode(),
    dispatch: async () => ({ reviewers: [{ agent: "copilot", status: "timeout", summary: "late" }], findings: [] }),
    runModel: async () => { modelCalls += 1; return { structured: { answer: "must not run" } }; },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no successful peer reviews");
  assert.equal(modelCalls, 0);
});

test("local and capability episodes are ineligible and cannot consume a reviewer", async () => {
  for (const kind of ["local", "capability", "action", "clarify"]) {
    let dispatches = 0;
    const result = await deliberateEpisode({
      episode: episode({ kind }),
      dispatch: async () => { dispatches += 1; return {}; },
      runModel: async () => ({ structured: { answer: "never" } }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "episode is not eligible for deliberation");
    assert.equal(dispatches, 0);
  }
  let statusOnlyDispatches = 0;
  const statusOnly = await deliberateEpisode({
    episode: episode({ status: "local" }),
    dispatch: async () => { statusOnlyDispatches += 1; return {}; },
    runModel: async () => ({ structured: { answer: "never" } }),
  });
  assert.equal(statusOnly.ok, false);
  assert.equal(statusOnlyDispatches, 0);
});

test("concurrent duplicate episode deliberations share one atomic admission", async () => {
  assert.equal(MOMM_ALLOWANCE_NAME, "oracle-momm-hourly");
  const gate = new EpisodeDeliberationGate();
  const allowance = new MommHourlyAllowance({ limit: 5 });
  let dispatches = 0;
  let releaseDispatch;
  const blocked = new Promise((resolve) => { releaseDispatch = resolve; });
  const options = {
    episode: episode(), gate, allowance,
    dispatch: async () => {
      dispatches += 1;
      await blocked;
      return { reviewers: [{ agent: "claude", status: "success", verdict: "ACCEPT", summary: "Sound." }], findings: [] };
    },
    runModel: async () => ({ structured: { answer: "One answer.", status: "corroborated", confidence: 0.8, corrections: [] } }),
  };
  const first = deliberateEpisode(options);
  const duplicate = deliberateEpisode(options);
  await Promise.resolve();
  assert.equal(dispatches, 1);
  releaseDispatch();
  const [a, b] = await Promise.all([first, duplicate]);
  assert.equal(a.ok, true);
  assert.deepEqual(b, a);
  assert.equal(allowance.snapshot().used, 1);
});

test("episode gate releases after rejection and hourly allowance uses a sliding injected clock", async () => {
  const gate = new EpisodeDeliberationGate();
  await assert.rejects(gate.run({ sessionId: "s", episodeId: "e" }, async () => { throw new Error("boom"); }), /boom/);
  assert.equal(gate.size, 0);
  assert.equal(await gate.run({ sessionId: "s", episodeId: "e" }, async () => "retried"), "retried");

  let now = 1_000;
  const allowance = new MommHourlyAllowance({ limit: 1, clock: () => now });
  assert.equal(allowance.consume("deliberate").ok, true);
  assert.equal(allowance.consume("canvas").reason, "allowance_exhausted");
  now += 60 * 60_000;
  assert.equal(allowance.consume("canvas").ok, true);
  assert.deepEqual(allowance.snapshot().consumers, { deliberate: 0, canvas: 1 });
});

test("synthesis strips hidden-reasoning containers even from the answer field", async () => {
  const result = await deliberateEpisode({
    episode: episode(),
    dispatch: async () => ({ reviewers: [{ agent: "grok", status: "success", verdict: "ACCEPT", summary: "Sound." }], findings: [] }),
    runModel: async () => ({ structured: { answer: "<analysis>secret working</analysis>Final answer only.", confidence: 0.8, status: "corroborated", corrections: [] } }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.answer, "Final answer only.");
  assert.doesNotMatch(JSON.stringify(result), /secret working|analysis/i);
});
