import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {createDialogueState,resolveDialogue} from '../lib/dialogue.mjs';
import {answer,isResearchable,ORACLE_SYSTEM} from '../lib/brain.mjs';
import {ordinaryConversation} from '../public/conversation-policy.mjs';

test('the identity and philosophy sequence stays conversational, not Manx legal research',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
 let state=createDialogueState();
 for(const question of ['Who are you?','Who am I?','Who are we?','Who are they?','Why are we?','Why are they?']){
  const resolution=resolveDialogue(question,state);state=resolution.state;
  assert.equal(resolution.conversationMeta,true,question);
  assert.doesNotMatch(resolution.canonical||'',/specifically for.*Isle of Man/);
  const events=[];
  await answer({kb,question,resolution,sessionId:'s',emit:(event,data)=>events.push({event,data}),
   retrieval:{focus(){throw Error('Ordinary conversation must not retrieve Government claims');}},
   runModel:async input=>{assert.match(input.system,/philosophical questions are valid/i);input.onDelta('We are having a conversation.');return {costUsd:0};}});
  const meta=events.find(e=>e.event==='meta').data;
  assert.equal(meta.reviewable,false);assert.equal(meta.researchable,false);assert.deepEqual(meta.nextSteps,[]);
 }
});
test('nearby philosophical phrasings and follow-ups preserve their conversational context',()=>{
 for(const question of ['Why do we exist?','Why are we here?','What is the meaning of life?','What makes me me?']){
  const result=resolveDialogue(question);assert.equal(result.conversationMeta,true,question);
  const next=resolveDialogue('Tell me more.',result.state);assert.equal(next.conversationMeta,true);assert.equal(next.intent,'reflection');
 }
});
test('explicit factual or legal questions must not be hidden as ordinary conversation',()=>{
 for(const question of ['Who are we required to pay tax to?','Why are they laying fibre without permission?','What is Manx nationality?','Why are we required to register a company?'])assert.notEqual(resolveDialogue(question).conversationMeta,true,question);
 const factual=resolveDialogue('Tell me about the Communications and Utilities Regulatory Authority');
 assert.notEqual(resolveDialogue('Who are they?',factual.state).conversationMeta,true,'A real factual antecedent must retain evidence handling');
});
test('personal identity uses what was shared, with no unrelated saved research',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('s');
 store.start({id:'intro',sessionId:'s',question:'Call me Alex.',resolution:{route:'answer',canonical:'Call me Alex.',jurisdiction:'Isle of Man'}});store.finish('intro',{answer:'Hello Alex.'});
 kb.db.prepare("INSERT INTO expeditions(id,session_id,question,summary,status,finished_at) VALUES('old','s','Manx residency law','UNRELATED_GOVERNMENT_SUMMARY','done','2026-09-09')").run();
 let prompt;
 await answer({kb,conversations:store,question:'Who am I?',resolution:resolveDialogue('Who am I?'),sessionId:'s',emit(){},runModel:async input=>{prompt=input.prompt;input.onDelta('You asked me to call you Alex.');return {costUsd:0};}});
 assert.match(prompt,/Call me Alex/);assert.doesNotMatch(prompt,/UNRELATED_GOVERNMENT_SUMMARY/);
 assert.match(ORACLE_SYSTEM,/do not infer.*nationality/i);
});
test('ordinary identity and existential questions never become paid research subjects',()=>{
 for(const q of ['Who am I?','Who are we?','Why do we exist?','Why are we here?'])assert.equal(isResearchable(q,{explicit:true}),false,q);
});
test('peer reproduction: a real factual turn clears the social topic before its clarification',()=>{
 const social=resolveDialogue('Who am I?').state;
 const factual=resolveDialogue('What is the company filing deadline?',social).state;
 assert.equal(factual.conversationTopic,null);
 const pending={...factual,pendingQuestion:'Which company type?',pendingQuestionSubject:factual.lastSubstantiveQuestion};
 const reply=resolveDialogue('Why?',pending);assert.notEqual(reply.intent,'personal_identity');assert.notEqual(reply.conversationMeta,true);
});
test('peer reproduction: identity/local greeting precedence and the bare they boundary are intact',async()=>{
 assert.equal(ordinaryConversation('Who are you?'),null);
 assert.equal(resolveDialogue('Who are you?').route,'conversation');
 assert.equal(ordinaryConversation('Why are they?'),'pronoun_reference');
 assert.equal(ordinaryConversation('Why are they?',{hasFactualTopic:true}),null);
 await answer({question:'Hello',resolution:resolveDialogue('Hello'),emit(){},conversations:{context(){throw Error('Greeting must not read research memory');}},runModel(){throw Error('Greeting must not call a model');}});
});
test('peer reproduction: conversational follow-ups cannot spend through the actual answer pipeline',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
 for(const q of ['Tell me more','Give me an example','What do you mean']){
  const resolution=resolveDialogue(q,resolveDialogue('What is the meaning of life?').state);assert.equal(resolution.conversationMeta,true);
  const result=await answer({kb,question:q,resolution,sessionId:'s',wantExpedition:true,emit(){},
   expeditions:{enqueue(){throw Error('A conversation follow-up must never dispatch research');}},runModel:async input=>{input.onDelta('A conversational answer.');return {costUsd:0};}});
  assert.equal(result.researchOffered,false);assert.equal(result.queued,null);
 }
 assert.equal(isResearchable('Tell me more',{explicit:true}),false);
});
