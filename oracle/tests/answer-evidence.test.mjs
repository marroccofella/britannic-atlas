import { test } from "node:test";
import assert from "node:assert/strict";
import { boundDeliberatedEvidence } from "../lib/answer-evidence.mjs";

test("a materially rewritten MOMM answer cannot inherit the old proposition's evidence badge", () => {
  const result = boundDeliberatedEvidence({
    originalAnswer: "The Department of Infrastructure administers Douglas harbour.",
    originalStatus: "verified",
    originalConfidence: 0.94,
    revisedAnswer: "A different body administers Douglas harbour and also controls the airport.",
    proposedStatus: "verified",
    proposedConfidence: 0.99,
  });
  assert.deepEqual(result, { changed: true, status: "model_prior", confidence: null });
});

test("an unchanged answer remains bounded by the original evidence status and confidence", () => {
  const result = boundDeliberatedEvidence({
    originalAnswer: "The Department administers the harbour.",
    originalStatus: "single_source",
    originalConfidence: 0.72,
    revisedAnswer: "  The Department administers the harbour.  ",
    proposedStatus: "verified",
    proposedConfidence: 0.91,
  });
  assert.deepEqual(result, { changed: false, status: "single_source", confidence: 0.72 });
});
