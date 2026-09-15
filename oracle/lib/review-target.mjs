import {conversationReviewTarget} from './conversation-review.mjs';
import {conversationRepairQuestion} from '../public/conversation-policy.mjs';
import {episodeReviewable} from './deliberate.mjs';
import {researchReviewEpisode} from './results.mjs';
import {safeForExternalPeerReview,publicReviewScope} from './external-policy.mjs';

export function storedReviewProblem(kb,sessionId,episode){
  let turn=kb.db.prepare('SELECT status,metadata FROM conversation_turns WHERE session_id=? AND episode_id=? ORDER BY seq DESC LIMIT 1').get(sessionId,episode.id);
  if(!turn)return null; // Older ledger episodes may predate the conversation store.
  let meta;try{meta=JSON.parse(turn.metadata)?.meta;}catch{return 'That saved answer has no usable review metadata.';}
  if(turn.status!=='complete'||meta?.answered===false||meta?.reviewable===false||meta?.answerOutcome==='source_unavailable')return 'That source check or conversation response is not a completed substantive answer for review.';
  return null;
}

/** Server-owned active artifact only. No raw dialogue or client-supplied text. */
export function reviewTarget(kb,sessionId,state={},options={}) {
  if(options.scope==='conversation')return conversationReviewTarget(kb,sessionId);

  let turn=kb.db.prepare("SELECT * FROM conversation_turns WHERE session_id=? AND status='complete' AND route IN ('answer','conversation','research','weather','clarify') ORDER BY seq DESC LIMIT 1").get(sessionId);
  // "Use MOMM" reviews an answer. When there is none, say so: a paid review of
  // the system's own note about a clarification is not what was asked for.
  // The conversation assessment stays available under its own explicit scope.
  const assessLatest=()=>turn?conversationReviewTarget(kb,sessionId,{turnId:turn.id}):{reason:'There is no public task to assess in this conversation yet.'};
  // A clarification or a conversational aside is not a task: "use MOMM" after
  // a mis-heard "show me a map" was buying a review of the system's own note.
  const noAnswer=()=>({reason:'There is no completed answer to review yet. Ask a question first, then say “use MOMM”; to assess the conversation itself, say “assess this conversation”.'});
  if(turn&&(!publicReviewScope(turn.jurisdiction)||!safeForExternalPeerReview(turn.question,turn.answer)))return {reason:'This task contains private or sensitive content and cannot be sent for external review.'};
  let currentMeta={};try{currentMeta=JSON.parse(turn?.metadata||'{}').meta||{};}catch{/* Older malformed metadata is not reviewable. */}
  if(currentMeta.answerOutcome==='source_unavailable'||conversationRepairQuestion(turn?.resolved_question||turn?.question)||['self_assessment','recap'].includes(currentMeta.intent)){
    const stop=new Set('answer specifically public question sources source check status current about latest government foundations amendment bill'.split(' ').slice(0,-3));
    const terms=q=>new Set((String(q||'').toLowerCase().match(/[a-z]{5,}/g)||[]).filter(w=>!stop.has(w)));
    const subject=terms(currentMeta.answerOutcome==='source_unavailable'?(turn.resolved_question||turn.question):state.lastSubstantiveQuestion);
    for(const earlier of kb.db.prepare("SELECT * FROM conversation_turns WHERE session_id=? AND status='complete' AND seq<? ORDER BY seq DESC LIMIT 12").all(sessionId,turn.seq)){
      if(['review','readback'].includes(earlier.route))continue;
      let earlierMeta={};try{earlierMeta=JSON.parse(earlier.metadata)?.meta||{};}catch{/* fail closed below */}
      if(['self_assessment','recap'].includes(earlierMeta.intent)||conversationRepairQuestion(earlier.resolved_question||earlier.question))continue;
      const shared=[...terms(earlier.resolved_question||earlier.question)].filter(w=>subject.has(w));
      if(!shared.length||earlier.route==='weather')break;
      let meta={};try{meta=JSON.parse(earlier.metadata)?.meta||{};}catch{break;}
      if(meta.answerOutcome==='source_unavailable')continue;
      if(meta.conversationMeta||meta.reviewable===false)break;
      turn=earlier;break;
    }
  }
  const research=state.researchFocusId?kb.getExpedition(state.researchFocusId):null;
  let episode,key,label;
  if(research?.session_id===sessionId && (!turn || String(research.finished_at)>String(turn.updated_at))){
    episode=researchReviewEpisode(research,sessionId);key='research:'+research.id;label=research.question;
  }else if(turn){
    if(turn.route==='clarify')return noAnswer();
    if(turn.route==='weather')return assessLatest();
    let metadata={};try{metadata=JSON.parse(turn.metadata);}catch{/* fail closed below */}
    if(metadata.meta?.conversationMeta)return noAnswer();
    if(metadata.meta?.reviewable===false)return assessLatest();
    episode=turn.episode_id?kb.getEpisode(turn.episode_id):null;key=turn.episode_id;label=turn.resolved_question||turn.question;
  }
  if(!episode || episode.session_id!==sessionId || !episodeReviewable({answer:episode.answer,resolvedQuestion:episode.resolved_question,status:episode.status,kind:'answer'}))return assessLatest();
  if(!publicReviewScope(episode.jurisdiction) || !safeForExternalPeerReview(episode.resolved_question,episode.answer))return {reason:'I cannot send that answer for external review: MOMM is limited to non-sensitive public questions.'};
  const problem=storedReviewProblem(kb,sessionId,episode);if(problem)return assessLatest();
  return {key,label:String(label||'the last answer').replace(/^Answer this specifically for the Isle of Man:\s*/i,'').slice(0,220)};
}
