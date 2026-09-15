import { test } from "node:test";
import assert from "node:assert/strict";
import { answer } from "../lib/brain.mjs";
import { KnowledgeBase, ftsQuery } from "../lib/kb.mjs";
import { CAPABILITY_MANIFEST, createDialogueState, DialogueSessions, repairTranscript, resolveDialogue } from "../lib/dialogue.mjs";
import { assessSpeech, suggestSpeechRepair } from "../public/speech.mjs";

test("a new conversation is Isle of Man by default", () => {
  const state = createDialogueState(1);
  assert.equal(state.homeJurisdiction, "Isle of Man");
  const turn = resolveDialogue("What are the company requirements?", state);
  assert.equal(turn.jurisdiction, "Isle of Man");
  assert.match(turn.canonical, /specifically for the Isle of Man/i);
});

test("every built-in Manx map action is described by the fixed capability manifest", () => {
  const map = resolveDialogue("show me a map", createDialogueState());
  assert.equal(CAPABILITY_MANIFEST.artifacts[map.action.artifact.id].id, map.action.artifact.id);
  assert.equal(CAPABILITY_MANIFEST.artifacts[map.action.artifact.id].navigationSafe, false);
  assert.ok(CAPABILITY_MANIFEST.mapProviders.length >= 4);
});

test("draw me a mao is a zero-model Manx map action, but Mao remains a name", async () => {
  const map = resolveDialogue("draw me a mao", createDialogueState());
  assert.equal(map.route, "action");
  assert.equal(map.action.kind, "show_manx_map");
  assert.ok(map.semanticKey);
  assert.equal(map.action.href, "/manx-map.svg");
  assert.equal(map.action.fullHref, "https://britannica-atlas.marroccofella.chatgpt.site/manx/earth");
  assert.match(map.interpretedAs, /map/i);

  const person = resolveDialogue("Who was Mao Zedong?", createDialogueState());
  assert.equal(person.route, "answer");
  assert.match(person.canonical, /Mao zedong/i);
  assert.doesNotMatch(person.canonical, /map zedong/i);

  let paidCalls = 0;
  const events = [];
  const result = await answer({ kb: null, question: map.raw, resolution: map, sessionId: "s", emit: (type, data) => events.push({ type, data }), runModel: async () => { paidCalls += 1; } });
  assert.equal(paidCalls, 0);
  assert.equal(result.local, true);
  assert.ok(events.some((event) => event.type === "action" && event.data.kind === "show_manx_map"));
  assert.ok(events.findIndex((event) => event.type === "action") < events.findIndex((event) => event.type === "sentence"), "show the map before narration");
  assert.ok(events.some((event) => event.type === "meta" && event.data.costUsd === 0));
});

test("broad infrastructure is a valid Manx request, not a clarification", () => {
  const turn = resolveDialogue("tell me about infastructure", createDialogueState());
  assert.equal(turn.route, "answer");
  assert.equal(turn.state.activeTopic, "infrastructure");
  assert.equal(turn.jurisdiction, "Isle of Man");
  assert.match(turn.canonical, /Isle of Man infrastructure/i);
  assert.match(turn.canonical, /ports and shipping/i);
  assert.match(turn.canonical, /telecommunications/i);
  assert.match(turn.interpretedAs, /infrastructure/i);
});

test("the exact failed four-turn transcript retains Manx infrastructure context", () => {
  let state = createDialogueState();
  const map = resolveDialogue("draw me a mao", state); state = map.state;
  const infrastructure = resolveDialogue("tell me about infastructure", state); state = infrastructure.state;
  const allInfo = resolveDialogue("manz and akk unfo", state); state = allInfo.state;
  const needAll = resolveDialogue("i beed to know all", state);

  assert.equal(map.route, "action");
  for (const turn of [infrastructure, allInfo, needAll]) {
    assert.equal(turn.route, "answer");
    assert.equal(turn.jurisdiction, "Isle of Man");
    assert.match(turn.canonical, /Isle of Man infrastructure/i);
  }
  assert.equal(allInfo.state.breadth, "comprehensive");
  assert.equal(needAll.state.breadth, "comprehensive");
  assert.match(allInfo.interpretedAs, /Manx and all info/i);
  assert.match(needAll.interpretedAs, /I need to know all/i);
});

