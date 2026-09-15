// The MOMM conversation view: one coloured lane and one British voice per
// reviewing model. Pure functions only, so the whole thing is unit-testable
// without a DOM. The dispatcher streams reviewer *events* (started, retry,
// completed) live and delivers each model's words in the final report, so the
// lanes animate as reviewers work and fill in when the report lands.

export const AGENT_ORDER = Object.freeze(["codex", "copilot", "grok", "antigravity", "gemini", "claude"]);

export const AGENT_PALETTE = Object.freeze({
  codex: Object.freeze({ colour: "#5b9cf0", label: "Codex" }),
  copilot: Object.freeze({ colour: "#b48cf5", label: "Copilot" }),
  grok: Object.freeze({ colour: "#e9ae3f", label: "Grok" }),
  antigravity: Object.freeze({ colour: "#3fc4b2", label: "Antigravity" }),
  gemini: Object.freeze({ colour: "#ee7a9a", label: "Gemini" }),
  claude: Object.freeze({ colour: "#d5b35a", label: "Claude" }),
  oracle: Object.freeze({ colour: "#57c188", label: "Mannin" }),
});
const FALLBACK_COLOURS = Object.freeze(["#7aa2f7", "#f7768e", "#9ece6a", "#e0af68", "#bb9af7", "#7dcfff"]);

export function normaliseAgent(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

export function agentStyle(agent) {
  const key = normaliseAgent(agent);
  if (AGENT_PALETTE[key]) return { agent: key, ...AGENT_PALETTE[key] };
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const label = key ? key[0].toUpperCase() + key.slice(1) : "Reviewer";
  return { agent: key || "reviewer", colour: FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length], label };
}

const STATUS_WORDS = Object.freeze({
  success: "completed",
  self_excluded: "sat this one out as the governor",
  authentication_required: "needs a sign-in before it can review",
  provider_unavailable: "was unavailable, the provider was down",
  ineligible_tier: "could not review on this account tier",
  timeout: "ran out of time",
  missing: "is not installed",
  invalid_output: "returned an unusable reply",
  disabled_no_oauth: "is disabled without a sign-in",
  unsupported: "is not supported here",
  error: "hit an error",
  unknown_status: "returned an unknown status",
});
export function humanReviewerStatus(status) { return STATUS_WORDS[String(status || "")] || STATUS_WORDS.unknown_status; }

const VERDICT_WORDS = Object.freeze({ ACCEPT: "accept", MODIFY: "modify", REJECT: "reject" });
export function verdictWord(verdict) { return VERDICT_WORDS[String(verdict || "").toUpperCase()] || "no verdict"; }

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(Number(ms) || 0) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return minutes ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

// ---------- voices ----------

const FEMALE_HINT = /(Sonia|Libby|Maisie|Hazel|Susan|Kate|Female|Zira|Aria|Jenny|Abbi|Bella|Hollie|Olivia|Google UK English Female)/i;
function naturalScore(voice) { return (/Natural|Online|Neural|Premium|Enhanced/i.test(voice.name) ? 2 : 0) + (/en[-_]GB/i.test(voice.lang) ? 1 : 0); }

/**
 * Give every reviewing model a distinct voice. British voices are preferred,
 * natural ones first, the user's own Mannin voice is reserved for Mannin, and
 * when the machine has fewer voices than models the pitch is varied so two
 * models never sound the same.
 */
export function assignVoices(voiceList, { mainVoiceName = null, agents = AGENT_ORDER } = {}) {
  const list = Array.isArray(voiceList) ? voiceList.filter((v) => v && typeof v.name === "string") : [];
  const british = list.filter((v) => /en[-_]GB/i.test(v.lang));
  const english = list.filter((v) => /^en/i.test(v.lang));
  const pool = (british.length ? british : english.length ? english : list).slice().sort((a, b) => naturalScore(b) - naturalScore(a) || a.name.localeCompare(b.name));
  const main = list.find((v) => v.name === mainVoiceName) || pool[0] || null;
  const others = pool.filter((v) => v !== main);
  const usable = others.length ? others : pool;
  // Alternate voices that sound different from each other where we can.
  const male = usable.filter((v) => !FEMALE_HINT.test(v.name));
  const female = usable.filter((v) => FEMALE_HINT.test(v.name));
  const alternating = [];
  for (let i = 0; i < Math.max(male.length, female.length); i += 1) { if (male[i]) alternating.push(male[i]); if (female[i]) alternating.push(female[i]); }
  const ordered = alternating.length ? alternating : usable;
  const assignments = new Map();
  agents.forEach((agent, index) => {
    const key = normaliseAgent(agent);
    if (!ordered.length) { assignments.set(key, { voice: null, pitch: [1, 0.85, 1.15][index % 3], rate: 1 }); return; }
    const voice = ordered[index % ordered.length];
    const wraps = Math.floor(index / ordered.length);
    assignments.set(key, { voice, pitch: wraps === 0 ? 1 : wraps === 1 ? 0.85 : 1.15, rate: wraps >= 2 ? 1.05 : 1 });
  });
  assignments.set("oracle", { voice: main, pitch: 0.95, rate: 1 });
  return assignments;
}

