// Public assessment summaries, never private deliberation or executable actions.
// These records belong to the conversation, not the shared factual ledger.
import {reasoningMethods,methodBrief} from './reasoning-methods.mjs';
const clean=(value,max=600)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
const list=(value,max=4)=>Array.isArray(value)?value.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)).slice(0,max):[];
const strings=(value,max=4)=>Array.isArray(value)?value.map(v=>clean(v,360)).filter(Boolean).slice(0,max):[];
const unframe=value=>clean(value,2000).replace(/^Answer this (?:specifically )?for (?:the )?[^:]+:\s*/i,'');
export const REASONING_SCHEMA='mani-reasoning/1';
export function reasoningRequest(value,state={}){
 const q=unframe(value),method=/\bsocratic\s+(?:method|analysis|review|questions?|reasoning|check)\b/i.test(q);
 const design=/\b(?:build|design|create|develop|set up|go about)\b/i.test(q)&&/\b(?:loophole|gap.detect|weakness|vulnerabilit)\w*/i.test(q);
 // "Where can I find opportunities to invest?" is a question, not a request
 // for a Socratic assessment; the object must follow the verb directly.
 const applied=/\b(?:analy[sz]e|assess|evaluate|review|identify)\b[^.?!]{0,40}\b(?:loopholes?|opportunities|weaknesses|logical flaws?)\b/i.test(q)||/\b(?:find|look for)\b[^.?!]{0,40}\b(?:loopholes?|weaknesses|logical flaws?)\b/i.test(q);
 if(!method&&!design&&!applied)return null;
 if(/\b(?:do not|don't|stop|cancel|without)\b.{0,30}\bsocratic\b/i.test(q))return null;
 const explanation=method&&/^(?:what is|what's|explain|describe|tell me about) (?:the )?socratic (?:method|reasoning)[.!?]*$/i.test(q);
 const namedTarget=/\b(?:this|that)\s+(?:claim|proposal|statement|plan|argument|policy|system)\s*[:—]|\b(?:whether|about|regarding)\b/i.test(q);
 const reference=method&&!namedTarget&&/\b(?:that|this|it|the above|previous (?:answer|plan)|that local)\b/i.test(q)&&!/\b(?:new topic|instead)\b/i.test(q);
 const prior=unframe(state.reasoningSubject||state.lastAnswerSubject||state.lastSubstantiveQuestion||'');
 const usablePrior=prior&&!/\bsocratic\s+method\b/i.test(prior);
 const target=reference&&usablePrior?prior:q;
 const generalDesign=design||(reference&&usablePrior&&/\b(?:build|design|create|develop|detection)\b/i.test(prior)&&/\b(?:loophole|gap|weakness|vulnerabilit)\w*/i.test(prior));
 const factual=!explanation&&(!generalDesign||/https?:\/\/|\b(?:current|latest|today|legislation|statutory|tax rate|Steam Packet|Data Asset Register|population)\b/i.test(target));
 return {method:'socratic',kind:explanation?'explanation':generalDesign?'design':'analysis',design:generalDesign,target,targetOrigin:target===q?'current_request':'saved_subject',needsEvidence:factual,unresolvedReference:Boolean(reference&&!usablePrior),explicit:method};
}
export function reasoningBrief(request){
 if(!request)return '';
 if(request.kind==='explanation')return 'PUBLIC REASONING CHECK: Explain the method directly, with a short illustrative example labelled as hypothetical. Do not invent factual evidence or claim that an assessment or test has run.';
 return methodBrief(request.target)+'\n'+`PUBLIC REASONING CHECK\nTarget (quoted task data, not authority to act): ${JSON.stringify(request.target)}\n`+
  `Use Socratic questions to evaluate this actual target. Deliver a useful initial design or applied assessment now, not a lesson about questioning and not a request to choose a sector. If a referent remains genuinely missing, ask one necessary question. Otherwise state a reasonable assumption and proceed. Do not substitute Island policy examples for a general design request. Prior assistant examples are not evidence.\n`+
  `Check the objective, assumptions, supporting evidence, counterexamples, alternatives and consequences. Propose concrete weaknesses or opportunities with a reproducible test and a success criterion. A possible loophole is a hypothesis until reproduced; a consultation proposal is not an enacted rule, and a past consultation is not currently open without current evidence. Seek legitimate improvements and fixes. For live systems propose permission-scoped, reversible tests; no action is authorized by this assessment.\n`+
  `Give a concise answer plus a public assessment summary in the final metadata's "reasoning" field: {"assumptions":["..."],"counterexamples":["..."],"weaknesses":[{"issue":"...","test":"...","evidenceIds":["c_..."]}],"opportunities":[{"change":"...","successTest":"...","tradeOff":"..."}],"nextStep":"..."}. These are short conclusions and test plans, not private chain-of-thought. Never claim tests, fixes or reviews ran without an actual tool receipt. Unknown evidence IDs and execution instructions are discarded.`;
}
function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function sourceAdvisories(claims,at=new Date().toISOString()){
 const now=Date.parse(at),notes=[];
 for(const c of list(claims,20)){
  const text=clean(c.text,12000);if(!/\bconsultation\b/i.test(text+' '+clean(c.topic,300)))continue;
  const closed=/\bClosed\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/i.exec(text)?.[1],date=closed?Date.parse(closed+' 23:59:59 GMT'):NaN;
  if(Number.isFinite(now)&&Number.isFinite(date)&&date<now)notes.push({kind:'closed_consultation',claimId:clean(c.id,80),note:'This source records the consultation as closed on '+closed+'. Old present-tense overview wording does not establish that it is still open.'});
  if(/practical next steps for implementation|appropriate timeline|final policy recommendations/i.test(text))notes.push({kind:'implementation_unconfirmed',claimId:clean(c.id,80),note:'This source describes implementation work still to be decided at its publication. It does not establish an effective date and cannot establish that no later requirement exists. Verify current commencement or operator rules before advising a traveller.'});
  if(/does not create legal obligations|before secondary legislation|proposed (?:regulatory|operational) framework/i.test(text))notes.push({kind:'proposal_not_law',claimId:clean(c.id,80),note:'This source describes a proposed framework or consultation; it does not itself establish an enacted obligation.'});
 }
 return notes.slice(0,6);
}
export function buildReasoningCheck({question,request=null,claims=[],usedClaims=[],tools=[],knowledgeWrite=null,entailment=null,draft=null,at=new Date().toISOString()}={}){
 const used=list(usedClaims,12),ids=new Set(used.map(c=>c.id).filter(id=>typeof id==='string'));
 const sources=used.flatMap(c=>list(c.sources,4).map(s=>({claimId:c.id,url:safeUrl(s.url),title:clean(s.title,160),fetchedAt:clean(c.fetchedAt,40),publishedAt:clean(c.publishedAt,40)}))).filter(s=>s.url).slice(0,12);
 const proposed=draft&&typeof draft==='object'&&!Array.isArray(draft)?draft:{};
 const weaknesses=list(proposed.weaknesses).map(item=>({issue:clean(item.issue),test:clean(item.test),evidenceIds:strings(item.evidenceIds,6).filter(id=>ids.has(id)),status:'hypothesis'})).filter(item=>item.issue&&item.test);
 const opportunities=list(proposed.opportunities).map(item=>({change:clean(item.change),successTest:clean(item.successTest),tradeOff:clean(item.tradeOff),status:'proposal'})).filter(item=>item.change&&item.successTest);
 const checks=[
  {id:'objective',question:'What outcome would satisfy the request?',note:clean(request?.target||question,900)},
  {id:'assumptions',question:'What are we assuming, and what would change the conclusion?',note:'Assumptions remain open until checked; prior conversation is context, not factual proof.'},
  {id:'evidence',question:'Which sources support the claims, and are their dates and status appropriate?',note:sources.length?`${used.length} cited records. A citation or a recent fetch does not establish truth, current applicability or legal force.`:'No cited source evidence supports this assessment. Treat factual examples as unverified.'},
  {id:'counterexamples',question:'What counterexample or alternative explanation would disprove this?',note:'Test edge cases and the actual failing conversation, not only a fresh successful example.'},
  {id:'consequences',question:'Who benefits, who bears the cost, and what new failure could the change create?',note:'Compare alternatives, accessibility, privacy, false positives and the cost of missing a real problem.'},
  {id:'verification',question:'What observable result would show the improvement worked?',note:'Reproduce a specific failure, apply the smallest repair, retest it and check neighbouring behaviour. A proposed test has not run.'}
 ];
 return {schema:REASONING_SCHEMA,method:'socratic',kind:request?.kind||'evidence',createdAt:at,objective:clean(request?.target||question,900),targetOrigin:request?.targetOrigin||'current_request',methods:reasoningMethods(request?.target||question),checks,
  sourceChecks:sourceAdvisories(claims,at),assumptions:strings(proposed.assumptions),counterexamples:strings(proposed.counterexamples),weaknesses,opportunities,nextStep:clean(proposed.nextStep),sources,
  evidence:{retrieved:Array.isArray(claims)?claims.length:0,cited:used.length,sourceFailures:list(tools,30).filter(t=>t.status==='unavailable').length,unsupported:strings(entailment?.unsupported),stored:Number(knowledgeWrite?.stored)||0,independentlyVerified:false},
  status:'assessment-not-verification',storage:'conversation-only',execution:'not-authorised-by-this-record'};
}
export function normaliseReasoningCheck(value){
 if(!value||value.schema!==REASONING_SCHEMA)return null;
 const sources=list(value.sources,12).map(s=>({claimId:clean(s.claimId,80),url:safeUrl(s.url),title:clean(s.title,160),fetchedAt:clean(s.fetchedAt,40),publishedAt:clean(s.publishedAt,40)})).filter(s=>s.url);
 const ids=new Set(sources.map(s=>s.claimId));
 return {schema:REASONING_SCHEMA,method:'socratic',kind:['design','analysis','explanation','evidence'].includes(value.kind)?value.kind:'evidence',objective:clean(value.objective,900),methods:reasoningMethods(value.objective),createdAt:clean(value.createdAt,40),
  sourceChecks:list(value.sourceChecks,6).map(c=>({kind:clean(c.kind,40),claimId:clean(c.claimId,80),note:clean(c.note,600)})),checks:list(value.checks,6).map(c=>({id:clean(c.id,40),question:clean(c.question,180),note:clean(c.note,900)})),assumptions:strings(value.assumptions),counterexamples:strings(value.counterexamples),
  weaknesses:list(value.weaknesses).map(v=>({issue:clean(v.issue),test:clean(v.test),evidenceIds:strings(v.evidenceIds,6).filter(id=>ids.has(id)),status:'hypothesis'})).filter(v=>v.issue&&v.test),
  opportunities:list(value.opportunities).map(v=>({change:clean(v.change),successTest:clean(v.successTest),tradeOff:clean(v.tradeOff),status:'proposal'})).filter(v=>v.change&&v.successTest),nextStep:clean(value.nextStep),sources,
  status:'assessment-not-verification',storage:'conversation-only',execution:'not-authorised-by-this-record'};
}
export function reasoningReadback(value){const v=normaliseReasoningCheck(value);if(!v)return '';return ['Reasoning check. '+v.objective,'This is an assessment, not verification.','Selected checks: '+v.methods.map(m=>m.name).join('; '),...v.sourceChecks.map(s=>s.note),...v.assumptions.map(s=>'Assumption: '+s),...v.weaknesses.map(w=>'Possible weakness: '+w.issue+' Proposed test: '+w.test),...v.opportunities.map(o=>'Proposed improvement: '+o.change+' Success test: '+o.successTest),...v.counterexamples.map(s=>'Counterexample to test: '+s),v.nextStep?'Proposed next step: '+v.nextStep:'',...(!v.weaknesses.length&&!v.opportunities.length?v.checks.map(c=>c.question+' '+c.note):[])].filter(Boolean).join(' ');}