test("the exact failed nine-turn transcript stays contextual, Manx-first and spend-intentional", () => {
  const sessions = new DialogueSessions();
  const sessionId = "golden-nine-turns";
  const speech = (clientTurn) => ({ source: "speech", recognitionConfidence: 0.9, turnId: `turn-${clientTurn}`, clientTurn });
  const turns = [];

  const population = sessions.resolve(sessionId, "How many people living Manx currently?", speech(1));
  turns.push(population);
  sessions.markInFlight(sessionId, population);
  sessions.complete(sessionId, population.semanticKey, {
    pendingAction: { kind: "research", subject: population.canonical, status: "offered", label: "the current Manx population" },
  });

  turns.push(sessions.resolve(sessionId, "Yes, do your research and get me the.", speech(2)));
  turns.push(sessions.resolve(sessionId, "Show me a map of the Isle of Man", speech(3)));
  turns.push(sessions.resolve(sessionId, "Can you see the map that you just produced?", speech(4)));
  turns.push(sessions.resolve(sessionId, "You're talking over the top of me when I'm speaking. Did you grender that map or did you copy it from somewhere? Is it accurate? Is it the best you can do? Can you do a 3D model of the of the map so you can zoom in? As well as also having links within the map to St Maps and Google Maps and Google Earth and any other independent maps that would help somebody navigate including?", speech(5)));
  turns.push(sessions.resolve(sessionId, "Yes, I asked you to use your suggestion for getting the better results.", speech(6)));
  turns.push(sessions.resolve(sessionId, "Still not good enough.", speech(7)));

  const overview = sessions.resolve(sessionId, "Tell me about the Isle of Man.", speech(8));
  turns.push(overview);
  sessions.markInFlight(sessionId, overview);
  sessions.complete(sessionId, overview.semanticKey);
  turns.push(sessions.resolve(sessionId, "Go deeper on old you suggested.", speech(9)));

  assert.deepEqual(turns.map((turn) => turn.route), [
    "answer", "research", "action", "capability", "capability", "action", "repair", "answer", "research",
  ]);
  assert.ok(turns.every((turn) => turn.jurisdiction === "Isle of Man"));
  assert.equal(turns[1].canonical, population.canonical, "the first yes executes only the offered population research");
  assert.equal(turns[3].action.kind, "describe_manx_map");
  assert.equal(turns[4].action.kind, "describe_manx_map");
  assert.equal(turns[5].action.kind, "open_full_map", "the second yes executes the currently displayed map's offer");
  assert.equal(turns[6].canonical, turns[4].canonical, "the complaint repairs the current map explanation");
  assert.equal(turns[8].canonical, overview.canonical, "the final deepening follows the latest completed substantive answer");
  assert.equal(turns[8].state.lastArtifact.id, "manx-map");
});

test("speech repair explanations never repeat the same label", () => {
  const repaired = repairTranscript("draw me a mao and see the mao", createDialogueState());
  assert.deepEqual(repaired.repairs, ["mao → map"]);
});

