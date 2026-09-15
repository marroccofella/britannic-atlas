// The MOMM conversation view: coloured lanes, one British voice per model,
// a live event reducer, and a spoken script. Pure-module tests plus source
// contracts for the wiring in app.js, index.html, style.css and the server.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_ORDER, agentStyle, assignVoices, buildConversationScript, completionOrder, createConversationState, formatDuration, humanReviewerStatus, progressOf, reduceDeliberationEvent, usageLine, verdictWord } from "../public/momm-conversation.mjs";
import { projectDispatcherEvent } from "../lib/deliberate.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ORACLE, file), "utf8");

test("every known model has its own colour, unknown ones get a stable fallback, oracle is distinct", () => {
  const colours = new Set(AGENT_ORDER.map((a) => agentStyle(a).colour));
  assert.equal(colours.size, AGENT_ORDER.length, "no two models share a colour");
  assert.notEqual(agentStyle("oracle").colour, agentStyle("codex").colour);
  assert.equal(agentStyle("CODEX").agent, "codex", "agent names are normalised");
  assert.equal(agentStyle("mystery-model").colour, agentStyle("mystery-model").colour, "fallback colour is deterministic");
  assert.match(agentStyle("<img onerror=x>").agent, /^[a-z0-9_-]*$/, "hostile agent names are stripped before becoming CSS or labels");
});

test("each model gets a different British voice, natural voices first, and Oracle keeps the user's voice", () => {
  const voices = [
    { name: "Microsoft George - English (United Kingdom)", lang: "en-GB" },
    { name: "Microsoft Hazel - English (United Kingdom)", lang: "en-GB" },
    { name: "Microsoft Ryan Online (Natural) - English (United Kingdom)", lang: "en-GB" },
    { name: "Microsoft Sonia Online (Natural) - English (United Kingdom)", lang: "en-GB" },
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Google Deutsch", lang: "de-DE" },
  ];
  const map = assignVoices(voices, { mainVoiceName: "Microsoft George - English (United Kingdom)" });
  assert.equal(map.get("oracle").voice.name, "Microsoft George - English (United Kingdom)", "the user's chosen voice stays Oracle's");
  const reviewerVoices = ["codex", "copilot", "grok"].map((a) => map.get(a).voice.name);
  assert.equal(new Set(reviewerVoices).size, 3, "the first three models sound different from each other");
  for (const name of reviewerVoices) assert.notEqual(name, "Microsoft George - English (United Kingdom)", "no reviewer borrows Oracle's voice");
  for (const name of reviewerVoices) assert.match(name, /United Kingdom/, "British voices are preferred over American and German ones");
  assert.match(map.get("codex").voice.name, /Natural/, "natural voices are handed out first");
});

test("with fewer voices than models the pitch changes so two models never sound identical", () => {
  const voices = [{ name: "Microsoft George - English (United Kingdom)", lang: "en-GB" }, { name: "Microsoft Hazel - English (United Kingdom)", lang: "en-GB" }];
  const map = assignVoices(voices, { mainVoiceName: "Microsoft George - English (United Kingdom)" });
  const a = map.get("codex"), b = map.get("copilot");
  assert.equal(a.voice.name, b.voice.name, "only one non-Oracle voice exists, so it is reused");
  assert.notEqual(a.pitch, b.pitch, "but at a different pitch");
  const none = assignVoices([], {});
  assert.equal(none.get("codex").voice, null);
  assert.equal(none.get("oracle").voice, null, "an empty voice list degrades gracefully");
});

