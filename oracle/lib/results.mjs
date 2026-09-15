import {usableReviewAnswer} from './review-quality.mjs';
import {capabilityRequest} from '../public/request-coverage.mjs';
import { createHash } from "node:crypto";
import { citableSources, accessibleResearchSources, classifyResearchOutcome } from "./learning.mjs";
import { createDialogueState, resolveDialogue } from "./dialogue.mjs";
import {validateVisualSpec} from './visual.mjs';
import {manxReviewScope,publicReviewScope,safeForExternalPeerReview} from './external-policy.mjs';

const fingerprint = value => createHash("sha256").update(String(value || "")).digest("hex");

/** Durable public artifacts, isolated by conversation. Never stores raw prompts. */
export class ResultStore {
  constructor(db) {
    this.db = db;
    db.exec("CREATE TABLE IF NOT EXISTS oracle_results (session_id TEXT NOT NULL, target TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(session_id,target))");
  }
  get(sessionId, target, content) {
    const row = this.db.prepare("SELECT fingerprint,payload FROM oracle_results WHERE session_id=? AND target=?").get(sessionId, target);
    if (!row || (content !== undefined && row.fingerprint !== fingerprint(content))) return null;
    try {
      const result=JSON.parse(row.payload);
      // Quarantine the projection; preserve raw history and peer findings.
      if(/^(?:episode|research):/.test(target)&&result?.ok&&!usableReviewAnswer(result.answer))return {...result,ok:false,answer:null,reason:'unusable_review_answer',message:'The saved review did not produce a usable answer. Its findings are retained.',operation:{...result.operation,phase:'failed',reason:'unusable_review_answer'}};
      return result;
    } catch { return null; }
  }
  put(sessionId, target, content, payload) {
    if (!sessionId || !/^(episode|research|canvas):[a-z0-9_.:-]{3,100}$/i.test(target)) throw new Error("Invalid result target");
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json) > 160000) throw new Error("Result is too large to save safely");
    this.db.prepare("INSERT INTO oracle_results(session_id,target,fingerprint,payload,created_at) VALUES(?,?,?,?,?) ON CONFLICT(session_id,target) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload,created_at=excluded.created_at")
      .run(sessionId, target, fingerprint(content), json, new Date().toISOString());
    return payload;
  }
}

/** Read saved content verbatim or a deterministic chart text alternative. No model or external calls. */
export function readbackResult(kb, results, sessionId, target='latest') {
  const rows=kb.db.prepare("SELECT * FROM conversation_turns WHERE session_id=? AND status='complete' AND route<>'readback' ORDER BY seq DESC LIMIT 80").all(sessionId);
  for(const row of rows) {
    let metadata={};try{metadata=JSON.parse(row.metadata)||{};}catch{/* malformed old metadata is not executable */}
    const canvasId=metadata.action?.kind==='generate_canvas'?metadata.action.actionId:null;
    const canvas=canvasId?results.get(sessionId,'canvas:'+canvasId):null;
    const reviewKey=metadata.action?.kind==='review_answer' && typeof metadata.action.target==='string' && /^(?:research:)?[a-z0-9_.:-]{1,100}$/i.test(metadata.action.target)?metadata.action.target:null;
    const review=reviewKey?results.get(sessionId,reviewKey.startsWith('research:')?reviewKey:'episode:'+reviewKey):row.episode_id?results.get(sessionId,'episode:'+row.episode_id,row.answer):null;
    let content,kind;
    if(target==='canvas' || (target==='latest' && canvasId)) {
      if(!canvasId)continue;
      if(!canvas?.ok || !canvas.spec)return {reason:'That canvas has no completed saved result to read yet.'};
      const checked=validateVisualSpec(canvas.spec,{factual:canvas.spec.factual!==false});
      if(!checked.ok)return {reason:'That saved chart is invalid or unreadable, so I cannot read it as a completed result.'};
      const spec=checked.value;
      const parts=[spec.title,canvas.narration,spec.asOf?`As of ${spec.asOf}.`:null];
      if(spec.kind==='node-edge') {
        const nodes=Array.isArray(spec.nodes)?spec.nodes:[],edges=Array.isArray(spec.edges)?spec.edges:[];
        const labels=new Map(nodes.map(n=>[n.id,n.label]));
        parts.push(...nodes.map(n=>n.label));
        parts.push(...edges.map(e=>`${labels.get(e.from)||e.from} ${e.label || 'connects to'} ${labels.get(e.to)||e.to}.`));
      } else {
        if(spec.xLabel || spec.yLabel)parts.push(`Axes: ${spec.xLabel || 'horizontal'}; ${spec.yLabel || 'vertical'}.`);
        for(const series of (Array.isArray(spec.series)?spec.series:[]))parts.push(`${series.name || 'Values'}: ${(series.points||[]).map(p=>`${p.x}: ${p.y}`).join('; ')}.`);
      }
      content=parts.filter(v=>typeof v==='string' && v.trim()).join(' ');kind='chart';
    } else if(target==='review' || (target==='latest' && (reviewKey || review?.ok))) {
      if(!review?.ok || !review.answer){if(reviewKey)return {reason:'That review has no completed saved result to read yet.'};continue;}
      content=review.answer;kind='review';
    } else {
      const researchId=metadata.expedition?.id;
      const research=researchId?kb.getExpedition(researchId):null;
      if(research && research.session_id===sessionId && research.finished_at && research.summary){content=research.summary;kind='research result';}
      else if(row.route==='research')return {reason:'That source check has no completed saved result to read yet.'};
      else {content=row.answer;kind='answer';}
    }
    if(typeof content!=='string' || !content.trim())return {reason:'There is no completed text in that result to read.'};
    const bounded=content.length>11500?content.slice(0,11500)+' The rest is in the saved result; this reading is shortened.':content;
    return {text:`Reading the saved ${kind}, not a new check. ${bounded}`,kind,turnId:row.id};
  }
  return {reason:`There is no completed ${target==='latest'?'answer':target} to read in this conversation yet.`};
}