test("the golden transcript resolves contextual affirmations without treating them as ambient speech", () => {
  const answered = resolveDialogue("What is the latest official resident population?", createDialogueState(), { turnId: "turn-population", clientTurn: 4 });
  const subject = "Investigate current Isle of Man population using the latest official release.";
  const pending = {
    ...answered.state,
    lastCompletedKey: answered.semanticKey,
    pendingAction: {
      kind: "research",
      subject,
      status: "running",
      id: "x_population",
      origin: { kind: "turn", semanticKey: answered.semanticKey, turnId: "turn-population", clientTurn: 4 },
    },
  };
  const speech = { source: "speech", recognitionConfidence: 0.9 };

  for (const raw of [
    "Yes, do your research and get me the.",
    "Yes, I asked you to use your suggestion for getting the better results.",
  ]) {
    const turn = resolveDialogue(raw, pending, speech);
    assert.equal(turn.route, "ack");
    assert.equal(turn.canonical, subject);
    assert.equal(turn.pendingAction.kind, "research");
    assert.equal(turn.pendingAction.status, "running");
    assert.match(turn.speech, /already.*(?:research|check)|(?:research|check).*already/i);
    assert.equal(turn.state.lastSubstantiveQuestion, answered.canonical);
  }
});

test("an affirmation without a pending action remains a zero-cost clarification", () => {
  const turn = resolveDialogue("Yes, do that.", createDialogueState(), { source: "speech", recognitionConfidence: 0.9 });
  assert.equal(turn.route, "clarify");
  assert.equal(turn.canonical, null);
  assert.equal(turn.state.pendingAction, null);
});

test("use your suggestion without a separately recorded offer never guesses from an older answer", () => {
  const answered = resolveDialogue("Tell me about the Isle of Man.", createDialogueState(), { turnId: "turn-overview", clientTurn: 1 });
  const state = { ...answered.state, lastCompletedKey: answered.semanticKey };
  const turn = resolveDialogue("Use your suggestion.", state, { source: "speech", recognitionConfidence: 0.9, turnId: "turn-yes", clientTurn: 2 });
  assert.equal(turn.route, "clarify");
  assert.equal(turn.canonical, null);
  assert.equal(turn.state.pendingAction, null);
});

test("contextual yes synonyms accept the offer; an ambiguous reference does not", () => {
  const answered = resolveDialogue("What is the latest official resident population?", createDialogueState(), { turnId: "strict-offer", clientTurn: 1 });
  const pending = {
    ...answered.state,
    lastCompletedKey: answered.semanticKey,
    pendingAction: { kind: "research", subject: answered.canonical, status: "offered", origin: { kind: "turn", semanticKey: answered.semanticKey, turnId: "strict-offer", clientTurn: 1 } },
  };
  assert.equal(resolveDialogue("yep",pending,{source:"speech",recognitionConfidence:.9}).route,"research");
  for (const raw of ["your idea"]) {
    const result = resolveDialogue(raw, pending, { source: "speech", recognitionConfidence: 0.9 });
    assert.equal(result.route, "clarify");
    assert.notEqual(result.route, "research");
  }
});

test("referential deepening binds to the pending suggestion, including the golden speech mishearing", () => {
  const answered = resolveDialogue("Tell me about the Isle of Man.", createDialogueState(), { turnId: "turn-overview", clientTurn: 7 });
  const subject = "Investigate current Isle of Man population using the latest official release.";
  const state = {
    ...answered.state,
    lastCompletedKey: answered.semanticKey,
    pendingAction: {
      kind: "research",
      subject,
      status: "offered",
      label: "check the latest population",
      origin: { kind: "turn", semanticKey: answered.semanticKey, turnId: "turn-overview", clientTurn: 7 },
    },
  };
  const speech = { source: "speech", recognitionConfidence: 0.9 };

  for (const raw of ["Go deeper on what you suggested.", "Go deeper on old you suggested."]) {
    const turn = resolveDialogue(raw, state, speech);
    assert.equal(turn.route, "research");
    assert.equal(turn.canonical, subject);
    assert.equal(turn.pendingAction.kind, "research");
    assert.equal(turn.pendingAction.status, "offered");
    assert.equal(turn.state.lastSubstantiveQuestion, state.lastSubstantiveQuestion);
  }
});