test("the live reducer follows a review from convening to finished without mutating its input", () => {
  const start = createConversationState("e_1");
  const frozen = JSON.stringify(start);
  let s = reduceDeliberationEvent(start, { status: "started" }, 1000);
  assert.equal(JSON.stringify(start), frozen, "reducer is pure");
  assert.equal(s.phase, "convening");
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "dispatch", reviewers: ["codex", "COPILOT", "grok"] }, 1100);
  assert.deepEqual(s.reviewers, ["codex", "copilot", "grok"]);
  assert.equal(progressOf(s).total, 3);
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.started", agent: "codex" }, 1200);
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.started", agent: "copilot" }, 1200);
  assert.equal(s.lanes.codex.phase, "thinking");
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.retry", agent: "copilot", reason: "provider 503" }, 2000);
  assert.equal(s.lanes.copilot.phase, "retrying");
  assert.equal(s.lanes.copilot.retry, "provider 503");
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.completed", agent: "copilot", reviewerStatus: "success", verdict: "MODIFY", findings: 2, critical: 1, attempts: 2, durationMs: 4200 }, 5400);
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.completed", agent: "codex", reviewerStatus: "success", verdict: "ACCEPT", findings: 0, critical: 0, attempts: 1, durationMs: 9000 }, 10200);
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.completed", agent: "grok", reviewerStatus: "invalid_output" }, 10300);
  assert.equal(s.lanes.copilot.phase, "done");
  assert.equal(s.lanes.grok.phase, "unavailable");
  assert.deepEqual(completionOrder(s), ["copilot", "codex", "grok"], "lanes are ordered by when they actually finished");
  assert.equal(progressOf(s).done, 3);
  s = reduceDeliberationEvent(s, { status: "reviewing", event: "final" }, 10400);
  assert.equal(s.phase, "synthesising");
  s = reduceDeliberationEvent(s, { status: "finished", runId: "rev_x" }, 12000);
  assert.equal(s.phase, "finished");
  assert.equal(s.runId, "rev_x");
  assert.equal(reduceDeliberationEvent(s, { status: "reviewing", event: "reviewer.completed", agent: "codex", findings: 99999 }).lanes.codex.findings, 0, "absurd counts are dropped");
  assert.equal(reduceDeliberationEvent(createConversationState("e"), { status: "failed", reason: "x".repeat(500) }).error.length, 160, "errors are bounded");
});