// ---------- live state ----------

export function createConversationState(episodeId) {
  return { episodeId: String(episodeId || ""), phase: "starting", startedAt: null, finishedAt: null, reviewers: [], lanes: {}, events: 0, runId: null, error: null };
}

function bounded(value, max) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null; }
function newLane(agent) { return { agent, phase: "waiting", startedAt: null, finishedAt: null, verdict: null, reviewerStatus: null, findings: 0, critical: 0, attempts: 0, durationMs: null, retry: null }; }

/** Fold one server event into the conversation state. Never mutates its input. */
export function reduceDeliberationEvent(state, event, now = Date.now()) {
  const next = { ...state, lanes: { ...state.lanes }, events: state.events + 1 };
  const agent = event?.agent ? normaliseAgent(event.agent) : null;
  const lane = (key) => next.lanes[key] || newLane(key);
  const status = String(event?.status || "");
  // A timestamp of zero is a real time, so use nullish checks throughout.
  if (status === "started") { next.phase = "convening"; next.startedAt = now; return next; }
  if (status === "reviewing") {
    next.phase = next.phase === "synthesising" ? "synthesising" : "reviewing";
    next.startedAt = next.startedAt ?? now;
    const name = String(event.event || "");
    if (name === "dispatch" && Array.isArray(event.reviewers)) {
      const reviewers = event.reviewers.map(normaliseAgent).filter(Boolean).slice(0, 8);
      next.reviewers = [...new Set([...next.reviewers, ...reviewers])];
      for (const key of reviewers) if (!next.lanes[key]) next.lanes[key] = newLane(key);
    } else if (name === "reviewer.started" && agent) {
      next.lanes[agent] = { ...lane(agent), phase: "thinking", startedAt: lane(agent).startedAt ?? now };
      if (!next.reviewers.includes(agent)) next.reviewers = [...next.reviewers, agent];
    } else if (name === "reviewer.retry" && agent) {
      next.lanes[agent] = { ...lane(agent), phase: "retrying", retry: String(event.reason || "provider outage").slice(0, 80), attempts: lane(agent).attempts + 1 };
    } else if (name === "reviewer.completed" && agent) {
      const current = lane(agent);
      const reviewerStatus = String(event.reviewerStatus || "unknown_status");
      next.lanes[agent] = { ...current, phase: reviewerStatus === "success" ? "done" : "unavailable", finishedAt: now, verdict: event.verdict || null, reviewerStatus, findings: bounded(event.findings, 999) ?? 0, critical: bounded(event.critical, 999) ?? 0, attempts: bounded(event.attempts, 9) ?? current.attempts, durationMs: bounded(event.durationMs, 3_600_000), retry: null };
      if (!next.reviewers.includes(agent)) next.reviewers = [...next.reviewers, agent];
    } else if (name === "final") next.phase = "synthesising";
    return next;
  }
  if (status === "finished") { next.phase = "finished"; next.finishedAt = now; next.runId = event.runId ? String(event.runId).slice(0, 100) : next.runId; return next; }
  if (status === "failed") { next.phase = "failed"; next.finishedAt = now; next.error = String(event.reason || "review failed").slice(0, 160); return next; }
  return next;
}

/** Reviewers in the order they finished; unfinished ones last, alphabetically. */
export function completionOrder(state) {
  return Object.values(state.lanes)
    .sort((a, b) => (a.finishedAt ?? Number.POSITIVE_INFINITY) - (b.finishedAt ?? Number.POSITIVE_INFINITY) || a.agent.localeCompare(b.agent))
    .map((lane) => lane.agent);
}