test("a later substantive answer invalidates an older offer before a stale yes can execute it", () => {
  const first = resolveDialogue("What is the current population?", createDialogueState(), { turnId: "turn-one", clientTurn: 1 });
  const withOffer = {
    ...first.state,
    lastCompletedKey: first.semanticKey,
    pendingAction: {
      kind: "research",
      subject: first.canonical,
      status: "offered",
      origin: { kind: "turn", semanticKey: first.semanticKey, turnId: "turn-one", clientTurn: 1 },
    },
  };
  const second = resolveDialogue("What are the company requirements?", withOffer, { turnId: "turn-two", clientTurn: 2 });
  assert.equal(second.state.pendingAction, null);
  assert.deepEqual(second.state.lastSubstantiveTurn, {
    question: second.canonical,
    semanticKey: second.semanticKey,
    turnId: "turn-two",
    clientTurn: 2,
  });

  const staleYes = resolveDialogue("Yes, do that.", { ...second.state, lastCompletedKey: second.semanticKey }, { source: "speech", recognitionConfidence: 0.9, turnId: "turn-three", clientTurn: 3 });
  assert.equal(staleYes.route, "clarify");
  assert.equal(staleYes.canonical, null);
});

test("a pending continuation must match the most recently completed substantive turn", () => {
  const current = resolveDialogue("What are the company requirements?", createDialogueState(), { turnId: "turn-current", clientTurn: 8 });
  const stale = {
    ...current.state,
    lastCompletedKey: current.semanticKey,
    pendingAction: {
      kind: "research",
      subject: "An older population question",
      status: "offered",
      origin: { kind: "turn", semanticKey: "older-question", turnId: "turn-old", clientTurn: 2 },
    },
  };
  const turn = resolveDialogue("Yes, do that.", stale, { source: "speech", recognitionConfidence: 0.9 });
  assert.equal(turn.route, "clarify");
  assert.equal(turn.canonical, null);
  assert.equal(turn.state.pendingAction, null);
});

test("session completion closes a continuation over its originating turn identity", () => {
  const sessions = new DialogueSessions();
  const turn = sessions.resolve("offer", "What is the current population?", { turnId: "turn-pop", clientTurn: 11 });
  sessions.markInFlight("offer", turn);
  const completed = sessions.complete("offer", turn.semanticKey, {
    pendingAction: { kind: "research", subject: turn.canonical, status: "offered", label: "verify the population" },
  });
  assert.deepEqual(completed.pendingAction.origin, {
    kind: "turn",
    semanticKey: turn.semanticKey,
    turnId: "turn-pop",
    clientTurn: 11,
  });
});

test("a complaint repairs the last substantive answer instead of becoming ambient speech or a new fact question", () => {
  const subject = "Answer this specifically for the Isle of Man: Tell me about the Isle of Man.";
  const state = {
    ...createDialogueState(),
    lastActionable: subject,
    lastSubstantiveQuestion: subject,
  };
  const turn = resolveDialogue("Still not good enough.", state, { source: "speech", recognitionConfidence: 0.9 });
  assert.equal(turn.route, "repair");
  assert.equal(turn.canonical, subject);
  assert.equal(turn.state.lastSubstantiveQuestion, subject);
  assert.match(turn.speech, /what should I improve|accuracy|detail/i);
});

test("map capability questions are distinct from commands to display the map", () => {
  const shown = resolveDialogue("Show me a map of the Isle of Man", createDialogueState());
  assert.equal(shown.route, "action");
  assert.equal(shown.action.kind, "show_manx_map");
  assert.equal(shown.state.lastArtifact.kind, "manx_map");
  assert.equal(shown.state.lastArtifact.navigationSafe, false);

  const capability = resolveDialogue("Can you see the map that you just produced?", shown.state, { source: "speech", recognitionConfidence: 0.9 });
  assert.equal(capability.route, "capability");
  assert.equal(capability.action.kind, "describe_manx_map");
  assert.equal(capability.state.lastArtifact.kind, "manx_map");
  assert.match(capability.speech, /cannot see your screen|can’t see your screen/i);
  assert.match(capability.speech, /diagrammatic/i);

  const compound = resolveDialogue("You're talking over the top of me when I'm speaking. Did you grender that map or did you copy it from somewhere? Is it accurate? Is it the best you can do? Can you do a 3D model of the map so you can zoom in?", shown.state, { source: "speech", recognitionConfidence: 0.9 });
  assert.equal(compound.route, "capability");
  assert.equal(compound.action.kind, "describe_manx_map");
  assert.match(compound.speech, /not for navigation/i);
  assert.match(compound.speech, /Google Earth/i);
});

