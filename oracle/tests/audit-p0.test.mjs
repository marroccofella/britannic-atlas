// Release blockers from the browser journey and accuracy audit of 2026-09-04.
// Each test reproduces a defect the audit demonstrated in the running product.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundStatusByEntailment, entailmentCheck, entailmentNotice, salientTerms } from "../lib/entailment.mjs";
import { resolveDialogue, createDialogueState } from "../lib/dialogue.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ORACLE, file), "utf8");

const douglas = [{ text: "Douglas is the capital of the Isle of Man and its largest town.", topic: "Isle of Man" }];

test("P0-1: a false answer cannot inherit a verified badge from a real claim it cites", () => {
  // The audit's reproduction: answer "Ramsey is the capital", cite the verified
  // Douglas claim, and the product displayed verified at 99% with official links.
  const entailment = entailmentCheck({ answer: "Ramsey is the capital of the Isle of Man.", claims: douglas });
  assert.equal(entailment.verdict, "partial");
  assert.deepEqual(entailment.unsupported, ["Ramsey"]);
  assert.equal(boundStatusByEntailment("verified", entailment), "single_source", "a name the evidence never mentions cannot be verified");
  assert.equal(boundStatusByEntailment("corroborated", entailment), "single_source");
  assert.match(entailmentNotice(entailment), /does not mention Ramsey/);
});

test("P0-1: honest answers, paraphrase and ordinary prose keep their earned status", () => {
  for (const answer of [
    "Douglas is the capital of the Isle of Man.",
    "The capital of the Isle of Man is Douglas, which is also its largest town.",
    "However, Douglas is the capital of the Isle of Man.",
    "Legally, Douglas is the capital of the Isle of Man and its largest town.",
  ]) {
    const entailment = entailmentCheck({ answer, claims: douglas });
    assert.equal(boundStatusByEntailment("verified", entailment), "verified", `wrongly downgraded: ${answer}`);
    assert.equal(entailmentNotice(entailment), "", "nothing to warn about when the answer is entailed");
  }
});

test("P0-1: invented figures and wholly unsupported answers are caught", () => {
  const figure = entailmentCheck({ answer: "Douglas has a population of 84,069 people.", claims: douglas });
  assert.deepEqual(figure.unsupported, ["84,069"], "a number the evidence never carries is an unbacked assertion");
  assert.notEqual(boundStatusByEntailment("verified", figure), "verified");

  const unrelated = entailmentCheck({ answer: "Ramsey, Peel and Castletown were joined by the Snaefell Mountain Railway in 1895.", claims: douglas });
  assert.equal(unrelated.verdict, "unsupported");
  assert.equal(boundStatusByEntailment("verified", unrelated), "model_prior", "an answer the evidence does not carry at all is model knowledge");

  const uncited = entailmentCheck({ answer: "Douglas is the capital.", claims: [] });
  assert.equal(uncited.verdict, "uncited");
  assert.equal(boundStatusByEntailment("verified", uncited), "model_prior");
});

test("P0-1: entailment only ever lowers a status, never raises one", () => {
  const entailed = entailmentCheck({ answer: "Douglas is the capital of the Isle of Man.", claims: douglas });
  assert.equal(entailed.verdict, "entailed");
  for (const status of ["model_prior", "single_source", "hypothesis", "contested"]) {
    assert.equal(boundStatusByEntailment(status, entailed), status, `${status} must not be promoted by entailment`);
  }
});

test("P0-1: salient terms are names and figures, not grammar", () => {
  const terms = salientTerms("However, Tynwald sat in Douglas on 5 July 2026 with 84,069 residents.").map((t) => t.display);
  assert.ok(terms.includes("Tynwald") && terms.includes("Douglas"), "names are checkable assertions");
  assert.ok(terms.includes("84,069") && terms.includes("2026"), "figures and years are checkable assertions");
  assert.ok(!terms.includes("However"), "a discourse opener asserts nothing");
  assert.deepEqual(salientTerms(""), []);
});

test("P0-1: the answer route binds status to the answer, not only to the question", () => {
  const brain = read("lib/brain.mjs");
  assert.match(brain, /const entailment = entailmentCheck\(\{ answer: speakable\(spokenText\), claims: usedClaims \}\)/);
  assert.match(brain, /const derivedStatus = boundStatusByEntailment\(claimStatus, entailment\)/);
  assert.match(brain, /entailmentNotice: entailmentNotice\(entailment\)/, "the interface is told which parts went unbacked");
});

test("P0-2: an explicitly named foreign country is never silently answered as Manx law", () => {
  const germany = resolveDialogue("What is company law in Germany?", createDialogueState(), { source: "typed", confirmed: true });
  assert.equal(germany.jurisdiction, "Germany", "the audit saw this answered as Isle of Man law");
  assert.doesNotMatch(germany.canonical, /specifically for the Isle of Man/);

  for (const [question, expected] of [
    ["What is company law in Singapore?", "Singapore"],
    ["Tell me about company law in Japan", "Japan"],
    ["How does incorporation work in the United Arab Emirates?", "United Arab Emirates"],
    ["What are the rules in South Africa?", "South Africa"],
  ]) {
    assert.equal(resolveDialogue(question, createDialogueState(), { source: "typed", confirmed: true }).jurisdiction, expected, question);
  }
});

test("P0-2: the Manx default and explicit comparisons still behave", () => {
  assert.equal(resolveDialogue("Tell me about Manx company law", createDialogueState(), { source: "typed", confirmed: true }).jurisdiction, "Isle of Man");
  assert.equal(resolveDialogue("What is company law here?", createDialogueState(), { source: "typed", confirmed: true }).jurisdiction, "Isle of Man", "an unqualified question stays Manx-first");
  assert.equal(resolveDialogue("How does Isle of Man company law compare with Germany?", createDialogueState(), { source: "typed", confirmed: true }).jurisdiction, "Isle of Man and Germany");
});

test("P0-2: jurisdiction patterns are whole words, not substrings", () => {
  const source = read("lib/dialogue.mjs");
  assert.equal(source.includes(String.fromCharCode(8)), false, "no mangled control bytes inside the patterns");
  const start = source.indexOf("const FOREIGN_JURISDICTIONS = [");
  const block = source.slice(start, source.indexOf("\n];", start));
  const patterns = block.match(/\/[^/\n]+\/i/g) || [];
  assert.ok(patterns.length > 100, `expected a broad jurisdiction list, found ${patterns.length}`);
  for (const pattern of patterns) assert.match(pattern, /\\b/, `pattern without a word boundary would match inside other words: ${pattern}`);
});
