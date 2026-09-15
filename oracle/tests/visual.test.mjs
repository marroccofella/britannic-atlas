import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAFE_VISUAL_COLORS,
  VISUAL_KINDS,
  createReviewedVisual,
  reviewAndRepairVisualSpec,
  validateVisualSpec,
} from "../lib/visual.mjs";
import { MommHourlyAllowance, deliberateEpisode } from "../lib/deliberate.mjs";

const provenance = [{ publisher: "Statistics Isle of Man", title: "Population Report 2024", reference: "Table 1" }];
const bar = (overrides = {}) => ({
  version: 1,
  kind: "bar",
  title: "Resident population",
  width: 720,
  height: 420,
  xLabel: "Year",
  yLabel: "Residents",
  asOf: "2024-12-31",
  provenance,
  series: [{ name: "Population", color: "manx-green", points: [{ x: "2021", y: 84069 }, { x: "2024", y: 84756 }] }],
  ...overrides,
});

test("visual validator accepts only the four supported data-only forms", () => {
  assert.deepEqual(VISUAL_KINDS, ["bar", "line", "scatter", "node-edge"]);
  assert.ok(SAFE_VISUAL_COLORS.includes("manx-green"));
  assert.equal(validateVisualSpec(bar()).ok, true);
  assert.equal(validateVisualSpec(bar({ kind: "line" })).ok, true);
  assert.equal(validateVisualSpec(bar({
    kind: "scatter",
    series: [{ name: "Capacity", color: "sea-blue", points: [{ x: 12.5, y: 18.2 }] }],
  })).ok, true);
  assert.equal(validateVisualSpec({
    version: 1,
    kind: "node-edge",
    title: "Manx government relationship",
    width: 720,
    height: 480,
    asOf: "2026-09-03",
    provenance,
    nodes: [{ id: "gov", label: "Isle of Man Government", color: "manx-green" }, { id: "doi", label: "Department of Infrastructure", color: "brass" }],
    edges: [{ from: "gov", to: "doi", label: "includes", color: "slate" }],
  }).ok, true);
  assert.equal(validateVisualSpec(bar({ kind: "pie" })).ok, false);
});

test("factual visuals require an exact as-of date and useful provenance", () => {
  assert.match(validateVisualSpec(bar({ asOf: undefined })).errors.join(" "), /asOf/);
  assert.match(validateVisualSpec(bar({ asOf: "recently" })).errors.join(" "), /asOf/);
  assert.match(validateVisualSpec(bar({ provenance: [] })).errors.join(" "), /provenance/);
  const conceptual = validateVisualSpec({
    version: 1,
    kind: "node-edge",
    title: "Illustrative relationship",
    width: 600,
    height: 400,
    nodes: [{ id: "a", label: "Question" }, { id: "b", label: "Answer" }],
    edges: [{ from: "a", to: "b" }],
  }, { factual: false });
  assert.equal(conceptual.ok, true);
  assert.equal(conceptual.value.factual, false);
});

test("visual validator rejects executable text, URLs, custom styles and unsafe colors at every depth", () => {
  for (const title of [
    "<script>alert(1)</script>",
    "javascript:alert(1)",
    "https://example.test/chart",
    "body { color: red; }",
    "<svg onload=alert(1)>",
    "java\u0000script:alert(1)",
  ]) assert.equal(validateVisualSpec(bar({ title })).ok, false, title);

  assert.equal(validateVisualSpec(bar({ onclick: "alert(1)" })).ok, false);
  assert.equal(validateVisualSpec(bar({ series: [{ name: "Population", color: "#fff", points: [{ x: "2024", y: 84756 }] }] })).ok, false);
  assert.equal(validateVisualSpec(bar({ series: [{ name: "<img src=x>", color: "brass", points: [{ x: "2024", y: 84756 }] }] })).ok, false);
  assert.equal(validateVisualSpec(bar({ provenance: [{ publisher: "Statistics", title: "Report", reference: "https://example.test" }] })).ok, false);
});

test("visual validator bounds dimensions, labels, collection sizes and every number", () => {
  assert.equal(validateVisualSpec(bar({ width: 10 })).ok, false);
  assert.equal(validateVisualSpec(bar({ height: Infinity })).ok, false);
  assert.equal(validateVisualSpec(bar({ title: "x".repeat(161) })).ok, false);
  assert.equal(validateVisualSpec(bar({ series: [{ name: "Population", color: "brass", points: [{ x: "2024", y: Number.NaN }] }] })).ok, false);
  assert.equal(validateVisualSpec(bar({ series: [{ name: "Population", color: "brass", points: Array.from({ length: 201 }, (_, i) => ({ x: i, y: i })) }] })).ok, false);
});