test("map display preserves the last substantive question while making the map the current artifact", () => {
  const population = resolveDialogue("What is the current population?", createDialogueState());
  const shown = resolveDialogue("Show me a map of the Isle of Man", population.state);
  assert.equal(shown.state.lastSubstantiveQuestion, population.canonical);
  assert.equal(shown.state.lastActionable, population.canonical);
  assert.equal(shown.state.lastArtifact.kind, "manx_map");
  assert.equal(shown.state.pendingAction.kind, "open_full_map");
  assert.equal(shown.state.pendingAction.subject, shown.canonical);
  assert.deepEqual(shown.state.pendingAction.origin, { kind: "artifact", artifactId: "manx-map", turnId: null, clientTurn: null });

  const shownAgain = resolveDialogue("Show me the map again", shown.state, { turnId: "turn-map-again", clientTurn: 9 });
  assert.equal(shownAgain.state.lastArtifact.id, shown.state.lastArtifact.id, "map identity must be stable across repeat displays");
  assert.equal(shownAgain.state.pendingAction.origin.artifactId, shown.state.lastArtifact.id);
});

test("all, tell me and figure it out bind to the active topic", () => {
  const first = resolveDialogue("Tell me about infrastructure", createDialogueState());
  for (const raw of ["all", "tell me", "figure it out"]) {
    const turn = resolveDialogue(raw, first.state);
    assert.equal(turn.route, "answer");
    assert.match(turn.canonical, /Isle of Man infrastructure/i);
    assert.notEqual(turn.canonical.toLowerCase(), raw);
  }
  assert.equal(resolveDialogue("all", createDialogueState()).route, "clarify");
});

test("a complete Manx question replaces the previous specialised topic", () => {
  const infrastructure = resolveDialogue("Tell me about infrastructure", createDialogueState());
  const tax = resolveDialogue("What about tax?", infrastructure.state);
  const more = resolveDialogue("tell me more", tax.state);
  assert.equal(tax.state.activeTopic, "general");
  assert.equal(more.canonical, tax.canonical);
  assert.doesNotMatch(more.canonical, /infrastructure/i);
});

test("an already-working acknowledgement never mutates durable conversation state", () => {
  const infrastructure = resolveDialogue("Tell me about infrastructure", createDialogueState());
  const active = { ...infrastructure.state, inFlightKey: infrastructure.semanticKey };
  const duplicate = resolveDialogue("Tell me about infrastructure", active);
  assert.equal(duplicate.route, "ack");
  assert.equal(duplicate.semanticKey, infrastructure.semanticKey);
  for (const key of ["activeTopic", "activeFacets", "breadth", "lastActionable", "inFlightKey"]) {
    assert.deepEqual(duplicate.state[key], active[key], key);
  }

  const foreign = resolveDialogue("What is company law in Jersey?", infrastructure.state);
  const foreignActive = { ...foreign.state, inFlightKey: foreign.semanticKey };
  const foreignDuplicate = resolveDialogue("What is company law in Jersey?", foreignActive);
  const resumed = resolveDialogue("tell me more", foreignDuplicate.state);
  assert.equal(resumed.jurisdiction, "Isle of Man");
  assert.match(resumed.canonical, /Isle of Man infrastructure/i);
  assert.doesNotMatch(resumed.canonical, /Jersey/i);
});