export function progressOf(state) {
  const total = Math.max(state.reviewers.length, Object.keys(state.lanes).length);
  const done = Object.values(state.lanes).filter((lane) => lane.phase === "done" || lane.phase === "unavailable").length;
  return { total, done, ratio: total ? done / total : 0 };
}

// ---------- the spoken conversation ----------

/**
 * Turn a review into lines to read aloud, one voice per model, in the order
 * the models actually finished. Every line is plain text with no markup.
 */
export function buildConversationScript({ review, result = {}, state = null, allowance = null } = {}) {
  const reviewers = (Array.isArray(review?.reviewers) ? review.reviewers : []).filter((r) => r && typeof r === "object");
  const byAgent = new Map(reviewers.map((r) => [normaliseAgent(r.agent), r]));
  const ordered = [...new Set([...(state ? completionOrder(state) : []), ...reviewers.map((r) => normaliseAgent(r.agent))])].filter((agent) => byAgent.has(agent));
  const findings = Array.isArray(review?.findings) ? review.findings : [];
  const findingsFor = (agent) => findings.filter((f) => (Array.isArray(f.reviewers) ? f.reviewers : []).map(normaliseAgent).includes(agent));
  const lines = [];
  const successful = reviewers.filter((r) => r.status === "success").length;
  let intro = `${successful} of ${reviewers.length} reviewers completed.`;
  if (allowance && Number.isFinite(Number(allowance.used)) && Number.isFinite(Number(allowance.limit))) intro += ` This was review ${allowance.used} of ${allowance.limit} this hour.`;
  lines.push({ agent: "oracle", role: "narrator", text: intro });
  for (const agent of ordered) {
    const r = byAgent.get(agent);
    const label = agentStyle(agent).label;
    if (r.status !== "success") { lines.push({ agent, role: "reviewer", text: `${label} ${humanReviewerStatus(r.status)}.` }); continue; }
    const confidence = r.confidence != null && r.confidence !== "" && Number.isFinite(Number(r.confidence)) ? `, ${Math.round(Number(r.confidence) * 100)} per cent confident` : "";
    let text = `${label}, verdict ${verdictWord(r.verdict)}${confidence}.`;
    if (r.summary) text += ` ${String(r.summary)}`;
    const own = findingsFor(agent);
    if (own.length) text += ` ${label} raised ${own.length} ${own.length === 1 ? "point" : "points"}: ${own.map((f) => `${String(f.severity || "").toLowerCase()}, ${f.title}`).join(". ")}.`;
    lines.push({ agent, role: "reviewer", text });
  }
  const corrections = (Array.isArray(result?.corrections) ? result.corrections : []).filter(Boolean);
  if (corrections.length) lines.push({ agent: "oracle", role: "oracle", text: `What changed: ${corrections.join(". ")}.` });
  if (result?.answer) lines.push({ agent: "oracle", role: "oracle", text: `MOMM's considered answer. ${result.answer}` });
  else if (result?.ok === false) lines.push({ agent: "oracle", role: "oracle", text: `The review could not be completed${result.reason ? `: ${result.reason}` : ""}.` });
  else lines.push({ agent: "oracle", role: "oracle", text: "The answer was not changed." });
  return lines;
}

/** One-line usage summary for the panel header. */
const known = (value) => value != null && value !== "" && Number.isFinite(Number(value));

export function usageLine({ state, allowance = null, costUsd = null, durationMs = null, now = Date.now() } = {}) {
  const parts = [];
  if (allowance && known(allowance.limit)) parts.push(`${Number(allowance.used) || 0} of ${Number(allowance.limit)} reviews used this hour`);
  if (state) { const p = progressOf(state); if (p.total) parts.push(`${p.done}/${p.total} reviewers done`); }
  if (known(durationMs)) parts.push(formatDuration(durationMs));
  else if (state?.startedAt) parts.push(`${formatDuration(now - state.startedAt)} elapsed`);
  // Synthesis cost is only known once Mannin has actually written the answer.
  if (known(costUsd)) parts.push(`synthesis $${Number(costUsd).toFixed(3)}`);
  return parts.join(" · ");
}
