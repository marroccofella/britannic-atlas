import {reviewAfterLookup} from './lib/review-sequence.mjs';
import {knowledgeRuntime,knowledgeSpeech} from './lib/knowledge-runtime.mjs';
import {knowledgeIntegrity} from './lib/knowledge-integrity.mjs';
import {inspectMommVersion} from './lib/momm.mjs';
// Oracle — local voice answer engine server with local semantic retrieval.
// Run: npm run oracle   (http://127.0.0.1:4242)

import {createReviewJobs} from './lib/review-jobs.mjs';
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { openKb } from "./lib/kb.mjs";
import { ensureSeeded, SEED_VERSION } from "./lib/seed.mjs";
import { Bus, attachBus, sseStart } from "./lib/bus.mjs";
import { ExpeditionQueue, citableSources } from "./lib/learning.mjs";
import { answer, isResearchableGap, isResearchable } from "./lib/brain.mjs";
import { readJson } from "./lib/http.mjs";
import { MAX_MESSAGE_CHARS, messageProblem } from "./public/conversation-policy.mjs";
import { findMommScript } from "./lib/momm.mjs";
import { inspectClaudeVersion } from "./lib/claude.mjs";
import { curiosityTarget } from "./lib/curiosity.mjs";
import { ActiveRequestRegistry, boundedPositiveInt, isJsonRequest, originAllowed, safeStaticPath } from "./lib/http.mjs";
import { DialogueSessions, resolveSavedOffer } from "./lib/dialogue.mjs";
import { deliberateEpisode, mommHourlyAllowance } from "./lib/deliberate.mjs";
import { createReviewedVisual } from "./lib/visual.mjs";
import { boundDeliberatedEvidence } from "./lib/answer-evidence.mjs";
import { publicManxClaimsForVisual, safeForExternalPeerReview,  publicReviewScope } from "./lib/external-policy.mjs";
import { ConversationStore, assistantQuestion } from "./lib/conversations.mjs";
import { acquireInstanceLease } from "./lib/instance-lease.mjs";
import { ResultStore, researchOffer, researchReviewEpisode, publicResearchAccess, readbackResult, savedReviewResult } from "./lib/results.mjs";
import {LIVE_VERSION} from './lib/live-tools.mjs';
import { verifyClaimSources } from "./lib/source-verification.mjs";
import { ManxRetrieval } from "./lib/manx-retrieval.mjs";
import { knowledgeMap } from "./lib/knowledge-map.mjs";
import {reviewTarget,storedReviewProblem} from './lib/review-target.mjs';
import {reviewContextEpisode} from './lib/conversation-review.mjs';
import {sourceMode} from './lib/interaction-policy.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC = path.join(HERE, "public");
const DB_FILE = process.env.ORACLE_DB || path.join(HERE, "data", "oracle.db");
const PORT = boundedPositiveInt(process.env.ORACLE_PORT ?? 4242, 4242, { max: 65_535 });
const HOST = process.env.ORACLE_HOST || "127.0.0.1";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8" };
const MAX_IN_FLIGHT = boundedPositiveInt(process.env.ORACLE_MAX_IN_FLIGHT ?? 4, 4);
const activeAnswers = new ActiveRequestRegistry(MAX_IN_FLIGHT);
const VISUAL_ACTION_TTL_MS = 10 * 60_000;
const visualActions = new Map();
const activeToolWork = new Set();
const toolWorkWaiters = new Set();
let acceptingToolWork = true;

function trackToolWork({ sessionId, kind, controller, promise }) {
  if (!acceptingToolWork) {
    controller?.abort();
    throw new Error("server is shutting down");
  }
  const record = { sessionId, kind, controller, promise };
  activeToolWork.add(record);
  const release = () => {
    activeToolWork.delete(record);
    if (activeToolWork.size) return;
    for (const resolve of toolWorkWaiters) resolve();
    toolWorkWaiters.clear();
  };
  Promise.resolve(promise).then(release, release);
  return promise;
}

function stopToolWork({ sessionId = null, kind = null } = {}) {
  if (sessionId == null && kind == null) acceptingToolWork = false;
  for (const record of activeToolWork) {
    if (sessionId != null && record.sessionId !== sessionId) continue;
    if (kind != null && record.kind !== kind) continue;
    record.controller?.abort();
  }
}

function whenToolWorkEmpty() {
  return activeToolWork.size === 0
    ? Promise.resolve()
    : new Promise((resolve) => toolWorkWaiters.add(resolve));
}

function pruneVisualActions(at = Date.now()) {
  for (const [id, action] of visualActions) if (at - action.createdAt > VISUAL_ACTION_TTL_MS) {
    action.cancelled = true;
    action.controller?.abort();
    visualActions.delete(id);
  }
  while (visualActions.size > 128) {
    const id = visualActions.keys().next().value;
    visualActions.get(id).cancelled = true;
    visualActions.get(id)?.controller?.abort();
    visualActions.delete(id);
  }
}

function createVisualAction({ sessionId, resolution, clientTurn }) {
  pruneVisualActions();
  const id = `v_${randomUUID()}`;
  visualActions.set(id, {
    id,
    sessionId,
    question: resolution.canonical,
    jurisdiction: resolution.jurisdiction || "Isle of Man",
    requestedType: resolution.action?.requestedType || "diagram",
    clientTurn: Number.isSafeInteger(Number(clientTurn)) ? Number(clientTurn) : null,
    createdAt: Date.now(),
    cancelled: false,
    promise: null,
  });
  // The request is on record before anything is generated, so a reload or a
  // restart before completion leaves a restorable, regenerable placeholder
  // instead of an answer with a missing chart.
  try { results.put(sessionId, "canvas:" + id, resolution.canonical, { ok: false, phase: "not_generated", question: resolution.canonical, jurisdiction: resolution.jurisdiction || "Isle of Man", requestedType: resolution.action?.requestedType || "diagram", clientTurn: visualActions.get(id).clientTurn }); }
  catch { /* a record that cannot be saved does not stop the visual */ }
  return id;
}
/** Rebuild an in-memory visual action from its saved record after a restart or expiry. The originating turn travels with it, so an old canvas cannot become the current artifact. */
function restoreVisualAction(actionId, sessionId, saved) {
  if (!saved || saved.ok || !["not_generated", "failed"].includes(saved.phase) || typeof saved.question !== "string" || !saved.question.trim()) return null;
  const action = { id: actionId, sessionId, question: saved.question, jurisdiction: saved.jurisdiction || "Isle of Man", requestedType: saved.requestedType || "diagram", clientTurn: Number.isSafeInteger(Number(saved.clientTurn)) ? Number(saved.clientTurn) : null, createdAt: Date.now(), cancelled: false, promise: null };
  visualActions.set(actionId, action);
  return action;
}

