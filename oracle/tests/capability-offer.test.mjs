import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {DialogueSessions,resolveDialogue} from '../lib/dialogue.mjs';
import {researchOffer} from '../lib/results.mjs';
import {answer,isResearchable} from '../lib/brain.mjs';

const question='What external access do you have? For example, could you get me the weather in Peel?';
test('the visible capability action resolves from its saved turn and survives reload',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db),d=new DialogueSessions({storage:store});
  const resolution=d.resolve('s',question,{turnId:'offer',clientTurn:1});d.markInFlight('s',resolution);
  store.start({id:'offer',sessionId:'s',question,resolution});let meta;
  const result=await answer({kb,sessionId:'s',question,resolution,emit:(n,v)=>{if(n==='meta')meta=v;},runModel:()=>{throw Error('No model');}});
  store.finish('offer',{answer:result.text,metadata:{meta}});d.complete('s',resolution.semanticKey,{pendingAction:result.pendingAction});
  const selected=researchOffer(kb.db,'s','offer');assert.equal(selected?.subject,'Current weather in Peel');assert.equal(selected?.researchMode,'live_sources');
  assert.equal(researchOffer(kb.db,'other','offer'),null);
  const restored=new DialogueSessions({storage:store});assert.equal(restored.preview('s','Search that.').canonical,selected.subject);
  const accepted=restored.resolve('s','Do it all.');assert.equal(accepted.canonical,selected.subject);assert.equal(accepted.state.conversationTopic,null);
  restored.markInFlight('s',accepted);restored.complete('s',accepted.semanticKey,{pendingAction:{kind:'research',subject:selected.subject,researchMode:'live_sources'}});
  assert.equal(restored.preview('s','Do it.').canonical,selected.subject);
  const tampered={...meta,nextSteps:[{...meta.nextSteps[0],subject:'Current weather in another place'}]};
  kb.db.prepare('UPDATE conversation_turns SET metadata=? WHERE id=?').run(JSON.stringify({meta:tampered}),'offer');assert.equal(researchOffer(kb.db,'s','offer'),null);
});
test('capability and repair wording cannot become paid research through explicit fallback routes',()=>{
  for(const value of [question,'Did you see my question?','Analyse our conversation and tell me what went wrong.'])assert.equal(isResearchable(value,{explicit:true}),false,value);
  assert.equal(isResearchable('Current weather in Peel',{explicit:true}),true);
  const d=new DialogueSessions();d.resolve('s','What external access do you have?');assert.equal(d.preview('s','Do it all.').route,'clarify');assert.equal(d.preview('s','All.').route,'clarify');
  assert.notEqual(resolveDialogue('What external access do you have? What is corporation tax?').conversationMeta,true);
});
