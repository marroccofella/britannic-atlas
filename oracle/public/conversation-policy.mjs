import { MAX_QUESTION_CHARS, questionProblem } from './discovery/question-policy.mjs';
export const MAX_MESSAGE_CHARS = MAX_QUESTION_CHARS;
export const messageProblem = questionProblem;
const key = value => String(value || "").toLowerCase().replace(/[’]/g,"'").replace(/[?.!,]+$/g,"").trim();
// These are conversational intents, not canned answers: the model still gets
// the saved exchange, including names and referents the user actually supplied.
// Whole-request matching deliberately excludes legal/factual complements.
export function ordinaryConversation(value,{topic=null,hasFactualTopic=false}={}) {
  const q=key(value);
  if (/^(?:who am i|what do you know about me|do you know (?:who i am|my name)|what(?:'s| is) my name)$/.test(q)) return 'personal_identity';
  if (/^(?:why (?:are (?:we|i)(?: here)?|do (?:we|i|humans|people) exist)|what(?:'s| is) (?:the )?(?:meaning|point|purpose) of life|what makes (?:me me|us human))$/.test(q)) return 'reflection';
  const social=['identity','personal_identity','reflection','shared_identity','pronoun_reference'].includes(topic);
  if ((social || !hasFactualTopic) && /^(?:who|what) are we$/.test(q)) return 'shared_identity';
  if ((social || !hasFactualTopic) && /^(?:who|why|what) are they$/.test(q)) return 'pronoun_reference';
  if (social && /^(?:tell me more|go on|why|what do you mean|explain that|give me an example)$/.test(q)) return topic;
  return null;
}
export function localConversation(value, {source="typed", topic=null}={}) {
  const q=key(value);
  if (/^(?:(?:hey|hi|hello),?\s+)?(?:mannin|mani|manny|maddie),?\s+(?:are you there|can you hear me)(?:\s+mm-hmm)?$/.test(q) || /^(?:are you there|hello|hi|hey|good morning|good evening|how are you)$/.test(q))
    return {intent:"smalltalk",topic:null,text:"I'm here. What would you like to know?"};
  if (/^(?:can|could|do) you hear me$/.test(q))
    return {intent:"smalltalk",topic:null,text:source==="speech"?"I received what you said. Go ahead.":"I can read your message. Go ahead."};
  if (/^(?:thanks|thank you|cheers)(?: very much)?$/.test(q)) return {intent:"smalltalk",topic:null,text:"You're welcome."};
  if (/^(?:what is|what's|explain|tell me about|what does) momm(?: mean| stand for| do)?$/.test(q))
    return {intent:"product",topic:"momm",text:"MOMM is an optional second opinion from several AI models on an answer or a public task assessment, including an unfinished task and possible next steps. You choose when to ask for it; reviewers can disagree, and agreement is not proof."};
  if (topic==="momm" && /^(?:give me an example|for example|how does it work|tell me more)$/.test(q))
    return {intent:"product",topic:"momm",text:"After an answer about a company rule, you could choose “Think harder with MOMM”. The reviewers would look for mistakes or missing details. The result is a second opinion, not a substitute for checking the actual rule."};
  // A compound request is local only when every clause asks about this product.
  // A factual tail such as 'What is corporation tax?' must retain evidence handling.
  const identityParts=q.split(/[?!.;]+|\s+and\s+/).map(part=>part.trim()).filter(Boolean);
  if (identityParts.length && identityParts.every(part=>/^(?:(?:who|what|why) are you|why do you exist|what(?:'s| is) your (?:name|purpose)|(?:tell me about|introduce) yourself|(?:who|what) (?:is|are) (?:mannin|mani|oracle))$/.test(part)))
    return {intent:"product",topic:"identity",text:"I'm Mannin, the oracle for the Isle of Man: an AI assistant you can type or speak to. I'm here to help you understand the Island, explore maps and follow questions deeper. For facts that matter, I can help check sources, but I can make mistakes."};
  if (/^(?:what (?:don't|do not) you know|what (?:are your limitations|can you not do|are you unable to do)|what can't you do)$/.test(q))
    return {intent:"product",topic:"limitations",text:"I can be wrong, and I only know personal details you share in our conversation. I can't see your screen; current facts need a source check, and blocked or missing pages can leave gaps. I haven't checked external sources for this explanation."};
  if (['identity','limitations','trust'].includes(topic) && /^(?:tell me more|go on|give me an example|how does it work)$/.test(q))
    return {intent:"product",topic:"limitations",text:"For example, I can explain a general topic from our conversation and the knowledge base. For a current rule or figure, ask me to check the sources; I should show what was actually found and what remains uncertain. A second opinion can catch mistakes, but it doesn't turn a guess into evidence."};
  if (/^(?:how (?:can|do|should) i trust you|can i trust you|how (?:do|can) you know (?:these|those) things(?: and what are you)?|how do you work)(?: explain in detail)?$/.test(q))
    return {intent:"product",topic:"trust",text:"I use your conversation, a Manx knowledge base and an AI model to answer. I can be wrong. For current facts or decisions involving money, law or safety, check the linked evidence; you can ask for a source check or a second opinion."};
  return null;
}
export function unfinishedRequest(value) {
  const q=key(value);
  // These predicates have an unfinished complement; they are not topic echoes.
  return /^(?:what about|who is the|what's the official|i was asking if|what do we need to do to get the)$/.test(q)
    || /^(?:is|are|was|were|can|could|would|should) (?:the|a|an) [\p{L}\p{N}'-]+$/u.test(q);
}
export function answerIntent(value) {
  const q=key(value);
  if (/\b(?:tax|legal|legislation|law|visa|immigration|inheritance|capital gains|company residenc|medical|medicine|health|dosage|street works|laying (?:optical )?fibre|installation (?:code|rules))/.test(q)) return "high_stakes";
  if (/\b(?:today|today's|current|latest|news|weather forecast|visiting|next visit)\b/.test(q)) return "live";
  return "island_fact";
}

// Whole-request performance questions must not replace a factual subject.
export function conversationPerformanceQuestion(value){
 const q=String(value||'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 if(/^(?:(?:I've|I have) (?:upgraded|updated) you[, .!?]*)?(?:can you try again[?.! ]*)?are you any better(?: than (?:you were )?(?:previously|before))?[.!?]*$/i.test(q))return true;
 return /^(?:(?:i (?:want|would like) to (?:see|know) )?how (?:good|much better) (?:you've|you have) (?:become|got)(?: since (?:the )?last time we (?:spoke|talked))?|have you improved(?: since we last (?:spoke|talked))?|are you any better(?: now)?|how (?:much )?better are you(?: now)?)[.!?]*$/i.test(q);
}
// Conversation diagnostics are local context, never an Island factual claim.
export function conversationRepairQuestion(value){
  const q=String(value||'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
  if(/^(?:(?:did|do|have) (?:those|these|your|the) (?:fixes|repairs|updates) (?:work|worked|help|helped)|are (?:those|these|your|the) (?:fixes|repairs|updates) working(?: now)?|can you figure (?:it|everything) out now)[?.!]*$/i.test(q))return true;
  if(conversationPerformanceQuestion(q)||/^what about now after your updates[?.! ]*(?:can you figure (?:it|everything) out[?.! ]*)?$/i.test(q))return true;
  if(/\b(?:you|you're|you've|your)\b/i.test(q)&&/\b(?:making me repeat|repeat(?:ing)? myself|keep asking me|asking me again|waste my time|delivered nothing|you are failing|you've still delivered|why did you not answer|first question.*second answer)\b/i.test(q)){
    const clauses=q.split(/[;:,.?!]+|\s+(?:and|but|also|then)\s+/i);
    const factual=clauses.some(part=>{const clause=part.trim().replace(/^(?:(?:and|but|also|so|then|please)\s+)+/i,'').replace(/^(?:tell|show|give) me\s+/i,'explain ');return /^(?:what|when|where|which|who|how|why|is|are|does|do|can|could|explain|find|check|read|search)\b/i.test(clause)&&!/\b(?:you|your|we|our|i|my|me)\b/i.test(clause);});
    return !factual;
  }
  if (/^(?:list (?:all )?(?:the )?issues|reflect on (?:this|our|the) conversation(?: and its failures)?)[.!?]*$/i.test(q))return true;
  if (/^(?:(?:did|didn't|did not) you (?:see|read|hear|understand|answer|get)|(?:have|haven't|have not) you (?:seen|read|heard|understood|answered|got|gotten)) my (?:last |previous )?question[?.!]*$/i.test(q)) return true;
  if (/\b(?:analyse|analyze|review|evaluate|assess|examine) (?:(?:this|the|our) (?:conversation|chat)|our exchange)(?=[?.!,;]|$|\s+(?:and|to see|see whether|for (?:mistakes|errors)|so that)\b)/i.test(q)) return true;
  // "Based on our conversation, what is the population of Douglas?" is a
  // factual question with a preamble, not a request for self-assessment.
  return /\b(?:do you think you are doing a good job|your (?:shortcomings|failures|mistakes)|what (?:do you think (?:it was that )?)?i was trying to say|why (?:did|has) (?:your|the|that) (?:search|review) fail)\b/i.test(String(value||''))
    || (/\bbased on our conversation\b/i.test(q) && !/\b(?:what|when|where|which|who|how many|how much|how long|is|are|does|do|did)\b/i.test(q.replace(/\bbased on our conversation\b/i,'')));
}

// A quantifier attached to a named subject is not a request to expand the old topic.
export function broadeningRequest(value){
 const q=key(value).replace(/^(?:(?:please|i (?:need|want) to know|(?:tell|show|give) me(?: about)?|do)\s+)+/i,'');
 return /^(?:all(?: of (?:it|that|them))?(?: (?:info|information|details))?|everything|(?:the )?full (?:picture|details)|complete(?:ly)?|comprehensive(?:ly)?)(?: (?:please|about (?:it|that|this|the island|the isle of man)))?$/i.test(q)
  || /^(?:manx|mann|isle of man)(?: and)? all (?:info|information|details)$/i.test(q)
  || /^(?:all|everything) about (?:the )?(?:isle of man|island|mann)$/i.test(q);
}
// Reporting an earlier question does not change its subject or authorize actions.
export function restatedRequest(value,state={}){
 const q=String(value||'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 const match=/^(?:(?:no|actually)[,.;! ]+)?(?:i (?:asked|am asking|was asking)(?: you)?|my question (?:is|was))[:, ]+(what(?:'s| is| was| are| were| does| do)|how|where|when|which|who|why|is|are|does|do)\b(.*)$/i.exec(q);
 if(!match)return null;let question=(match[1]+match[2]).trim();
 const prior=String(state.lastSubstantiveQuestion||'');
 const weatherSubject=value=>String(value).replace(/^Answer this (?:specifically )?for (?:the )?[^:]+:\s*/i,'').replace(/^what(?:'s| is| was)\s+/i,'').toLowerCase().replace(/\b(?:current|today|now|the|a|an)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const sameSubject=weatherSubject(question)===weatherSubject(prior);
 if(sameSubject&&/^what was (?:the )?temperature\b/i.test(question)&&/\b(?:current|today|now)\b/i.test(prior)&&/\btemperatures?\b/i.test(prior)&&! /\b(?:yesterday|last|ago|historical|history|during|before|after|in \d{4})\b|\b(?:19|20)\d{2}\b|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(question))question=question.replace(/^what was/i,'What is');
 return {question};
}
