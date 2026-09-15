// What the Oracle goes and learns about when nobody has asked it anything.
// Shared by the server's Dream button and the terminal dream runner.

const FULL = ["research", "adversarial", "cross_model", "lateral"];

/**
 * Priority: an open gap first (a question we already failed to answer), then
 * the least trustworthy learned claim (re-verification), then a settled topic
 * to explore laterally.
 */
export function curiosityTarget(kb, { forcedQuestion = null } = {}) {
  if (forcedQuestion) return { question: forcedQuestion, reason: "requested", strategies: FULL, jurisdiction: "Isle of Man" };
  const scope = { jurisdiction: "Isle of Man" };
  const gap = kb.openGaps(1, { ...scope, readyOnly: true })[0];
  if (gap) return { question: gap.question, reason: `open gap: ${gap.reason}`, strategies: FULL, jurisdiction: "Isle of Man" };
  const weak = kb.weakestClaims(1, scope)[0];
  if (weak) return { question: `Is this still true, and what is missing from it: ${weak.text}`, reason: `re-verifying the weakest learned claim (trust ${weak.trust.toFixed(2)})`, strategies: ["research", "adversarial", "cross_model"], jurisdiction: "Isle of Man" };
  const seed = kb.randomClaim(scope);
  if (seed) return { question: `What is hidden, under-documented or commonly misunderstood about: ${seed.topic || seed.text.slice(0, 120)}`, reason: "curiosity: lateral exploration of a settled topic", strategies: ["lateral", "research"], jurisdiction: "Isle of Man" };
  return null;
}
