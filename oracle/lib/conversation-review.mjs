import {createHash} from 'node:crypto';
import {conversationRepairQuestion} from '../public/conversation-policy.mjs';
import {safeForExternalPeerReview,publicReviewScope} from './external-policy.mjs';
const disclosureText=s=>String(s||'').replace(/\s+/g,' ');
const sensitiveDisclosure=s=>/\b(?:your|you mentioned|you told me)\b.{0,90}\b(?:diagnosis|depression|medication|illness|salary|income|address|daughter|son|husband|wife|religion|faith|sexuality)\b|\b(?:password|passcode|national insurance|medical record)\b/i.test(disclosureText(s));
const personalDisclosure=s=>/\b(?:my|our|we|i (?:am|have|had|was|were|live|work|suffer|take|earn)|i[’'](?:m|ve))\b/i.test(disclosureText(s))||sensitiveDisclosure(s);
const json=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
const clean=(s,n)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
// Explicit conversation review exports bounded public task excerpts, never the
// full transcript, personal conversation, local IDs, credentials or databases.
export function conversationReviewTarget(kb,sessionId,{turnId=null,throughTurnId=null}={}){
 const cutoff=throughTurnId?kb.db.prepare('SELECT seq FROM conversation_turns WHERE id=? AND session_id=?').get(throughTurnId,sessionId)?.seq:null;
 if(throughTurnId&&!cutoff)return {reason:'The requested earlier task is unavailable in this conversation.'};
 const all=kb.db.prepare("SELECT * FROM conversation_turns WHERE session_id=? AND status<>'processing' AND route NOT IN ('review','readback') AND (? IS NULL OR seq<=?) ORDER BY seq DESC LIMIT 40").all(sessionId,cutoff,cutoff).reverse();
 const eligible=all.filter(row=>{
  if(turnId&&row.id!==turnId)return false;
  if(row.id.startsWith('legacy:')&&kb.getEpisode(row.episode_id)?.model?.startsWith('conversation-review:'))return false;
  const meta=json(row.metadata).meta||{};
  return publicReviewScope(row.jurisdiction)&&safeForExternalPeerReview(row.question,row.answer)&&!personalDisclosure(row.question)&&!sensitiveDisclosure(row.answer)&&!['personal_identity','shared_identity','reflection','pronoun_reference','identity','everyday','creative'].includes(meta.intent)&&(!meta.conversationMeta||['product','self_assessment','recap','clarification'].includes(meta.intent));
 });
 if(!eligible.length)return {reason:'There are no non-sensitive public task turns to review. Personal exchanges stay on this computer.'};
 const selected=eligible.slice(-10).reverse();
 const parts=[];let budget=3600;
 for(const row of selected){
  const meta=json(row.metadata),ops=(meta.meta?.tools||meta.tools||[]).filter(t=>t.status!=='working').slice(-4).map(t=>({name:clean(t.name,30),status:clean(t.status,30),code:clean(t.code,50)}));
  const receipt=meta.meta||{},clarification=row.route==='clarify'||receipt.mode==='clarify'||/^We’re focused on the Isle of Man\. Do you want its infrastructure/.test(row.answer);
  const incomplete=clarification||receipt.answered===false||receipt.answerOutcome==='source_unavailable';
  const completion=clarification?'not answered: a clarification/menu replaced the requested answer':incomplete?'not answered: the recorded result lacks a completed answer':row.status!=='complete'?'delivery did not complete':'delivery completed; task correctness is not established by that status';
  const operationText=ops.length?ops.map(op=>op.name+': '+op.status+(op.code?' ('+op.code+')':'')).join('; '):'no tool operations recorded for this turn';
  const next=clarification?'retry the original factual request in its established scope':incomplete?'obtain the missing source values, then answer the original request':'compare each requested requirement with the cited evidence before calling it complete';
  const part='Turn '+(all.indexOf(row)+1)+'. Request: '+clean(row.question,160)+'\nCompletion: '+completion+'. Execution: '+operationText+'. Next action (proposed, not run): '+next+'.\nRecorded answer excerpt (unverified): '+clean(row.answer,190);
  if(part.length>budget)break;parts.push(part);budget-=part.length+1;
 }
 const answer='Local task assessment. This evaluates recorded delivery and tool activity, not the truth of the earlier answers. '+parts.length+' of '+all.length+' recent saved turns included; other turns were outside this bounded public scope.\n'+parts.reverse().join('\n\n')+'\nEvidence limit: absent operations mean none recorded for that turn, not never in the conversation. No new searches, fixes or peer review are claimed by this assessment.';
 const question='Evaluate completion, comprehension, tool execution and evidence honesty for these public tasks in Mannin. Explain actual omissions and safe next actions. Do not claim new searches or fixes ran.';
 const key=createHash('sha256').update(sessionId+'\nassessment-v2\n'+answer).digest('hex');
 const model='conversation-review:'+key;
 let episode=kb.db.prepare('SELECT id FROM episodes WHERE session_id=? AND model=? ORDER BY created_at DESC LIMIT 1').get(sessionId,model)?.id;
 if(!episode)episode=kb.recordEpisode({sessionId,question,resolvedQuestion:question,jurisdiction:'IM',answer,status:'model_prior',confidence:.3,claimsUsed:[],model,retrievalMode:'conversation_audit'});
 return {key:episode,label:'the public task conversation ('+parts.length+' excerpts)',scope:'conversation',assessment:answer,included:parts.length,examined:all.length};
}

// Diagnostic reviews need the task being discussed, not just an old routing frame.
export function reviewContextEpisode(kb,sessionId,episode){
 if(!episode||episode.session_id!==sessionId||!conversationRepairQuestion(episode.question))return episode;
 const turn=kb.db.prepare('SELECT id FROM conversation_turns WHERE episode_id=? AND session_id=? ORDER BY seq DESC LIMIT 1').get(episode.id,sessionId);
 if(!turn)return episode;
 const target=conversationReviewTarget(kb,sessionId,{throughTurnId:turn.id});
 const assessment=target.key?kb.getEpisode(target.key):null;
 if(!assessment)return episode;
 return {...episode,question:assessment.question,resolved_question:assessment.resolved_question,answer:assessment.answer,status:'model_prior',confidence:.3,claims_used:[],source_excerpts:[],sources:[]};
}