test("an explicit foreign place overrides one turn without replacing the Manx home", () => {
  const jersey = resolveDialogue("What is company law in Jersey?", createDialogueState());
  assert.equal(jersey.jurisdiction, "Jersey");
  assert.equal(jersey.state.homeJurisdiction, "Isle of Man");
  const next = resolveDialogue("What about tax?", jersey.state);
  assert.equal(next.jurisdiction, "Isle of Man");
  assert.match(next.canonical, /specifically for the Isle of Man/i);
});

test("specialised routes respect an explicit foreign jurisdiction without replacing the visible Manx home", async () => {
  const map = resolveDialogue("Show me a map of Jersey", createDialogueState());
  assert.equal(map.route, "action");
  assert.equal(map.jurisdiction, "Jersey");
  assert.ok(map.semanticKey);
  assert.equal(map.action.kind, "show_external_map");
  assert.match(map.action.href, /^https:\/\/www\.openstreetmap\.org\/search\?query=Jersey$/);
  assert.doesNotMatch(map.canonical, /Isle of Man/i);
  const events = [];
  await answer({ kb: null, question: map.raw, resolution: map, sessionId: "jersey-map", emit: (type, data) => events.push({ type, data }) });
  assert.deepEqual(events.find((event) => event.type === "scope")?.data, {
    jurisdiction: "Jersey",
    source: "explicit",
    persistent: false,
    announcement: "Switching to Jersey for this answer only. Your next unqualified follow-up returns to the Isle of Man.",
  });

  const infrastructure = resolveDialogue("Tell me about Jersey infrastructure", createDialogueState());
  assert.equal(infrastructure.route, "answer");
  assert.equal(infrastructure.jurisdiction, "Jersey");
  assert.match(infrastructure.canonical, /Jersey infrastructure/i);
  assert.doesNotMatch(infrastructure.canonical, /Isle of Man infrastructure/i);
});

test("confirmed low-confidence speech is answered instead of challenged twice", () => {
  const options = { source: "speech", recognitionConfidence: 0.1 };
  assert.equal(resolveDialogue("Who is the Chief Minister?", createDialogueState(), options).route, "clarify");
  assert.equal(resolveDialogue("Who is the Chief Minister?", createDialogueState(), { ...options, confirmed: true }).route, "answer");
});

test("uncertain or ambient speech is clarified locally", () => {
  const uncertain = resolveDialogue("odd words from the television", createDialogueState(), { source: "speech", recognitionConfidence: 0.2 });
  assert.equal(uncertain.route, "clarify");
  // An utterance Oracle could not parse is not a scope violation, and saying
  // so made the product read as obstructive rather than unsure.
  assert.match(uncertain.speech, /could not make out a request/i);
  assert.doesNotMatch(uncertain.speech, /still focused on the Isle of Man/i);
  const ambient = resolveDialogue("Hundreds of wildfires continue across the country", createDialogueState(), { source: "speech", recognitionConfidence: 0.95 });
  assert.equal(ambient.route, "clarify");
});

test("dialogue sessions are isolated and duplicate in-flight work is acknowledged", () => {
  const sessions = new DialogueSessions();
  const a = sessions.resolve("a", "Tell me all about infrastructure");
  sessions.markInFlight("a", a);
  const duplicate = sessions.resolve("a", "all");
  const other = sessions.resolve("b", "all");
  assert.equal(duplicate.route, "ack");
  assert.equal(other.route, "clarify");
});

test("dialogue session capacity evicts the least recently used session", () => {
  const sessions = new DialogueSessions({ maxSessions: 2 });
  sessions.set("a", createDialogueState());
  sessions.set("b", createDialogueState());
  sessions.get("a");
  sessions.set("c", createDialogueState());
  assert.deepEqual([...sessions.sessions.keys()], ["a", "c"]);
});