// eslint-disable-next-line no-control-regex -- external reviewer text must lose terminal/control bytes
const cleanSummary = (value, max = 600) => String(value ?? "").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
function publicReview(review) {
  if (!review || typeof review !== "object") return null;
  const reviewers = (Array.isArray(review.reviewers) ? review.reviewers : []).slice(0, 8).map((row) => ({
    agent: cleanSummary(row.agent, 40), status: cleanSummary(row.status, 40), verdict: row.verdict || null,
    confidence: row.confidence != null && row.confidence !== "" && Number.isFinite(Number(row.confidence)) ? Math.max(0, Math.min(1, Number(row.confidence))) : null,
    summary: cleanSummary(row.summary, 500),
  }));
  const findings = (Array.isArray(review.findings) ? review.findings : []).slice(0, 16).map((row) => ({
    severity: ["CRITICAL", "WARNING", "NITPICK"].includes(row.severity) ? row.severity : "WARNING",
    title: cleanSummary(row.issue || row.title, 400),
    rationale: cleanSummary(row.summary || row.rationale, 600),
    recommendation: cleanSummary(row.recommendation, 400),
    // Which models raised it, so the conversation view can put each finding
    // in the right lane and the right voice can read it.
    reviewers: (Array.isArray(row.reviewers) ? row.reviewers : []).slice(0, 8).map((agent) => cleanSummary(agent, 40)).filter(Boolean),
  })).filter((row) => row.title);
  const agreementValue = typeof review.agreement === "number" ? review.agreement : review.agreement?.score;
  const agreements = Array.isArray(review.agreement?.corroborated) ? review.agreement.corroborated.map((v) => cleanSummary(v, 100)) : [];
  return {
    runId: cleanSummary(review.runId, 100) || null,
    dispatcherVersion:cleanSummary(review.dispatcherVersion,40)||null,
    ledgerUrl: null,
    summary: `${review.successes || reviewers.filter((row) => row.status === "success").length} peer reviewers completed${findings.length ? ` and raised ${findings.length} concrete point${findings.length === 1 ? "" : "s"}` : " with no concrete correction"}.`,
    agreement: agreementValue != null && agreementValue !== "" && Number.isFinite(Number(agreementValue)) ? Math.max(0, Math.min(1, Number(agreementValue))) : null,
    reviewers,
    findings,
    agreements,
    disagreements: findings.filter((row) => row.severity !== "NITPICK").map((row) => row.title),
  };
}

const kb = openKb(DB_FILE);
const releaseInstance = acquireInstanceLease(kb.db);
// The MOMM hourly cap lives in the ledger's meta table, so a restart cannot
// hand out six more paid reviews.
mommHourlyAllowance.attach({
  load: () => JSON.parse(kb.getMeta("momm_allowance") || "null"),
  save: (entries) => kb.setMeta("momm_allowance", JSON.stringify(entries)),
});
let retrieval = null;
try { retrieval = new ManxRetrieval(kb, path.join(path.dirname(DB_FILE), "manx-sources.db")); }
catch { console.error("[oracle] MANX vector index unavailable; retaining ledger keyword retrieval"); }
const conversations = new ConversationStore(kb.db);
const results = new ResultStore(kb.db);
const bus = new Bus();
const dialogue = new DialogueSessions({ storage:conversations });
const expeditions = new ExpeditionQueue({
  kb,
  bus,
  root: ROOT,
  onSettled: ({ sessionId, id, status }) => dialogue.settleResearch(sessionId, id, { status }),
});
// Mis-heard speech recorded as a gap would be chased by the curiosity loop for
// ever. Retire any open gap that is not a researchable question.
const junk = kb.openGaps(500).filter((gap) => !isResearchableGap(gap));
for (const g of junk) kb.resolveGap(g.id, null);
if (junk.length) console.log(`[oracle] retired ${junk.length} unresearchable gap(s) left by speech recognition`);

try {
  const seeded = await ensureSeeded(kb, ROOT);
  // Say what a re-seed actually did: a corpus correction shows up here as
  // refreshed citations and retired wording, not only as new claims.
  if (!seeded.skipped) console.log(`[oracle] seed v${SEED_VERSION}: ${seeded.created} new, ${seeded.refreshed ?? 0} refreshed, ${seeded.retired ?? 0} retired (Britannica Atlas corpus)`);
} catch (err) {
  console.warn(`[oracle] could not seed from app/knowledge (run with --experimental-strip-types): ${err.message}`);
}
if (kb.lastStatusMigration && !kb.lastStatusMigration.skipped) console.log(`[oracle] status rules v2: ${kb.lastStatusMigration.rederived} re-derived, ${kb.lastStatusMigration.retired} retired ${JSON.stringify(kb.lastStatusMigration.changed)}`);
{
  const purged = kb.purgeExpiredExcerpts({ graceMs: 24 * 3_600_000 });
  if (purged.purged) console.log(`[oracle] purged ${purged.purged} expired source excerpt(s)`);
}
// What the user is talking to: the harness that generates answers, the models
// it is asked for, and the reviewer dispatcher. Shown in the header so a
// changed model or a missing CLI is never a surprise. Both probes are local
// and free; they fill in after startup and never block it.
const runtimeInfo = {
  harness: "Claude Code CLI",
  harnessVersion: null,
  answerModel: process.env.ORACLE_MODEL || "sonnet",
  researchModel: process.env.ORACLE_RESEARCH_MODEL || "sonnet",
  auth: "OAuth account session (no API keys)",
  momm: { available: Boolean(findMommScript()), version: null },
};
void inspectClaudeVersion().then((v) => { runtimeInfo.harnessVersion = v.ok ? v.version : null; if (!v.ok) runtimeInfo.harnessProblem = v.reason; });
void inspectMommVersion().then((v) => { runtimeInfo.momm.version = v.ok ? v.version : null; }).catch(() => {});
// The vector index follows the ledger from here on: every claim write
// schedules an incremental re-embed, and this startup pass catches up on
// anything written while no model was loaded (a re-seed, research accepted
// from the terminal). Answers are not blocked on it; keyword retrieval
// serves until the first pass lands.
if (retrieval) {
  void retrieval.watch().then((sync) => {
    if (sync.state === "current") console.log(`[oracle] vector index: ${sync.indexed} embedded, ${sync.unchanged} unchanged, ${sync.retained} live claims indexed`);
    else console.warn(`[oracle] vector index: ${sync.state}${sync.error ? ` (${sync.error})` : ""}; keyword retrieval only. To enable: npm run oracle:index -- setup`);
  });
}

