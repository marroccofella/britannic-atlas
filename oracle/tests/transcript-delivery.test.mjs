import test from 'node:test';
import assert from 'node:assert/strict';
import {interactionCommand} from '../lib/interaction-policy.mjs';
import {resolveDialogue,createDialogueState} from '../lib/dialogue.mjs';
import {liveRequest} from '../lib/live-tools.mjs';
import {sourceRelevant} from '../lib/source-passages.mjs';
import {combineEvidence} from '../lib/learning.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {VectorStore} from '../lib/vector-store.mjs';
import {ManxRetrieval} from '../lib/manx-retrieval.mjs';

test('plural town temperatures select the location-aware weather tool',()=>{
 assert.equal(liveRequest('What are the temperatures in every major town and city?')?.name,'get_town_weather');
 assert.equal(liveRequest('Current temperature in Douglas and Ramsey')?.name,'get_town_weather');
 assert.equal(liveRequest('What was the average temperature last year?'),null);
});
test('clear spoken review verbs and MOMM speech variants are actions',()=>{
 for(const q of ['Review this.','Perform a MUM review on your recent answer.','Review. Do it. Reflect on the conversation.','Can you look at the conversation we have been having and do the mom MOMM review?']){
  const r=resolveDialogue(q,createDialogueState(),{source:'speech',recognitionConfidence:.91});assert.equal(r.route,'review',q);
 }
 assert.equal(resolveDialogue('Review. Do it. Reflect on the conversation.').reviewScope,'conversation');
 for(const q of ['Do not review this.','My mum said to review this.','What does MOMM do?'])assert.notEqual(interactionCommand(q)?.kind,'review',q);
 assert.equal(resolveDialogue('Review this.',createDialogueState(),{source:'speech',recognitionConfidence:.2}).route,'clarify');
});
test('MOMM version questions select a local runtime inspection, never web research',()=>{
 for(const q of ['What version of MOMM are you using?','Could you ask momm itself what version it is?'])assert.equal(resolveDialogue(q).route,'runtime_info',q);
});
test('an explicit recovery request resumes the original public task',()=>{
 const first=resolveDialogue('What are the temperatures in every major town and city?');
 const state={...first.state,pendingAction:{kind:'research',subject:first.canonical,jurisdiction:'Isle of Man',researchMode:'live_sources',status:'offered'}};
 for(const q of ['Try do it for me.','Figure out a way to do what I asked you to do, and give me the answer correctly.','There are multiple websites and APIs. Figure it out. Do it.']){
  const next=resolveDialogue(q,state,{source:'speech',recognitionConfidence:.91});assert.equal(next.route,'research',q);assert.match(next.canonical,/temperatures in every major town/i);
 }
});
test('generic island words do not make a parliament page relevant to temperatures',()=>{
 assert.equal(sourceRelevant('Current temperatures in every major town and city on the Isle of Man','Tynwald is the parliament of the Isle of Man. It governs the towns.'),false);
 assert.equal(sourceRelevant('Current temperatures in Douglas','Douglas temperature is 15 degrees Celsius.'),true);
});
test('reviewer silence or votes cannot promote a sourced claim to verified',()=>{
 const ev=combineEvidence({finding:{claim:'A public Manx fixture claim.',sources:[{url:'https://www.gov.im/fixture'}],confidence:.8},momm:{agree:['a','b'],disagree:[],unsure:[]}});
 assert.equal(ev.support,1);assert.equal(ev.status,'single_source');
});
test('a missing vector is detected rather than counted as a current indexed document',async t=>{
 const kb=new KnowledgeBase(':memory:');const store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});
 const retrieval=new ManxRetrieval(kb,null,{store,getEmbedder:async()=>({countTokens:s=>s.split(' ').length,embed:async texts=>texts.map(()=>[1,0,0])})});
 t.after(()=>{retrieval.close();kb.close();});
 kb.upsertClaim({text:'Manx fixture about public harbour services.',jurisdiction:'IM',sources:[{url:'https://www.gov.im/fixture'}]});
 await retrieval.syncLedger();store.db.exec('DELETE FROM chunk_vectors');
 assert.equal(retrieval.stats().ledger.indexed,0);assert.equal(retrieval.stats().ledger.missing,1);
 await retrieval.syncLedger();assert.equal(retrieval.stats().ledger.missing,0);assert.ok(store.stats().vectors>0);
});