test("previewing a capacity-rejected request does not mutate dialogue state", () => {
  const sessions = new DialogueSessions();
  const rejected = sessions.preview("at-capacity", "Tell me about infrastructure");
  assert.equal(rejected.route, "answer");
  assert.equal(sessions.preview("at-capacity", "all").route, "clarify");
});

test("a cancelled request can be repeated immediately", () => {
  const sessions = new DialogueSessions();
  const first = sessions.resolve("cancelled", "Tell me all about infrastructure");
  sessions.markInFlight("cancelled", first);
  assert.equal(sessions.preview("cancelled", "all").route, "ack");
  sessions.cancel("cancelled", first.semanticKey);
  assert.equal(sessions.preview("cancelled", "all").route, "answer");
});

test("browser speech preflight repairs known phrases and holds unknown low-confidence text", () => {
  assert.equal(suggestSpeechRepair("draw me a mao"), "draw me a map");
  assert.equal(suggestSpeechRepair("manz and akk unfo"), "Manx and all info");
  assert.equal(suggestSpeechRepair("i beed to know all"), "I need to know all");
  assert.equal(assessSpeech("draw me a mao", 0.1).needsConfirmation, false, "a bounded deterministic repair can proceed");
  assert.equal(assessSpeech("uncertain proper name", 0.1).needsConfirmation, true);
  assert.equal(assessSpeech("clear question", 0.9).needsConfirmation, false);
});

test("figure it out is not retrieved as statistical figures", () => {
  assert.equal(ftsQuery("figure it out"), null);
  assert.match(ftsQuery("Show official population figures"), /figur/);
});

test("Manx-scoped retrieval excludes foreign ledger pollution", () => {
  const kb = new KnowledgeBase(":memory:");
  kb.upsertClaim({ text: "Isle of Man infrastructure includes local ports and an airport.", topic: "Isle of Man infrastructure", sources: [{ url: "https://www.gov.im/infrastructure" }], support: 2 });
  kb.upsertClaim({ text: "Bermuda infrastructure includes an international airport.", topic: "Bermuda infrastructure", sources: [{ url: "https://www.gov.bm/infrastructure" }], support: 2 });
  const rows = kb.search("infrastructure airport", { jurisdiction: "Isle of Man" });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => /isle of man|manx|tynwald/i.test(row.text + " " + row.topic)));
  const focus = kb.focus("infrastructure airport", { jurisdiction: "Isle of Man" });
  assert.ok(focus.claims.length > 0);
  assert.ok(focus.claims.every((row) => row.jurisdiction === "IM"));
  kb.close();
});

test("the answer pipeline uses the resolved Manx request, not the rough transcript", async () => {
  const kb = new KnowledgeBase(":memory:");
  const originalFocus = kb.focus.bind(kb);
  let focusedQuestion = "";
  let focusedOptions = null;
  kb.focus = (question, options) => {
    focusedQuestion = question;
    focusedOptions = options;
    return originalFocus(question, options);
  };

  const resolution = resolveDialogue("tell me about infastructure", createDialogueState());
  let modelPrompt = "";
  const fakeModel = async ({ prompt, onDelta }) => {
    modelPrompt = prompt;
    onDelta('Here is a useful Manx overview. <<meta>>{"confidence":0.5,"used":[],"status":"model_prior","gaps":[],"expedition":false,"researchable":true,"lateral_hint":""}');
    return { model: "test-model", costUsd: 0, durationMs: 1 };
  };

  await answer({
    kb,
    question: resolution.raw,
    resolution,
    sessionId: "pipeline-test",
    emit: () => {},
    expeditions: null,
    runModel: fakeModel,
  });

  assert.equal(focusedQuestion, resolution.canonical);
  assert.deepEqual(focusedOptions, { jurisdiction: "Isle of Man" });
  assert.match(modelPrompt, /RESOLVED REQUEST[\s\S]*Isle of Man infrastructure/i);
  assert.match(modelPrompt, /ORIGINAL TRANSCRIPT[\s\S]*tell me about infastructure/i);
  kb.close();
});