// Citations are read, a bounded batch per start, never checked first. Blocked
// sites stay blocked; only a page that is gone stops counting as a route.
if (process.env.ORACLE_VERIFY_SOURCES !== "off" && !process.env.NODE_TEST_CONTEXT) {
  const batch = boundedPositiveInt(process.env.ORACLE_VERIFY_BATCH ?? 12, 12, { max: 200 });
  void verifyClaimSources(kb, { limit: batch })
    .then((r) => { if (r.checked) console.log(`[oracle] source verification: ${r.checked} checked ${JSON.stringify(r.byStatus)}${Object.keys(r.statusChanges).length ? " status " + JSON.stringify(r.statusChanges) : ""}`); })
    .catch((err) => console.warn(`[oracle] source verification skipped: ${err.message}`));
}

const PRIVACY_HEADERS = { "Referrer-Policy": "no-referrer" };
const json = (res, status, body) => { res.writeHead(status, { ...PRIVACY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };

function publicExpeditionRows(rows = []) {
  return rows.map((row) => {
    const publicRow = { ...row };
    delete publicRow.session_id;
    delete publicRow.sessionId;
    return publicRow;
  });
}

// The origin check compares Origin with Host, and Host is client-supplied. A
// page at evil.example rebound to 127.0.0.1 sends both as evil.example and
// passed. Only the addresses this server actually listens on are accepted.
const ALLOWED_HOSTS = new Set([
  `127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`, `${HOST}:${PORT}`,
  ...String(process.env.ORACLE_ALLOWED_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
]);
function hostAllowed(host) { return ALLOWED_HOSTS.has(String(host || "").toLowerCase()); }
function guardMutation(req, res, host) {
  if (!hostAllowed(host)) { json(res, 403, { error: "unexpected host header" }); return false; }
  if (!originAllowed(req, host)) { json(res, 403, { error: "cross-origin requests are not accepted" }); return false; }
  if (!isJsonRequest(req)) { json(res, 415, { error: "content-type must be application/json" }); return false; }
  return true;
}

function serveStatic(req, res, pathname) {
  const file = safeStaticPath(PUBLIC, pathname);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, PRIVACY_HEADERS); return res.end("not found"); }
  res.writeHead(200, { ...PRIVACY_HEADERS, "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

function reviewError(status,payload){throw Object.assign(new Error(payload.error||'Review unavailable'),{status});}
function prepareReview(body){
      if (!acceptingToolWork) return reviewError(503,{ error: "Oracle is shutting down" });
      const expeditionId = String(body.expeditionId || "").slice(0, 80);
      if (expeditionId && body.episodeId) return reviewError(400,{error:"Choose one review target."});
      const episodeId = expeditionId ? "research:" + expeditionId : String(body.episodeId || "").slice(0, 100);
      const sessionId = String(body.sessionId || "anon").slice(0, 80);
      if (!episodeId) return reviewError(400,{ error: "answer episode required" });
      const episode = expeditionId ? researchReviewEpisode(kb.getExpedition(expeditionId),sessionId) : kb.getEpisode(episodeId);
      if (!episode || episode.session_id !== sessionId) return reviewError(404,{ error: "answer not found in this conversation" });
      if (episode.status === "local") return reviewError(400,{ error: "Local capability answers do not need external peer review." });
      const reviewProblem=storedReviewProblem(kb,sessionId,episode);
      if(reviewProblem)return reviewError(400,{error:reviewProblem});
      if (!publicReviewScope(episode.jurisdiction) || !safeForExternalPeerReview(episode.resolved_question, episode.answer)) {
        return reviewError(400,{ error: "MOMM can review non-sensitive public questions, plans and task assessments; no code changes are required." });
      }
      const claims = episode.claims_used.map((id) => kb.getClaim(id)).filter(Boolean);
      const sources = expeditionId ? episode.sources : citableSources([...claims.flatMap((claim) => claim.sources || []), ...(episode.source_excerpts || []).flatMap(excerpt=>excerpt.sources || [])]);
      const target = {kind:expeditionId ? "research" : "episode",id:expeditionId || episodeId};
      const resultKey = target.kind + ":" + target.id;
      const reviewedEpisode=expeditionId?episode:reviewContextEpisode(kb,sessionId,episode);
      const cached = results.get(sessionId,resultKey,reviewedEpisode.answer);
      if (cached?.ok && cached.capabilityVersion===LIVE_VERSION)return {cached:{...cached,cached:true}};
      return {episodeId,expeditionId,sessionId,episode:reviewedEpisode,sources:reviewedEpisode===episode?sources:[],target,resultKey};
}
async function executeReview(context,controller,dispatched){
      const {episodeId,sessionId,episode,sources,target}=context;
      // Clicking Think harder is the per-answer consent point. The external
      // brief omits raw speech, session/episode identifiers and local paths.
      const deliberatePromise = deliberateEpisode({
        episode: { ...episode, kind: "answer", sources },
        cwd: ROOT,
        allowance: mommHourlyAllowance,
        minSuccess: 2,
        signal: controller.signal,
        onEvent: (event) => {if(event.event==='dispatch')dispatched();bus.publish("momm.deliberation", { episodeId, sessionId, status: "reviewing", ...event });},
      });
      const result = await trackToolWork({ sessionId, kind: "deliberate", controller, promise: deliberatePromise });
      const review = publicReview(result.review);
      if (controller.signal.aborted) return {ok:false,episodeId,target,reason:"stopped",message:"The review was stopped."};
      const allowance = mommHourlyAllowance.snapshot();
      const usage = { used: allowance.used, limit: allowance.limit, remaining: allowance.remaining };
      if (!result.ok) {
        const failed = {ok:false,episodeId,target,reason:cleanSummary(result.reason,160),message:cleanSummary(result.message,240),review,allowance:usage};
        return failed;
      }
      const evidence = boundDeliberatedEvidence({
        originalAnswer: episode.answer,
        originalStatus: episode.status,
        originalConfidence: episode.confidence,
        revisedAnswer: result.answer,
        proposedStatus: result.status,
        proposedConfidence: result.confidence,
      });
      // A review that several models independently agreed with is evidence the
      // ledger should keep, so the next question about this subject is answered
      // from the ledger instead of paying for the same work again. Reviewer
      // agreement raises support but is never a source, so the ordinary gate
      // still decides status: no primary source, no "verified".
      const learned = [];
      for (const candidate of result.claims || []) {
        // A proposition without a readable citation is an opinion, not a claim.
        if (!Array.isArray(candidate?.sources) || !candidate.sources.length) continue;
        try {
          const { claim, created } = kb.upsertClaim({
            text: candidate.text,
            topic: candidate.topic,
            jurisdiction: episode.jurisdiction,
            kind: "momm",
            confidence: candidate.confidence,
            sources: candidate.sources,
            support: candidate.support,
            evidenceKey: `momm:${review?.runId || episodeId}`,
            provenance: { origin: "momm-deliberation", episode: episodeId, run: review?.runId || null, corroborated_by: candidate.agreeing },
          });
          learned.push({ id: claim.id, text: claim.text, status: claim.status, created, sources: claim.sources.map((s) => s.url) });
        } catch { /* a proposition that will not bind to the ledger is dropped, never forced */ }
      }
      if (learned.length) bus.publish("momm.learned", { episodeId, sessionId, learned: learned.map((row) => ({ id: row.id, status: row.status, text: row.text })) });
      const costUsd = Number.isFinite(Number(result.costUsd)) ? Math.max(0, Number(result.costUsd)) : 0;
      const durationMs = Number.isFinite(Number(result.durationMs)) ? Math.max(0, Math.round(Number(result.durationMs))) : 0;
      const completedResult = {
        capabilityVersion:LIVE_VERSION,synthesisMode:result.synthesisMode,
        reviewedQuestion:episode.resolved_question,reviewedAnswerAt:episode.created_at,
        ok: true,
        episodeId,
        target,
        answer: cleanSummary(result.answer, 6_000),
        status: evidence.status,
        confidence: evidence.confidence,
        evidenceChanged: evidence.changed,
        corrections: (result.corrections || []).map((item) => cleanSummary(item, 240)).filter(Boolean).slice(0, 8),
        review,
        sources,
        costUsd,
        durationMs,
        allowance: usage,
        learned,
        learnedSkipped: learned.length ? "" : cleanSummary(result.claimsSkipped, 160),
      };
      return completedResult;
}
const reviewJobs=createReviewJobs({prepare:prepareReview,execute:executeReview,
  save:(context,result)=>results.put(context.sessionId,context.resultKey,context.episode.answer,result),
  onStatus:(context,status,operation,result)=>bus.publish('momm.deliberation',{episodeId:context.episodeId,sessionId:context.sessionId,status,operation,runId:result?.review?.runId||null,costUsd:result?.costUsd,reason:result?.reason})});
// A restart must never silently re-dispatch previously accepted paid work.
for(const row of kb.db.prepare('SELECT session_id,target,payload,fingerprint FROM oracle_results').all()){
  let payload;try{payload=JSON.parse(row.payload);}catch{continue;}
  if(['accepted','dispatching','reviewing'].includes(payload.operation?.phase)){
    payload={...payload,ok:false,reason:'interrupted',message:'The server restarted before this review finished.',operation:{...payload.operation,phase:'interrupted',finishedAt:new Date().toISOString()}};
    kb.db.prepare('UPDATE oracle_results SET payload=? WHERE session_id=? AND target=?').run(JSON.stringify(payload),row.session_id,row.target);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;
  try {
    if(req.method==='GET'&&p==='/api/knowledge/integrity')return json(res,200,knowledgeIntegrity(kb,retrieval));
    if (req.method === "GET" && p === "/api/health") return json(res, 200, { ok: true, flowVersion:LIVE_VERSION, scope: "Isle of Man", claims: kb.count(), verification: kb.verificationStats(), momm: Boolean(findMommScript()), mommAllowance: mommHourlyAllowance.snapshot(), expeditions: expeditions.status(), model: process.env.ORACLE_MODEL || "sonnet", runtime: { ...runtimeInfo }, retrieval: retrieval?.stats() || {queryMode:"keyword_fallback_index_unavailable"}, activeAnswers: activeAnswers.size, activeToolWork:activeToolWork.size });
    if (req.method === "GET" && p === "/api/events") return attachBus(bus, req, res);
    if (req.method === "GET" && p === "/api/conversations") return json(res,200,{conversations:conversations.list()});
    if (req.method === "GET" && p === "/api/conversation") {
      const id = String(url.searchParams.get("sessionId") || "");
      const current = conversations.get(id);
      if (!current) return url.searchParams.get("optional")==="1" ? json(res,200,{conversation:null,turns:[],before:null}) : json(res,404,{error:"conversation not found"});
      const page = conversations.page(id,{before:url.searchParams.get("before")});
      page.turns = page.turns.map(row => ({...row, reviewResult: savedReviewResult(results,id,row), canvasResult: row.metadata?.action?.actionId ? results.get(id, "canvas:" + row.metadata.action.actionId) : null}));
      return json(res,200,{conversation:current,...page});
    }
    if (req.method === "GET" && p === "/api/research") {
      const sessionId = String(url.searchParams.get("sessionId") || "").slice(0, 80);
      if (!sessionId) return json(res, 400, { error: "sessionId required" });
      const limit = boundedPositiveInt(url.searchParams.get("limit") ?? 20, 20, { max: 50 });
      return json(res, 200, { expeditions: kb.expeditionsForSession(sessionId, { limit }).map(row => ({...publicResearchAccess(row), reviewResult: results.get(sessionId, "research:" + row.id)})) });
    }
    if (req.method === "GET" && p === "/api/brain") return json(res, 200, { scope: "Isle of Man", stats: kb.stats(), overview: kb.ledgerOverview({ jurisdiction: "Isle of Man" }), topics: kb.topicSummary({ jurisdiction: "Isle of Man", limit: 20 }), retrieval: retrieval?.stats() || null, mommAllowance: mommHourlyAllowance.snapshot(), expeditions: expeditions.status(), recent: publicExpeditionRows(kb.recentExpeditions(8)), gaps: kb.openGaps(10, { jurisdiction: "Isle of Man" }), learned: kb.recentLearned(12, { jurisdiction: "Isle of Man" }).map((c) => ({ id: c.id, text: c.text, status: c.status, kind: c.kind, confidence: c.confidence, trust: Number(c.trust.toFixed(2)), sources: c.sources.map((s) => s.url), created_at: c.created_at })) });
    if (req.method === "GET" && p === "/api/claims") {
      const q = url.searchParams.get("q") || ""; const limit = boundedPositiveInt(url.searchParams.get("limit") ?? 20, 20, { max: 100 });
      const rows = q ? kb.search(q, { limit }) : kb.listClaims({ limit, status: url.searchParams.get("status") || undefined, kind: url.searchParams.get("kind") || undefined });
      return json(res, 200, { count: rows.length, claims: rows.map((c) => ({ ...c, trust: Number(c.trust.toFixed(2)) })) });
    }
    if (req.method === "GET" && p.startsWith("/api/claim/")) { const c = kb.getClaim(p.slice("/api/claim/".length)); return c ? json(res, 200, c) : json(res, 404, { error: "not found" }); }
    if (req.method === "POST" && !guardMutation(req, res, url.host)) return;
    if (req.method === "POST" && p === "/api/conversations") return json(res,201,{conversation:conversations.create()});
    if (req.method === "POST" && p === "/api/ask") {
      const body = await readJson(req);
      const problem = messageProblem(body.question);
      if (problem) return json(res, typeof body.question==="string" && body.question.length>MAX_MESSAGE_CHARS ? 413 : 400, {error:problem});
      const question = body.question.trim();
      const sessionId = String(body.sessionId || "anon").slice(0, 80);
      const requestId = String(body.requestId || randomUUID()).slice(0, 100);
      if (kb.db.prepare("SELECT 1 FROM conversation_turns WHERE id=?").get(requestId)) return json(res,409,{error:"this conversation turn was already accepted"});
      let resolution = dialogue.preview(sessionId, question, {
        source: body.source === "speech" ? "speech" : "typed",
        recognitionConfidence: body.recognitionConfidence,
        confirmed: body.confirmed === true,
        turnId: requestId,
        clientTurn: body.clientTurn,
      });
      if (body.researchTurnId) {
        const selected = researchOffer(kb.db, sessionId, String(body.researchTurnId).slice(0,100));
        if (!selected) return json(res, 409, {error:"That research offer is unavailable. Please ask the question again; no search was started."});
        const pendingAction = {kind:"research",subject:selected.subject,jurisdiction:selected.jurisdiction,status:"offered"};
        resolution = resolveSavedOffer(selected,dialogue.get(sessionId),{turnId:requestId,clientTurn:body.clientTurn});
        resolution = {...resolution,raw:question,route:'research',canonical:selected.subject,jurisdiction:selected.jurisdiction,conversationMeta:false,pendingAction,researchMode:selected.researchMode||sourceMode(selected.subject,{official:/official Manx sources/i.test(question)}),strategies:['research'],state:{...resolution.state,pendingAction:null}};
      }
      if(resolution.route==='research' && resolution.researchMode==='live_sources'){
        if(!isResearchable(resolution.canonical,{explicit:true}))return json(res,400,{error:'Please name a public factual question to search for.'});
        resolution={...resolution,route:'answer',liveSearch:true,speech:null,pendingAction:null,state:{...resolution.state,pendingAction:null}};
      }
      let selectedReview=null;
      if(resolution.route==='review'||(resolution.reviewRequested&&!resolution.reviewAfterSearch)){
        selectedReview=resolution.reviewTarget?{key:resolution.reviewTarget,label:resolution.canonical||'the previously requested answer'}:reviewTarget(kb,sessionId,dialogue.get(sessionId),{scope:resolution.reviewScope});
        if(!selectedReview.key)resolution={...resolution,reviewReceipt:{phase:'not_started',reason:selectedReview.reason},...(resolution.route==='review'?{speech:selectedReview.reason}:{})};
      }
      if(resolution.route==='readback'){
        const saved=readbackResult(kb,results,sessionId,resolution.readbackTarget);
        resolution={...resolution,speech:saved.text || saved.reason,resultMeta:{readback:{kind:saved.kind || null,turnId:saved.turnId || null}}};
      }
      if(resolution.route==='knowledge_info'){
        const info=knowledgeRuntime(kb,retrieval);resolution={...resolution,route:'conversation',speech:knowledgeSpeech(info),resultMeta:{knowledgeRuntime:info}};
      }
      if(resolution.route==='knowledge_integrity'){
        const check=knowledgeIntegrity(kb,retrieval);
        resolution={...resolution,route:'conversation',speech:check.ok?'The local ledger and vector index passed their storage, fingerprint and synchronisation checks. This verifies storage consistency, not the truth of every claim.':'The knowledge checks found an incomplete or unhealthy index. I have kept the detailed results with this answer and will not call it fully verified.',resultMeta:{knowledgeIntegrity:check}};
      }
      if(resolution.route==='runtime_info'){
        const info=await inspectMommVersion();
        resolution={...resolution,route:'conversation',speech:info.ok?'The installed MOMM dispatcher is version '+info.version+'. I checked it locally; no peer review or web search was needed.':info.reason,resultMeta:{mommRuntime:info}};
      }
      if (resolution.route === "knowledge_map") {
        // A map of what the ledger holds is answered from the ledger itself:
        // no model call, no spend, and the reply says what to build next.
        const map = knowledgeMap(kb, resolution.subject, { retrieval: retrieval?.stats() || null });
        resolution = { ...resolution, route: "conversation", speech: map.speech, resultMeta: { knowledgeMap: map.summary } };
      }
      const answerAbort = ['answer','weather'].includes(resolution.route) ? new AbortController() : null;
      if (resolution.route === "research" && !isResearchable(resolution.canonical,{explicit:true})) return json(res,400,{error:"That is a conversation question or an unfinished request, not a source-check question. No research was started."});
      const operation = answerAbort ? { controller: answerAbort, key: resolution.semanticKey } : null;
      const requestIdentity = { sessionId, requestId, clientTurn: body.clientTurn };
      const admission = operation
        ? activeAnswers.admit({ ...requestIdentity, operation, replacePrevious: body.replacePrevious === true })
        : activeAnswers.completeLocal({ ...requestIdentity, replacePrevious: body.replacePrevious === true });
      // A rejected request must not become the topic that a later “all” binds to.
      if (!admission.ok) return json(res, admission.status, { error: admission.error });
      if (admission.previous) {
        admission.previous.operation.controller.abort();
        dialogue.cancel(sessionId, admission.previous.operation.key);
        resolution = { ...resolution, state: { ...resolution.state, inFlightKey: null } };
      }
      if (resolution.route === "visual") {
        const actionId = createVisualAction({ sessionId, resolution, clientTurn: body.clientTurn });
        resolution = { ...resolution, action: { ...resolution.action, actionId } };
      }
      let researchAdmission = null;
      if (resolution.route === "research") {
        researchAdmission = expeditions.enqueue({
          question: resolution.canonical,
          originalQuestion: question,
          reason: "requested by the user",
          jurisdiction: resolution.jurisdiction,
          strategies: resolution.strategies,
          mode: resolution.researchMode,
          sessionId,
        });
        if (researchAdmission.queued) kb.addGap(resolution.canonical, "requested by the user", { jurisdiction: resolution.jurisdiction });
        const pendingAction = {
          ...resolution.pendingAction,
          status: researchAdmission.queued || researchAdmission.alreadyRunning ? "running" : "blocked",
          id: researchAdmission.id || null,
        };
        resolution = {
          ...resolution,
          pendingAction,
          speech: researchAdmission.queued
            ? resolution.speech || (researchAdmission.mode === "official_sources"
              ? "Right. I’m checking the official Manx sources now, and I’ll attach what I find to this conversation."
              : "Right. I’m running the full source, adversarial, lateral and multi-model check, and I’ll show each stage here.")
            : researchAdmission.alreadyRunning
              ? "That research check is already under way. I’ll tell you when it is ready."
              : `I cannot start that check just now: ${researchAdmission.reason}.`,
          state: { ...resolution.state, pendingAction },
        };
      }
      if(selectedReview?.key){
        try{
          const target=selectedReview.key.startsWith('research:')?{expeditionId:selectedReview.key.slice(9)}:{episodeId:selectedReview.key};
          const job=reviewJobs.start({...target,sessionId});
          resolution={...resolution,state:{...resolution.state,lastReviewTarget:selectedReview.key,lastOperation:{kind:'review',scope:resolution.reviewScope||'answer',target:selectedReview.key}},reviewReceipt:{...job.receipt},action:{kind:'review_answer',target:selectedReview.key,label:selectedReview.label,serverStarted:true,operation:{...job.receipt}},
            ...(resolution.route==='review'?{speech:(selectedReview.assessment?selectedReview.assessment+'\n\n':'')+(job.cached?'The saved MOMM review is ready.':'I have accepted the MOMM review for “'+selectedReview.label+'”. It will continue while we talk; reviewer agreement is not source verification.')}:{})};
        }catch(error){resolution={...resolution,reviewReceipt:{phase:'not_started',reason:error.message},...(resolution.route==='review'?{speech:(selectedReview.assessment?selectedReview.assessment+'\n\n':'')+'I could not start that review: '+error.message}:{})};}
      }
      dialogue.commit(sessionId, resolution);
      conversations.start({id:requestId,sessionId,clientTurn:body.clientTurn,question,resolution});
      const writeEvent = sseStart(res);
      let streamedAnswer = "";
      let lastCheckpoint = Date.now();
      const turnMetadata = {};
      const send = (event,data) => {
        if (event === "token") streamedAnswer += String(data.text || "");
        if (["meta","action","interpretation","expedition","memory"].includes(event)) turnMetadata[event] = data;
        if(event==='tool')turnMetadata.tools=[...(turnMetadata.tools||[]),data].slice(-12);
        if ((event === "token" && Date.now()-lastCheckpoint>=1000) || event === "meta") {
          conversations.checkpoint(requestId,streamedAnswer,turnMetadata);lastCheckpoint=Date.now();
        }
        writeEvent(event,data);
      };
      bus.publish("ask", { sessionId, question, resolvedQuestion: resolution.canonical, route: resolution.route });
      if(resolution.reviewAfterSearch)send('tool',{name:'momm',status:'waiting',message:'I will review the answer from this request after it has been saved. The review will not count as source verification.'});
      if(resolution.reviewRequested&&!resolution.reviewAfterSearch){send('action',resolution.action||{kind:'review_unavailable',operation:resolution.reviewReceipt});send('tool',{name:'momm',status:resolution.action?'accepted':'unavailable',message:resolution.action?'MOMM review accepted; the source search is a separate operation.':resolution.reviewReceipt?.reason});}
      if (researchAdmission) send("expedition", { ...researchAdmission, reason: researchAdmission.queued ? "requested by the user" : researchAdmission.reason });
      const cancelAnswer = () => { if (!res.writableEnded) answerAbort?.abort(); };
      if (answerAbort) res.on("close", cancelAnswer);
      if (operation) {
        dialogue.markInFlight(sessionId, resolution);
      }
      let answerCompleted = false;
      let answerResult = null;
      try {
        answerResult = await answer({ kb, retrieval, question, resolution, sessionId, conversations, requestId, emit: send, expeditions, root: ROOT, wantExpedition: Boolean(body.expedition), signal: answerAbort?.signal });
        answerCompleted = true;
        const reviewed=reviewAfterLookup({requested:resolution.reviewAfterSearch,result:answerResult,sessionId,jobs:reviewJobs,signal:answerAbort?.signal});
        if(reviewed){send('action',reviewed);send('tool',{name:'momm',status:reviewed.kind==='review_answer'?'accepted':'unavailable',message:reviewed.kind==='review_answer'?'The answer is saved and its MOMM review has been accepted.':reviewed.operation.reason});if(reviewed.kind==='review_answer')dialogue.commit(sessionId,{...resolution,state:{...dialogue.get(sessionId),lastReviewTarget:reviewed.target,lastOperation:{kind:'review',target:reviewed.target}}});}
      }
      catch (err) {
        if (err.name !== "AbortError") { send("error", { message: err.message }); bus.publish("ask.failed", { sessionId, question, error: err.message }); }
      }
      finally {
        conversations.finish(requestId,{answer:answerResult?.text || streamedAnswer,status:answerCompleted ? "complete" : answerAbort?.signal.aborted ? "interrupted" : "failed",episodeId:answerResult?.episodeId,metadata:turnMetadata});
        if (answerAbort) res.off("close", cancelAnswer);
        // A superseded request must never clear the newer request's in-flight key.
        if (operation && activeAnswers.release(requestId, operation)) {
          if (answerCompleted) dialogue.complete(sessionId, resolution.semanticKey, {
            preservePendingAction:Boolean(resolution.preservePendingAction),
            ...(resolution.preservePendingQuestion ? {} : {pendingQuestion: assistantQuestion(answerResult?.text),subject: resolution.state.lastSubstantiveQuestion || resolution.canonical}),
            pendingAction: answerResult?.pendingAction || (answerResult?.researchOffered
              ? { kind: "research", subject: resolution.canonical, jurisdiction:resolution.jurisdiction, label: "Search this answer",researchMode:'live_sources',...(turnMetadata.meta?.reviewable&&answerResult?.episodeId?{reviewTarget:answerResult.episodeId}:{}) }
              : null),
          });
          else dialogue.cancel(sessionId, resolution.semanticKey);
        }
      }
      return res.end();
    }
    if (req.method === "POST" && p === "/api/tools/stop") {
      const body=await readJson(req),sessionId=String(body.sessionId||'anon').slice(0,80);
      // Stop is the one gesture that cancels paid work: reviews, canvases and this conversation's research.
      reviewJobs.stop(sessionId);stopToolWork({sessionId});expeditions.cancelSession(sessionId);return json(res,200,{ok:true,status:'stop_requested'});
    }
    if (req.method === "POST" && p === "/api/session/reset") {
      const body = await readJson(req).catch(() => ({}));
      const sessionId = String(body.sessionId || "anon").slice(0, 80);
      // Leaving a conversation stops what is being spoken, not what was paid
      // for. Research, MOMM reviews and canvases carry on and save to the
      // conversation they belong to; only an explicit Stop cancels them.
      activeAnswers.getSession(sessionId)?.operation.controller.abort();
      dialogue.cancel(sessionId);
      return json(res, 200, { ok: true, scope: "Isle of Man" });
    }
    if (req.method === "POST" && p === "/api/feedback") {
      const body = await readJson(req);
      const r = kb.setFeedback(String(body.episodeId || ""), body.vote);
      if (!r) return json(res, 404, { error: "episode not found" });
      if (r.error) return json(res, 400, r);
      bus.publish("feedback", r);
      return json(res, 200, r);
    }
    if (req.method === "GET" && p === "/api/deliberate/status") {
      const sessionId=String(url.searchParams.get('sessionId')||'anon').slice(0,80),episodeId=String(url.searchParams.get('episodeId')||'').slice(0,100);
      const target=episodeId.startsWith('research:')?episodeId:'episode:'+episodeId;
      const job=reviewJobs.get(sessionId,target);
      if(job&&url.searchParams.get('wait')==='1')return json(res,200,await job.promise);
      const saved=results.get(sessionId,target);return json(res,saved?200:404,saved||{error:'No review was accepted for this answer in this conversation.'});
    }
    if (req.method === "POST" && p === "/api/deliberate") {
      const body=await readJson(req);
      try{return json(res,200,await reviewJobs.start(body).promise);}catch(error){return json(res,error.status||500,{error:error.message});}
    }
    if (req.method === "POST" && p === "/api/canvas") {
      const body = await readJson(req);
      if (!acceptingToolWork) return json(res, 503, { error: "Oracle is shutting down" });
      const actionId = String(body.actionId || "").slice(0, 100);
      const sessionId = String(body.sessionId || "anon").slice(0, 80);
      const savedCanvas = results.get(sessionId,"canvas:" + actionId);
      if (savedCanvas?.ok) return json(res,200,{...savedCanvas,cached:true});
      pruneVisualActions();
      const visualAction = visualActions.get(actionId) || restoreVisualAction(actionId, sessionId, savedCanvas);
      if (!visualAction || visualAction.sessionId !== sessionId) return json(res, 404, { error: "visual request not found in this conversation" });
      if (visualAction.jurisdiction !== "Isle of Man" || !safeForExternalPeerReview(visualAction.question)) {
        return json(res, 400, { error: "Reviewed canvas is limited to non-sensitive public Isle of Man subjects." });
      }
      // A canvas accepted for an earlier turn is still that turn's canvas; a
      // later "thanks" must not make it unobtainable.
      if (!visualAction.promise) {
        const controller = new AbortController();
        visualAction.controller = controller;
        // The whole generation, retrieval included, sits behind one promise
        // assigned before anything is awaited, so two requests for the same
        // canvas share one paid generation instead of racing to start two.
        const visualPromise = (async () => {
          // The same retrieval as an answer, so a canvas is drawn from the
          // evidence the spoken answer would have used.
          const focus = retrieval
            ? await retrieval.focus(visualAction.question, { jurisdiction: visualAction.jurisdiction, budgetTokens: 2_400, signal: controller.signal })
            : kb.focus(visualAction.question, { jurisdiction: visualAction.jurisdiction, limit: 12, budgetTokens: 2_400 });
          const publicClaims = publicManxClaimsForVisual(focus.claims);
          // The browser supplies only an opaque id. Peer services receive a
          // bounded public-fact projection with no claim/session ids, URLs,
          // provenance records, raw speech or client-created specification.
          return createReviewedVisual({
            question: visualAction.question,
            ledgerClaims: publicClaims,
            cwd: ROOT,
            allowance: mommHourlyAllowance,
            signal: controller.signal,
          });
        })().catch((error) => ({ ok: false, reason: "visual generation failed", narration: cleanSummary(error?.message, 240), review: null }));
        visualAction.promise = trackToolWork({
          sessionId,
          kind: "canvas",
          controller,
          promise: visualPromise,
        });
      }
      // A browser that navigates away or asks something else mid-generation
      // does not cancel the canvas: it is paid work and it saves to the
      // conversation, where a later request or a reload finds it. Only an
      // explicit Stop cancels it.
      const result = await visualAction.promise;
      if (visualAction.cancelled) return json(res, 200, { ok: false, reason: "visual request superseded", narration: "The canvas request was cancelled before it completed.", review: null });
      const review = publicReview(result.review);
      if (!result.ok) {
        const failed = { ok: false, phase: "failed", reason: cleanSummary(result.reason, 160), narration: cleanSummary(result.narration, 500), review, question: visualAction.question, jurisdiction: visualAction.jurisdiction, requestedType: visualAction.requestedType, clientTurn: visualAction.clientTurn };
        try { results.put(sessionId, "canvas:" + actionId, visualAction.question, failed); } catch { /* the failure is still reported */ }
        // A failure is not cached as the answer: "Try the visual again" gets a fresh generation.
        visualAction.promise = null; visualAction.controller = null;
        return json(res, 200, failed);
      }
      if (visualAction.clientTurn == null || activeAnswers.isCurrentTurn(sessionId, visualAction.clientTurn)) {
        const state = dialogue.get(sessionId);
        dialogue.set(sessionId, { ...state, lastArtifact: { id: actionId, kind: "canvas", title: result.spec.title, reviewed: result.review?.successes > 0 } });
      }
      const completedCanvas = {ok:true,narration:cleanSummary(result.narration,500),spec:result.spec,review};
      results.put(sessionId,"canvas:" + actionId,visualAction.question,completedCanvas);
      return json(res, 200, completedCanvas);
    }
    if (req.method === "POST" && p === "/api/expedition") {
      const body = await readJson(req);
      const rawQuestion = String(body.question || "").trim().slice(0, 2000);
      if (!rawQuestion) return json(res, 400, { error: "question required" });
      if (/^(?:all|everything|tell me|tell me more|go on|continue|carry on|figure it out|do it)[?.!,\s]*$/i.test(rawQuestion)) {
        return json(res, 200, { queued: false, reason: "That follow-up has no complete research subject; I have not created a gap." });
      }
      const sessionId = String(body.sessionId || "anon").slice(0, 80);
      const state = dialogue.get(sessionId);
      let question = null;
      let jurisdiction = "Isle of Man";
      if (state.lastCompletedKey && rawQuestion === state.lastActionable) {
        // The browser sends the canonical request reported by the completed answer.
        question = rawQuestion;
      } else {
        const resolution = dialogue.preview(sessionId, rawQuestion, { source: "typed", confirmed: true });
        if (resolution.route !== "answer" || !resolution.canonical) {
          return json(res, 200, { queued: false, reason: "Ask a complete question first; I have not created a research gap." });
        }
        if (state.lastCompletedKey !== resolution.semanticKey) {
          return json(res, 200, { queued: false, reason: "Let me answer that subject first; I have not created a research gap." });
        }
        question = resolution.canonical;
        jurisdiction = resolution.jurisdiction;
      }
      const asked = Array.isArray(body.strategies) ? body.strategies.filter((s) => ["research", "adversarial", "cross_model", "lateral"].includes(s)) : [];
      if (!isResearchable(question,{explicit:true})) return json(res,200,{queued:false,reason:"That is a conversation question or an unfinished request; no research was started."});
      const mode = body.mode === "official_sources" ? "official_sources" : "deep";
      const strategies = mode === "official_sources" ? ["research"] : asked.length ? asked : undefined;
      const admission = expeditions.enqueue({ question, originalQuestion: rawQuestion, reason: String(body.reason || "requested by the user"), strategies, mode, sessionId, jurisdiction });
      if (admission.queued) kb.addGap(question, "requested", { jurisdiction });
      return json(res, 200, admission);
    }
    if (req.method === "POST" && p === "/api/expedition/cancel") {
      const body = await readJson(req);
      const id = String(body.id || "").slice(0, 100);
      if (!id) return json(res, 400, { error: "research id required" });
      return json(res, 200, expeditions.cancel(id, String(body.sessionId || "anon").slice(0, 80)));
    }
    if (req.method === "POST" && p === "/api/dream") {
      const target = curiosityTarget(kb);
      if (!target) return json(res, 200, { queued: false, reason: "nothing to dream about yet" });
      const body = await readJson(req).catch(() => ({}));
      return json(res, 200, { ...expeditions.enqueue({ ...target, mode: "deep", sessionId: String(body.sessionId || "dream").slice(0, 80) }), target });
    }
    if (req.method === "GET") return serveStatic(req, res, p);
    json(res, 404, { error: "not found" });
  } catch (err) {
    if (!res.headersSent) {
      if(err.status===413) res.setHeader("Connection","close");
      json(res, err.status || 500, { error: err.message });
    } else res.end();
  }
});

server.listen(PORT, HOST, () => {
  // Recovery is safe only after owning both the database lease and listener.
  conversations.interruptRunning();
  for (const row of kb.db.prepare("SELECT DISTINCT e.session_id FROM episodes e LEFT JOIN conversation_turns t ON t.episode_id=e.id WHERE t.id IS NULL AND e.session_id IS NOT NULL AND e.session_id<>'' AND e.session_id<>'anon'").all()) conversations.importLegacy(row.session_id);
  const interrupted = kb.interruptRunning();
  if (interrupted) console.log(`[oracle] marked ${interrupted} expedition(s) from a previous process as interrupted`);
  console.log(`[oracle] listening on http://${HOST}:${PORT}  claims=${kb.count()}  momm=${findMommScript() ? "found" : "not found"}  expeditions=${expeditions.enabled ? "auto" : "off"}`);
});
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const closed = new Promise((resolve) => server.close(resolve));
  for (const record of activeAnswers.values()) record.operation.controller.abort();
  expeditions.stop();
  stopToolWork();
  const forceTimer = setTimeout(() => server.closeAllConnections?.(), 250);
  forceTimer.unref?.();
  const drained = Promise.all([activeAnswers.whenEmpty(), expeditions.whenIdle(), whenToolWorkEmpty()]);
  let deadlineTimer;
  const slow = await Promise.race([
    drained.then(() => false),
    new Promise((resolve) => { deadlineTimer = setTimeout(() => resolve(true), 5_000); deadlineTimer.unref?.(); }),
  ]);
  clearTimeout(deadlineTimer);
  if (slow) {
    console.error("[oracle] shutdown exceeded 5 seconds; keeping the knowledge base open until active work settles");
    process.exitCode = 1;
    await drained;
  }
  await closed;
  releaseInstance();
  retrieval?.close();
  kb.close();
  if (!slow) process.exitCode = 0;
}
process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