test("node-edge diagrams require unique safe nodes and valid bounded endpoints", () => {
  const graph = {
    version: 1, kind: "node-edge", title: "Relationship", width: 600, height: 400,
    asOf: "2026-09-03", provenance,
    nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }],
  };
  assert.equal(validateVisualSpec({ ...graph, nodes: [{ id: "a", label: "A" }, { id: "a", label: "Again" }] }).ok, false);
  assert.equal(validateVisualSpec({ ...graph, edges: [{ from: "a", to: "missing" }] }).ok, false);
  assert.equal(validateVisualSpec({ ...graph, nodes: [{ id: "a<script>", label: "A" }, { id: "b", label: "B" }] }).ok, false);
});

test("review correction uses only structured findings and revalidates the repaired spec", async () => {
  let reviewInput = null;
  let synthesisInput = null;
  const result = await reviewAndRepairVisualSpec({
    origin: "server",
    candidate: bar({ series: [{ name: "Population", color: "#00ff00", points: [{ x: "2024", y: 84756 }] }] }),
    review: async (request) => {
      reviewInput = request;
      return { status: "MODIFY", findings: [{ severity: "WARNING", issue: "Use a palette token." }], chain_of_thought: "VISUAL-REVIEW-SECRET" };
    },
    synthesize: async (request) => {
      synthesisInput = request;
      return { structured: bar({ series: [{ name: "Population", color: "manx-green", points: [{ x: "2024", y: 84756 }] }] }), reasoning: "VISUAL-SYNTHESIS-SECRET" };
    },
  });

  assert.ok(reviewInput.validationErrors.length);
  assert.doesNotMatch(JSON.stringify(synthesisInput), /VISUAL-REVIEW-SECRET|chain_of_thought/);
  assert.equal(result.ok, true);
  assert.equal(result.repaired, true);
  assert.equal(result.value.series[0].color, "manx-green");
  assert.doesNotMatch(JSON.stringify(result), /SECRET|reasoning|structured/);
});

test("an unsafe synthesized correction fails closed and is never returned", async () => {
  const result = await reviewAndRepairVisualSpec({
    origin: "server",
    candidate: bar({ title: "https://unsafe.test" }),
    review: async () => ({ status: "MODIFY", findings: [{ severity: "CRITICAL", issue: "Unsafe URL." }] }),
    synthesize: async () => ({ structured: bar({ title: "<svg onload=alert(1)>" }) }),
  });
  assert.equal(result.ok, false);
  assert.equal("value" in result, false);
  assert.match(result.errors.join(" "), /unsafe/i);
});