test("an explicit research confirmation never executes a different map continuation", () => {
  const sessions = new DialogueSessions();
  const first = sessions.resolve("typed-action", "How many people live on the Isle of Man?", { turnId: "t1", clientTurn: 1 });
  sessions.markInFlight("typed-action", first);
  sessions.complete("typed-action", first.semanticKey, { pendingAction: { kind: "research", subject: first.canonical, label: "population" } });
  sessions.resolve("typed-action", "Can you make the map 3D?", { turnId: "t2", clientTurn: 2 });
  const confirmation = sessions.preview("typed-action", "Yes, do your research", { turnId: "t3", clientTurn: 3 });
  assert.notEqual(confirmation.action?.kind, "open_full_map");
  assert.notEqual(confirmation.route, "action");
});

test("a Manx graph request routes to the reviewed canvas without the answer model", () => {
  const result = resolveDialogue("Draw a graph of the Isle of Man population over time", createDialogueState(), { turnId: "visual-1", clientTurn: 1 });
  assert.equal(result.route, "visual");
  assert.equal(result.action?.kind, "generate_canvas");
  assert.match(result.canonical, /Isle of Man population/i);
  assert.match(result.speech, /MOMM|review/i);
  assert.match(result.speech, /shared hourly MOMM review slot/i);
});

test("map complaint repair never pretends to inspect an opened external provider", () => {
  const shown = resolveDialogue("Show me a map of the Isle of Man", createDialogueState(), { turnId: "map-1", clientTurn: 1 });
  const capability = resolveDialogue("Is that accurate and can you give me Google Earth?", shown.state, { turnId: "map-2", clientTurn: 2 });
  const opened = resolveDialogue("Yes, use your suggestion", capability.state, { turnId: "map-3", clientTurn: 3 });
  const complaint = resolveDialogue("Still not good enough", opened.state, { turnId: "map-4", clientTurn: 4 });
  assert.equal(opened.action.kind, "open_full_map");
  assert.equal(complaint.route, "repair");
  assert.match(complaint.speech, /what should I improve/i);
  assert.doesNotMatch(complaint.speech, /I (?:can )?see|I inspected|I viewed/i);
});

test("an unsupported photorealistic request announces the limitation and makes a diagram alternative", () => {
  const result = resolveDialogue("Generate a photorealistic image of Douglas harbour", createDialogueState(), { turnId: "visual-2", clientTurn: 2 });
  assert.equal(result.route, "visual");
  assert.equal(result.action?.kind, "generate_canvas");
  assert.equal(result.action?.fallback, "diagram");
  assert.match(result.speech, /cannot generate a photorealistic image/i);
});

test("a source-check confirmation returns quickly while Go deeper keeps the full expedition", () => {
  const sessions = new DialogueSessions();
  const answered = sessions.resolve("research-modes", "What are the colours of the Manx flag?", { turnId: "answer-flag", clientTurn: 1 });
  sessions.markInFlight("research-modes", answered);
  sessions.complete("research-modes", answered.semanticKey, {
    pendingAction: { kind: "research", subject: answered.canonical, label: "check official Manx sources" },
  });

  const sourceCheck = sessions.preview("research-modes", "Yes, check official Manx sources", { turnId: "source-check", clientTurn: 2 });
  const deepCheck = sessions.preview("research-modes", "Go deeper on what you suggested", { turnId: "deep-check", clientTurn: 3 });

  assert.equal(sourceCheck.route, "research");
  assert.deepEqual(sourceCheck.strategies, ["research"]);
  assert.match(sourceCheck.speech, /first sourced answer/i);
  assert.deepEqual(deepCheck.strategies, ["research", "adversarial", "cross_model", "lateral"]);
});