test("the spoken script gives every model its own turn in completion order and ends with Oracle", () => {
  let state = createConversationState("e_2");
  state = reduceDeliberationEvent(state, { status: "reviewing", event: "reviewer.completed", agent: "grok", reviewerStatus: "success", verdict: "ACCEPT" }, 2);
  state = reduceDeliberationEvent(state, { status: "reviewing", event: "reviewer.completed", agent: "codex", reviewerStatus: "success", verdict: "MODIFY" }, 5);
  const review = {
    reviewers: [
      { agent: "codex", status: "success", verdict: "MODIFY", confidence: 0.9, summary: "The date is wrong." },
      { agent: "grok", status: "success", verdict: "ACCEPT", confidence: 0.4, summary: "Looks right." },
      { agent: "antigravity", status: "invalid_output" },
    ],
    findings: [{ severity: "CRITICAL", title: "Tynwald Day is 5 July, not 5 June", reviewers: ["codex"] }],
  };
  const script = buildConversationScript({ review, result: { ok: true, answer: "Tynwald Day is 5 July.", corrections: ["Corrected the date"] }, state, allowance: { used: 2, limit: 6 } });
  assert.equal(script[0].agent, "oracle");
  assert.match(script[0].text, /2 of 3 reviewers completed\. This was review 2 of 6 this hour\./);
  assert.deepEqual(script.slice(1, 4).map((l) => l.agent), ["grok", "codex", "antigravity"], "grok finished first so speaks first; the unavailable one is last");
  assert.match(script[2].text, /^Codex, verdict modify, 90 per cent confident\. The date is wrong\. Codex raised 1 point: critical, Tynwald Day is 5 July/);
  assert.match(script[3].text, /Antigravity returned an unusable reply\./);
  assert.match(script.at(-2).text, /^What changed: Corrected the date\./);
  assert.match(script.at(-1).text, /^MOMM's considered answer\. Tynwald Day is 5 July\./);
  for (const line of script) assert.doesNotMatch(line.text, /[<>]/, "spoken lines carry no markup");
  const failed = buildConversationScript({ review, result: { ok: false, reason: "no successful peer reviews" } });
  assert.match(failed.at(-1).text, /could not be completed: no successful peer reviews/);
});

test("usage and status helpers read naturally", () => {
  assert.equal(formatDuration(4200), "4s");
  assert.equal(formatDuration(192_000), "3m 12s");
  assert.equal(verdictWord("ACCEPT"), "accept");
  assert.equal(verdictWord(null), "no verdict");
  assert.match(humanReviewerStatus("authentication_required"), /sign-in/);
  assert.match(humanReviewerStatus("made-up"), /unknown status/);
  let state = createConversationState("e");
  state = reduceDeliberationEvent(state, { status: "reviewing", event: "dispatch", reviewers: ["codex", "grok"] }, 0);
  state = reduceDeliberationEvent(state, { status: "reviewing", event: "reviewer.completed", agent: "codex", reviewerStatus: "success" }, 1);
  assert.equal(usageLine({ state, allowance: { used: 3, limit: 6 }, costUsd: 0.0123, durationMs: 65_000 }), "3 of 6 reviews used this hour · 1/2 reviewers done · 1m 05s · synthesis $0.012");
  const live = reduceDeliberationEvent(state, { status: "started" }, 10_000);
  assert.equal(live.startedAt, 10_000, "a timestamp of zero must not read as unset");
  assert.equal(usageLine({ state: live, allowance: { used: 1, limit: 6 }, costUsd: null, durationMs: null, now: 14_000 }), "1 of 6 reviews used this hour · 1/2 reviewers done · 4s elapsed", "before synthesis there is no cost or total to show, and null must not read as zero");
});

test("the server projects dispatcher events onto a closed shape and never lets a reviewer status masquerade as the deliberation status", () => {
  const completed = projectDispatcherEvent({ event: "reviewer.completed", reviewer: "codex", status: "success", verdict: "MODIFY", findings: 3, critical: 1, attempts: 2, duration_ms: 12345, secret: "leak" });
  assert.deepEqual(completed, { event: "reviewer.completed", agent: "codex", reviewerStatus: "success", verdict: "MODIFY", findings: 3, critical: 1, attempts: 2, durationMs: 12345 });
  assert.equal("status" in completed, false, "the reviewer's status must not overwrite status: reviewing when merged");
  assert.equal(projectDispatcherEvent({ event: "reviewer.completed", reviewer: "grok", status: "made_up", verdict: "MAYBE", findings: -1, duration_ms: 1e12 }).reviewerStatus, "unknown_status");
  assert.equal(projectDispatcherEvent({ event: "reviewer.completed", reviewer: "grok", status: "made_up", verdict: "MAYBE", findings: -1 }).verdict, null);
  assert.equal(projectDispatcherEvent({ event: "reviewer.completed", reviewer: "grok", findings: -1 }).findings, null);
  assert.deepEqual(projectDispatcherEvent({ event: "dispatch", reviewers: ["codex", "co pilot!", 42, "grok"] }).reviewers, ["codex", "copilot", "42", "grok"]);
  assert.equal(projectDispatcherEvent({ event: "reviewer.retry", reviewer: "copilot", reason: "x".repeat(300) }).reason.length, 80);
  assert.equal(projectDispatcherEvent({ nope: true }), null);
  assert.equal(projectDispatcherEvent("string"), null);
});

test("the client, markup, styles and server are wired for the conversation view", () => {
  const app = read("public/app.js"), html = read("public/index.html"), css = read("public/style.css"), server = read("server.mjs"), deliberate = read("lib/deliberate.mjs");
  assert.match(html, /class="reviewConversation hidden"/);
  assert.match(app, /from "\.\/momm-conversation\.mjs"/);
  assert.match(app, /es\.addEventListener\("momm\.deliberation"/);
  assert.match(app, /function renderConversationLive\(/);
  assert.match(app, /function revealConversation\(/);
  assert.match(app, /function playConversation\(/);
  assert.match(app, /assignVoices\(voices, \{ mainVoiceName: voice\?\.name \}\)/, "playback uses the user's current voice list and reserves their voice for Oracle");
  assert.match(app, /item\.voice \|\| voice/, "say() honours a per-line voice");
  assert.match(app, /for \(const hook of playbackHooks\) hook\(\)/, "interrupting speech clears lane highlights");
  assert.match(app, /hush\(\{ cancelAnswer: false, preserveListening: true \}\)/, "stopping playback never cancels a running review");
  assert.match(app, /prefers-reduced-motion: reduce/, "the typewriter reveal respects reduced motion");
  assert.match(app, /MOMM's considered answer/);
  assert.match(css, /\.lane\.speaking/);
  assert.match(css, /\.lane\.thinking \.laneDot/);
  assert.match(css, /@keyframes pop/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{[^}]*\.lane/s, "lane animations are disabled under reduced motion");
  assert.match(server, /reviewers: \(Array\.isArray\(row\.reviewers\)/, "findings carry which models raised them so lanes and voices match");
  assert.match(server, /costUsd,\s*durationMs,\s*allowance: usage/, "the review response reports cost, duration and the shared hourly allowance");
  assert.match(deliberate, /if \(projected\) onEvent\?\.\(projected\)/, "dispatcher events pass through the closed projection only");
  assert.doesNotMatch(app, /innerHTML\s*=\s*`[^`]*\$\{[^}]*(summary|title|agent|reason)/, "no reviewer text is interpolated into HTML");
});

test("a paid review button is never offered for an answer the server would refuse", async () => {
  const { episodeReviewable } = await import("../lib/deliberate.mjs");
  // The real failure: the model stream produced nothing, an episode was still
  // recorded, and the browser grew a Think harder button that failed closed.
  assert.equal(episodeReviewable({ answer: "", resolvedQuestion: "Answer this for the Isle of Man: what kind of shoes on flag", status: "model_prior", kind: "answer" }), false);
  assert.equal(episodeReviewable({ answer: "   ", resolvedQuestion: "q", status: "model_prior" }), false);
  assert.equal(episodeReviewable({ answer: "Short but real.", resolvedQuestion: "q", status: "model_prior" }), true, "a short answer is still an answer");
  assert.equal(episodeReviewable({ answer: "Tynwald Day is the Isle of Man's National Day.", resolvedQuestion: "q", status: "model_prior", kind: "answer" }), true);
  assert.equal(episodeReviewable({ answer: "A full and perfectly good Manx answer.", resolvedQuestion: "", status: "model_prior" }), false, "no resolved question, nothing to review against");
  assert.equal(episodeReviewable({ answer: "A full and perfectly good Manx answer.", resolvedQuestion: "q", status: "local" }), false);
  for (const kind of ["local", "capability", "action", "clarify", "control"]) {
    assert.equal(episodeReviewable({ answer: "A full and perfectly good Manx answer.", resolvedQuestion: "q", status: "model_prior", kind }), false, `${kind} answers are ineligible`);
  }
  const brain = read("lib/brain.mjs"), app = read("public/app.js");
  assert.match(brain, /reviewable:[^\n]*answered: spokenAnswer\.length > 0/, "the answer route reports both flags");
  assert.match(brain, /episodeReviewable\(\{ answer: spokenAnswer/, "the answer route asks the same question the deliberation route will ask");
  assert.match(app, /d\.answered !== false/, "an answer that never arrived gets no vote or review controls");
  assert.match(app, /d\.reviewable !== false/);
  assert.match(app, /That answer did not arrive/);
});

test("a failed review explains itself inside the conversation panel", () => {
  const app = read("public/app.js");
  assert.match(app, /appendTextElement\(entry\.panel, "p", message, "canvasError"\)/, "the reason goes in the panel, not only a separate error box");
});
