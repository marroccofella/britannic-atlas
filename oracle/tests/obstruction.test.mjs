// A user asked about the Bee Gees three times. Each turn was refused with "I'm
// not certain that was a question for me", the refusals were never remembered,
// and Oracle then told the user no band had been named in the conversation.
// It also held a verified ledger claim that the Bee Gees were born in Douglas.
// Test candidates called the product useless, and they were right.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createDialogueState, resolveDialogue } from "../lib/dialogue.mjs";

const clear = { source: "speech", recognitionConfidence: 0.95 };
const route = (text, state = createDialogueState(), options = clear) => resolveDialogue(text, state, options);

test("a request addressed to Oracle is answered, whatever mood it is in", () => {
  for (const request of [
    "Sing a song by the Bee Gees.",              // imperative
    "Tell me about the Bee Gees",                // imperative
    "They are from the Isle of Man Fulfil my request.", // explicit request marker
    "I thought I mentioned the Bee Gees.",       // first person, about this exchange
    "Can you state the lyrics of their songs?",  // second person question
    "Please give me the Manx national anthem",   // please plus imperative
  ]) assert.notEqual(route(request).route, "clarify", `refused a genuine request: ${request}`);
});

test("overheard speech and bare fragments are still not answered", () => {
  for (const ambient of [
    "Road infrastructure is in the news today",
    "There are maps on the table",
    "The radio said tell me about infrastructure and then stopped",
    "Hundreds of wildfires continue across the country",
    "Well.",
    "Some dump cloth.",
  ]) assert.equal(route(ambient).route, "clarify", `answered overheard speech: ${ambient}`);
  assert.equal(route("odd words from the television", createDialogueState(), { source: "speech", recognitionConfidence: 0.2 }).route, "clarify");
});

test("a queried turn is still remembered, so a later pronoun has something to attach to", () => {
  let state = createDialogueState();
  const first = route("Mmm.", state);
  assert.equal(first.route, "clarify");
  state = first.state;
  assert.deepEqual(state.recentUtterances, ["Mmm."], "forgetting queried turns is what made Oracle deny the Bee Gees were raised");
  const second = route("Right.", state);
  assert.deepEqual(second.state.recentUtterances, ["Mmm.", "Right."]);
  // Bounded, and a repeat does not accumulate.
  let bounded = createDialogueState();
  for (let i = 0; i < 12; i += 1) bounded = route(`Hm${i}.`, bounded).state;
  assert.ok(bounded.recentUtterances.length <= 6);
  const repeated = route("Hm11.", bounded).state;
  assert.equal(repeated.recentUtterances.filter((line) => line === "Hm11.").length, 1);
});

test("the query message no longer blames the user or claims a scope problem", () => {
  const refused = route("There are maps on the table");
  assert.match(refused.speech, /could not make out a request/);
  assert.doesNotMatch(refused.speech, /still focused on the Isle of Man/, "an unclear utterance is not a scope violation");
  assert.doesNotMatch(refused.speech, /not certain that was a question/);
});

test("typed input is never described as something Oracle heard", () => {
  const typed = resolveDialogue("There are maps on the table", createDialogueState(), { source: "typed" });
  assert.notEqual(typed.route, "clarify", "typed text is deliberate and is never second-guessed as mishearing");
});
