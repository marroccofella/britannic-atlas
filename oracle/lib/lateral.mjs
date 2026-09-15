// Lateral-thinking operators. Each one turns a question plus what is already
// known into a *provocation* that asks for hypotheses the direct route would
// never surface. Hypotheses are never believed — they enter the ledger as
// `hypothesis` and only graduate through the same verification gate as
// everything else.

export const OPERATORS = [
  { id: "reversal", name: "Reversal", instruction: "Invert the question's central assumption. If the question assumes X causes Y, ask what if Y produced X, or what if neither exists. What would the evidence look like, and where would it be recorded?" },
  { id: "random_entry", name: "Random entry", instruction: "Take the random concept supplied and force a genuine bridge between it and the question. Do not settle for a metaphor: find a real mechanism, institution, document trail or historical episode where the two meet." },
  { id: "provocation", name: "Provocation (Po)", instruction: "State a deliberately unreasonable 'Po' statement about the topic, then move forward from it: which parts of the provocation point to something true, testable, and under-documented?" },
  { id: "negative_space", name: "Negative space", instruction: "Look at what the standard sources conspicuously omit. Which records, jurisdictions, decades, groups of people or transactions are missing from the usual account, and what would explain the silence? Name specific archives or registers where the missing material would live." },
  { id: "scale_shift", name: "Scale shift", instruction: "Zoom out to the multi-century or global scale, then zoom in to one named individual, ship, ledger, court case, parish or company. What becomes visible at each scale that the middle scale hides?" },
  { id: "analogy_transplant", name: "Analogy transplant", instruction: "Find a structurally identical situation in an unrelated domain or jurisdiction (another empire, a company, a religion, an ecosystem, a protocol). Transplant its known dynamics back onto the question and predict something checkable." },
  { id: "must_be_true", name: "What would have to be true", instruction: "Assume a surprising conclusion is correct. List what would have to be true for it to hold, then identify the single cheapest fact that would confirm or kill it." },
  { id: "contrarian_expert", name: "Contrarian expert", instruction: "Steelman the strongest minority or dissenting view held by a serious specialist. Where does the mainstream account rely on convention rather than evidence?" },
  { id: "follow_the_ledger", name: "Follow the ledger", instruction: "Follow money, land, titles, names or documents through time instead of following the narrative. Who paid, who registered, who inherited, and which register would still hold the entry?" },
  { id: "time_traveller", name: "Time traveller", instruction: "Ask how this will be described in 2126, and how it was described in 1826. Which present assumptions look temporary from either end?" },
];

export const RANDOM_CONCEPTS = [
  "tides", "salt", "quarantine", "lighthouse", "heraldry", "insurance", "smuggling", "census", "apprenticeship", "tithe",
  "cartography", "pilgrimage", "monopoly", "lightning", "beekeeping", "cathedral", "shipwreck", "coinage", "parish register",
  "telegraph", "customs house", "orchard", "prison hulk", "wool", "cider", "postage stamp", "lifeboat", "chess", "cricket",
  "fog", "peat", "dowry", "pipe organ", "gunpowder", "railway timetable", "canal lock", "stained glass", "herring", "lead mine",
  "seaweed", "almanac", "wax seal", "windmill", "ferry", "oath", "beacon", "mortgage", "jury", "sundial",
];

export function pickOperators(n = 3, rng = Math.random, exclude = []) {
  const pool = OPERATORS.filter((op) => !exclude.includes(op.id));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export function pickConcept(rng = Math.random) {
  return RANDOM_CONCEPTS[Math.floor(rng() * RANDOM_CONCEPTS.length)];
}

export const LATERAL_SCHEMA = {
  type: "object",
  properties: {
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          operator: { type: "string" },
          hypothesis: { type: "string", description: "One specific, checkable claim (not a question)." },
          why_hidden: { type: "string", description: "Why the usual sources would miss this." },
          test: { type: "string", description: "The cheapest concrete check that would confirm or refute it." },
          search_queries: { type: "array", items: { type: "string" } },
          prior: { type: "number", description: "Your honest prior probability, 0 to 1, that it is true." },
        },
        required: ["operator", "hypothesis", "why_hidden", "test", "search_queries", "prior"],
      },
    },
  },
  required: ["hypotheses"],
};

export function buildLateralPrompt({ question, focusClaims = [], operators, concept, strayClaim }) {
  const known = focusClaims.length
    ? focusClaims.map((c) => `- ${c.text}`).join("\n")
    : "- (nothing relevant is in the ledger yet)";
  const ops = operators.map((op, i) => `${i + 1}. ${op.name} [${op.id}]: ${op.instruction}`).join("\n");
  return `You are the lateral-thinking faculty of a truth-seeking answer engine about the British world (UK, Crown Dependencies, Overseas Territories, Commonwealth and connected histories).

QUESTION UNDER INVESTIGATION
${question}

WHAT THE LEDGER ALREADY HOLDS (do not restate these)
${known}

RANDOM CONCEPT FOR THE RANDOM-ENTRY OPERATOR: "${concept}"
${strayClaim ? `A STRAY CLAIM FROM AN UNRELATED TOPIC (use it as a collision seed): ${strayClaim}` : ""}

OPERATORS TO APPLY (one or two hypotheses each)
${ops}

RULES
- Every hypothesis must be a specific, falsifiable statement about the real world, not a question or a vague theme.
- Prefer hypotheses that point at a named document, register, court, archive, dataset, statute, or dated event, because those can be verified.
- Be honest in "prior": most genuinely lateral hypotheses are below 0.4. Do not inflate.
- No more than 6 hypotheses in total. Quality over quantity.`;
}

export function operatorById(id) { return OPERATORS.find((op) => op.id === id) || null; }
