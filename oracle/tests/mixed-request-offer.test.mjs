import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {resolveDialogue} from '../lib/dialogue.mjs';
import {answer} from '../lib/brain.mjs';
import {researchOffer} from '../lib/results.mjs';
import {META_MARKER} from '../lib/segmenter.mjs';
import {capabilityRequest} from '../public/request-coverage.mjs';

test('mixed requests focus retrieval and the saved follow-up on the factual part',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);
 const question='What external access do you have? How were Manx fishing boats built?';const resolution=resolveDialogue(question);let meta;
 store.start({id:'mixed-offer',sessionId:'s',question,resolution});
 const result=await answer({kb,sessionId:'s',question,resolution,emit:(n,v)=>{if(n==='meta')meta=v;},retrieval:{focus:async q=>{assert.doesNotMatch(q,/external access/);return {claims:[],coverage:'none',coverageRatio:0,budgetUsed:0};}},liveTools:()=>{throw Error('No current source requested');},runModel:async o=>{o.onDelta('I can check historical records for the boat construction details.\n'+META_MARKER+JSON.stringify({used:[],researchable:true,expedition:false}));return {costUsd:0};}});
 assert.doesNotMatch(result.pendingAction.subject,/external access/);assert.equal(result.pendingAction.subject,meta.nextSteps[0].subject);
 store.finish('mixed-offer',{answer:result.text,metadata:{meta}});assert.equal(researchOffer(kb.db,'s','mixed-offer')?.subject,meta.nextSteps[0].subject);
});
test('a weather example keeps its requested forecast day in the offered action',()=>{
 const result=capabilityRequest('What external access do you have? For example, could you get me the weather in Onchan tomorrow?');
 assert.match(result.subject,/Onchan tomorrow/);
});