test("client-supplied specs are rejected before review or synthesis", async () => {
  let calls = 0;
  const result = await reviewAndRepairVisualSpec({
    origin: "client",
    candidate: bar(),
    review: async () => { calls += 1; return { status: "ACCEPT", findings: [] }; },
    synthesize: async () => { calls += 1; return { structured: bar() }; },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "client-supplied visual specs are not accepted");
  assert.equal(calls, 0);
});

test("deliberation and canvas consume one shared injected hourly allowance", async () => {
  const allowance = new MommHourlyAllowance({ limit: 1 });
  const considered = await deliberateEpisode({
    episode: {
      id: "ep_allowance", session_id: "session_allowance", question: "q", resolved_question: "Manx q",
      answer: "Original.", status: "single_source", confidence: 0.6,
    },
    allowance,
    dispatch: async () => ({ reviewers: [{ agent: "claude", status: "success", verdict: "ACCEPT", summary: "Sound." }], findings: [] }),
    runModel: async () => ({ structured: { answer: "Improved.", status: "corroborated", confidence: 0.8, corrections: [] } }),
  });
  assert.equal(considered.ok, true);
  let reviews = 0;
  const canvas = await reviewAndRepairVisualSpec({
    origin: "server", candidate: bar(), allowance,
    review: async () => { reviews += 1; return { status: "ACCEPT", findings: [] }; },
  });
  assert.equal(canvas.ok, false);
  assert.equal(canvas.reason, "allowance_exhausted");
  assert.equal(canvas.allowance.name, "oracle-momm-hourly");
  assert.equal(reviews, 0);
  assert.equal(allowance.snapshot().used, 1);
});

test("an exhausted shared MOMM allowance blocks visual generation before any model spend", async () => {
  const allowance = new MommHourlyAllowance({ limit: 1 });
  assert.equal(allowance.consume("deliberate").ok, true);
  let generations = 0;
  let reviews = 0;
  const result = await createReviewedVisual({
    question: "Chart the Isle of Man population",
    ledgerClaims: [],
    allowance,
    runModel: async () => {
      generations += 1;
      return { structured: bar() };
    },
    dispatch: async () => {
      reviews += 1;
      return { reviewers: [] };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "allowance_exhausted");
  assert.equal(generations, 0, "no visual-generation model call may start without a MOMM slot");
  assert.equal(reviews, 0);
  assert.equal(allowance.snapshot().used, 1);
});

test("createReviewedVisual generates, reviews and returns the safe server contract", async () => {
  let generated = 0;
  let dispatched = null;
  const result = await createReviewedVisual({
    question: "Show the Isle of Man population trend",
    ledgerClaims: [{ text: "The resident population estimate was 84,756 in 2024.", status: "verified", asOf: "2024-12-31", sources: [{ title: "Population Report 2024", publisher: "Statistics Isle of Man", url: "https://www.gov.im/private-not-for-visual" }] }],
    allowance: new MommHourlyAllowance({ limit: 2 }),
    runModel: async () => {
      generated += 1;
      return { structured: bar() };
    },
    dispatch: async (request) => {
      dispatched = request;
      return { run_id: "rev_visual", reviewers: [{ agent: "copilot", status: "success", verdict: "ACCEPT", summary: "The data shape is sound." }], findings: [], insights: { agreement_score: 1 } };
    },
  });
  assert.equal(generated, 1);
  assert.ok(dispatched.brief.length <= 12_000);
  assert.doesNotMatch(dispatched.brief, /private-not-for-visual/);
  assert.equal(result.ok, true);
  assert.equal(result.spec.kind, "bar");
  assert.match(result.narration, /reviewed chart/i);
  assert.equal(result.review.runId, "rev_visual");
  assert.deepEqual(Object.keys(result).sort(), ["narration", "ok", "review", "spec"]);
});

test("createReviewedVisual repairs a rejected candidate with the same strict schema and revalidates", async () => {
  let calls = 0;
  const result = await createReviewedVisual({
    question: "Chart the population",
    ledgerClaims: [{ text: "Population was 84,756.", status: "verified", asOf: "2024-12-31", sources: [] }],
    allowance: new MommHourlyAllowance({ limit: 2 }),
    runModel: async (request) => {
      calls += 1;
      assert.equal(request.schema.additionalProperties, false);
      return calls === 1
        ? { structured: bar({ series: [{ name: "Population", color: "#bad", points: [{ x: "2024", y: 84756 }] }] }) }
        : { structured: bar() };
    },
    dispatch: async () => ({ reviewers: [{ agent: "claude", status: "success", verdict: "MODIFY", summary: "Use a safe palette." }], findings: [{ id: "v1", severity: "WARNING", issue: "The colour is outside the palette.", sources: ["claude"] }] }),
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  assert.equal(result.spec.series[0].color, "manx-green");
});

test("createReviewedVisual fails factual visuals closed when no reviewer succeeds", async () => {
  const result = await createReviewedVisual({
    question: "Chart the population",
    ledgerClaims: [{ text: "Population was 84,756.", status: "verified", asOf: "2024-12-31" }],
    allowance: new MommHourlyAllowance({ limit: 2 }),
    runModel: async () => ({ structured: bar() }),
    dispatch: async () => ({ reviewers: [{ agent: "copilot", status: "timeout", verdict: null, summary: "" }], findings: [] }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no successful visual review");
  assert.equal("spec" in result, false);
  assert.match(result.narration, /haven't shown/i);
  assert.doesNotMatch(JSON.stringify(result), /provenance/);
});

test("an unreviewed non-factual structural diagram is clearly labelled and remains validated", async () => {
  const conceptual = {
    version: 1, kind: "node-edge", title: "Question to answer flow", width: 600, height: 400,
    nodes: [{ id: "q", label: "Question" }, { id: "a", label: "Answer" }], edges: [{ from: "q", to: "a" }],
  };
  const result = await createReviewedVisual({
    question: "Illustrate a question and answer flow",
    ledgerClaims: [],
    allowance: new MommHourlyAllowance({ limit: 2 }),
    runModel: async () => ({ structured: conceptual }),
    dispatch: async () => ({ reviewers: [{ agent: "grok", status: "provider_unavailable", verdict: null, summary: "" }], findings: [] }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.spec.kind, "node-edge");
  assert.equal(result.spec.factual, false);
  assert.equal(result.review.status, "unreviewed");
  assert.match(result.narration, /unreviewed conceptual diagram/i);
});