/** Resolve a clicked offer from its stored turn, never from client-written text. */
export function researchOffer(db, sessionId, turnId) {
  const row = db.prepare("SELECT * FROM conversation_turns WHERE id=? AND session_id=? AND status='complete'").get(turnId, sessionId);
  if (!row || !publicReviewScope(row.jurisdiction) || !safeForExternalPeerReview(row.resolved_question)) return null;
  const resolved=resolveDialogue(row.resolved_question, createDialogueState());
  let metadata; try { metadata = JSON.parse(row.metadata); } catch { return null; }
  if(resolved.conversationMeta){
    // A capability explanation may offer one concrete lookup. Recompute its
    // server-owned subject; never promote arbitrary conversation prose.
    const expected=resolved.intent==='product'?resolved.pendingAction:null;
    const saved=(Array.isArray(metadata?.meta?.nextSteps)?metadata.meta.nextSteps:[]).find(step=>step?.kind==='research');
    if(!expected || metadata?.meta?.intent!=='product' || !metadata?.meta?.conversationMeta || saved?.subject!==expected.subject || saved?.researchMode!==expected.researchMode)return null;
    return {subject:expected.subject,turnId:row.id,jurisdiction:expected.jurisdiction,researchMode:expected.researchMode};
  }
  if (metadata.meta?.conversationMeta || metadata.meta?.researchable === false) return null;
  const offer = (Array.isArray(metadata?.meta?.nextSteps)?metadata.meta.nextSteps:[]).find(step => step?.kind === "research" && typeof step.subject === "string");
  const expected=capabilityRequest(row.resolved_question)?.lookupQuestion || row.resolved_question;
  if (!offer || !expected || offer.subject !== expected) return null;
  return { subject: expected, turnId: row.id, jurisdiction:row.jurisdiction, researchMode:offer.researchMode };
}

/** Recheck historical access labels without rewriting the stored audit record. */
export function publicResearchAccess(row) {
  const unreachable = row?.preview?.unreachable || [];
  if (!row || !["done","partial","empty"].includes(row.status) || !unreachable.length) return row;
  const learned = (row.learned || []).map(claim => ({...claim,sources:accessibleResearchSources(claim.sources,unreachable)})).filter(claim => claim.sources.length);
  if (JSON.stringify(learned) === JSON.stringify(row.learned || [])) return row;
  const outcome = classifyResearchOutcome({mode:row.mode,learned,unreachable});
  const summary = "Some cited pages could not be read. " + (learned.length ? "Provisional accessible-source findings: " + learned.map(claim=>claim.text).join(" ").slice(0,4500) : "This check has no findings supported by a readable cited page.") + " Unresolved questions remain below.";
  return {...row,...outcome,unreachable,learned,summary,progress:{...(row.progress && typeof row.progress === "object" && !Array.isArray(row.progress) ? row.progress : {}),...outcome},preview:{...row.preview,...outcome,unreachable,summary}};
}

/** Review only this expedition's saved evidence, never later merged KB sources. */
export function researchReviewEpisode(row, sessionId) {
  row = publicResearchAccess(row);
  if (!row || row.session_id !== sessionId || !manxReviewScope(row.jurisdiction) || !["done", "partial"].includes(row.status)) return null;
  const learned = Array.isArray(row.learned) ? row.learned.filter(claim => claim?.text && !["hypothesis", "contested", "retracted"].includes(claim.status)) : [];
  if (!learned.length) return null;
  const sources = citableSources(learned.flatMap(claim => (claim.sources || []).map(source => typeof source === "string" ? {url:source,title:source} : source)));
  if (!sources.some(source => source.citable)) return null;
  const limitations = (row.preview?.unresolved || []).map(String).join(" ");
  const caveat = limitations ? "Unverified limitations: " + limitations.slice(0,1200) + (limitations.length > 1200 ? " [More limitations in the saved research.]" : "") + "\n" : "";
  const content = [...new Set(learned.map(claim => claim.text))].join("\n");
  const budget = 4700 - caveat.length;
  const answer = caveat + (content.length > budget ? "Review scope: a bounded excerpt of the saved research, not its complete contents.\n" + content.slice(0,budget) : content);
  return {id:"research:" + row.id,session_id:sessionId,question:row.question,resolved_question:row.question,jurisdiction:row.jurisdiction,answer,status:"model_prior",confidence:0.4,claims_used:[],sources,kind:"answer",created_at:row.created_at};
}

/** Restore a server-owned review receipt on its command turn, scoped to this session. */
export function savedReviewResult(results,sessionId,row){
  const action=row.metadata?.action;
  const key=action?.kind==='review_answer'&&typeof action.target==='string'&&/^(?:research:)?[a-z0-9_.:-]{1,100}$/i.test(action.target)?action.target:null;
  if(key)return results.get(sessionId,key.startsWith('research:')?key:'episode:'+key);
  return row.episode_id?results.get(sessionId,'episode:'+row.episode_id):null;
}
