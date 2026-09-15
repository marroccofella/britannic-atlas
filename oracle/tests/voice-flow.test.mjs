import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDialogue,DialogueSessions,createDialogueState} from '../lib/dialogue.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {reviewTarget} from '../lib/review-target.mjs';
import {answer} from '../lib/brain.mjs';
import {sourceMode,islandClock,clockQuestion} from '../lib/interaction-policy.mjs';
import {runExpedition} from '../lib/learning.mjs';
import {Bus} from '../lib/bus.mjs';

test('explicit spoken review commands precede the generic speech and affirmation gates',()=>{
  for(const q of ['Use MOMM.','Use MUM.','Run MOM skill.','Yes, of course that is correct. Also use the MOM skill to help you improve your results.']) {
    assert.equal(resolveDialogue(q,undefined,{source:'speech',recognitionConfidence:.9}).route,'review',q);
  }
  assert.notEqual(resolveDialogue('Use MOMM.',undefined,{source:'speech',recognitionConfidence:.1}).route,'review');
  assert.notEqual(resolveDialogue('My mum lives in Douglas.',undefined,{source:'speech'}).route,'review');
  assert.notEqual(resolveDialogue('Do not also use MOMM.',undefined,{source:'speech'}).route,'review');
  assert.notEqual(resolveDialogue('Use MOMM.',undefined,{source:'speech',recognitionConfidence:.5}).route,'review');
});

test('local clock supplies day, date and Island time without a model or source lookup',async()=>{
  assert.match(islandClock(new Date('2026-09-11T12:04:00Z')),/Friday, 11 September 2026.*13:04/);
  for(const q of ['What is the current day?','I asked for the current day.','What is the current day, date and time?']){
    assert.equal(clockQuestion(q),true,q);
    const resolution=resolveDialogue(q);assert.equal(resolution.intent,'clock');
    await answer({question:q,resolution,emit(){},runModel(){throw Error('clock model call');}});
  }
});

test('review target is the current conversation artifact, never another chat or a product answer',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('s');
  assert.match(reviewTarget(kb,'s').reason,/no public task/i);
  const add=(session,id,question,meta={})=>{
    const episodeId=kb.recordEpisode({sessionId:session,question,resolvedQuestion:question,jurisdiction:'Isle of Man',answer:'Synthetic public example concerning an Isle of Man company.',status:'model_prior',confidence:.3,claimsUsed:[]});
    store.start({id,sessionId:session,question,resolution:{route:'answer',canonical:question,jurisdiction:'Isle of Man'}});
    store.finish(id,{answer:'Synthetic public example concerning an Isle of Man company.',episodeId,metadata:{meta}});return episodeId;
  };
  const expected=add('s','turn1','What is Strix on the Isle of Man?');
  add('other','turn2','What is another Isle of Man company?');
  assert.equal(reviewTarget(kb,'s').key,expected);
  store.start({id:'blocked-search',sessionId:'s',question:'Search for another topic',resolution:{route:'research',canonical:'another topic',jurisdiction:'Isle of Man'}});
  store.finish('blocked-search',{answer:'Could not start the source check.'});
  const unfinished=reviewTarget(kb,'s');assert.ok(unfinished.key);assert.match(unfinished.assessment,/another topic/);assert.doesNotMatch(unfinished.assessment,/Strix/);
  assert.ok(reviewTarget(kb,'s',{pendingAction:{kind:'research',status:'running'}}).assessment);
  add('s','turn3','Who are you?',{conversationMeta:true,reviewable:false});
  assert.equal(reviewTarget(kb,'s').key,undefined);
});

test('late research completion cannot steal a new topic, and a new search releases old evidence',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('s');const sessions=new DialogueSessions({storage:store});
  sessions.set('s',{...createDialogueState(),researchFocusId:'old',pendingAction:{kind:'research',id:'new',status:'running'},lastSubstantiveQuestion:'Current population'});
  sessions.settleResearch('s','old',{status:'done'});assert.equal(sessions.get('s').pendingAction.id,'new');assert.equal(sessions.get('s').researchFocusId,'old');
  const next=sessions.preview('s','Search for hotel refurbishment grants.');assert.equal(next.state.researchFocusId,null);assert.doesNotMatch(next.canonical,/population/);
});

test('source routing does not demand a Government page for company facts, but preserves explicit official checks',()=>{
  assert.equal(sourceMode('Strix market capitalisation'),'sources');
  assert.equal(sourceMode('Strix market capitalisation',{official:true}),'official_sources');
  const r=resolveDialogue('Check official Manx sources for the fibre installation rules.',undefined,{source:'speech',recognitionConfidence:.9});
  assert.equal(r.route,'research');assert.equal(r.researchMode,'official_sources');
});

test('source-pass mode survives storage and runs only research with relevant-source instructions',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());let prompt;
  const id=kb.queueExpedition({question:'Strix history in the Isle of Man',sessionId:'s',jurisdiction:'Isle of Man',strategies:['research'],mode:'sources'});
  assert.equal(kb.getExpedition(id).mode,'sources');
  await runExpedition({kb,bus:new Bus(),id,question:'Strix history in the Isle of Man',sessionId:'s',jurisdiction:'Isle of Man',mode:'sources',
    runModel:async input=>{prompt=input.prompt;return {structured:{findings:[],unresolved:['Synthetic empty fixture'],unreachable_sources:[]},costUsd:0};},
    crossReview(){throw Error('Source pass must not launch MOMM');}});
  assert.match(prompt,/RELEVANT SOURCE CHECK/);assert.doesNotMatch(prompt,/OFFICIAL MANX SOURCE CHECK/);
});

test('bound research reaches retrieval and the prompt with original evidence and gaps kept separate',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('s');
  const id=kb.queueExpedition({question:'Strix Taylor family history',sessionId:'s',jurisdiction:'Isle of Man',strategies:['research'],mode:'sources'});
  kb.db.prepare("UPDATE expeditions SET status='done',finished_at='2026-09-10',summary=?,learned=?,preview=? WHERE id=?").run('Synthetic history result.',JSON.stringify([{text:'Synthetic fixture: Eric Taylor and John Taylor led the controls business.',status:'single_source',sources:[{url:'https://example.org/history',title:'Synthetic fixture'}]}]),JSON.stringify({unresolved:['The personal anecdote is not confirmed.']}),id);
  const sessions=new DialogueSessions({storage:store});sessions.set('s',{...createDialogueState(),researchFocusId:id,lastSubstantiveQuestion:'Strix Taylor family history'});
  const raw='Tell me about the family and the ties to Isle of Man.',resolution=sessions.preview('s',raw);let prompt,lookup;
  await answer({kb,conversations:store,sessionId:'s',question:raw,resolution,emit(){},retrieval:{async focus(q){lookup=q;return {claims:[],coverage:'none',budgetUsed:0,coverageRatio:0};}},
    runModel:async input=>{prompt=input.prompt;input.onDelta('Synthetic fixture answer.');return {costUsd:0};}});
  assert.match(lookup,/Strix Taylor/);assert.match(prompt,/model-researched, source-linked, not independently verified/);assert.doesNotMatch(prompt,/SOURCE EXCERPT \[c_/);assert.match(prompt,/Eric Taylor and John Taylor/);
  assert.match(prompt,/example.org\/history/);assert.match(prompt,/personal anecdote is not confirmed/);
});
test('re-read commands use conversation memory rather than a web or speech rejection',()=>{
  const r=resolveDialogue('Re ingest the entire conversation and figure it out.',undefined,{source:'speech',recognitionConfidence:.9});
  assert.equal(r.route,'answer');assert.equal(r.conversationMeta,true);
});
test('an explicit voiced search starts a source pass, not an ordinary answer',()=>{
  const r=resolveDialogue('Search for the Strix market capitalisation.',undefined,{source:'speech',recognitionConfidence:.9});
  assert.equal(r.route,'research');assert.equal(r.researchMode,'live_sources');assert.deepEqual(r.strategies,['research']);
});
test('family follow-up stays on completed research and retains findings, not only gaps',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
  const store=new ConversationStore(kb.db);store.ensure('s');
  const preview={findings:[{claim:'Synthetic fixture: Eric Taylor founded the controls business; John Taylor later led it.',sources:[{url:'https://example.org/history',primary:true}]}],unresolved:['Whether the unnamed personal contact worked for father or son.']};
  kb.db.prepare("INSERT INTO expeditions(id,question,session_id,jurisdiction,status,summary,preview,created_at,finished_at) VALUES('r','Strix and the Taylor family history','s','IM','done',?,?,?,?)").run('Synthetic Taylor family research is finished.',JSON.stringify(preview),'2026-09-10','2026-09-10');
  const sessions=new DialogueSessions({storage:store});sessions.set('s',{...createDialogueState(),lastSubstantiveQuestion:'Strix and the Taylor family history',researchFocusId:'r'});
  const r=sessions.resolve('s','Tell me about the family and the ties to Isle of Man.');
  assert.equal(r.researchResultId,'r');assert.match(r.canonical,/Strix/);
  const memory=store.context('s',r.raw,{dialogue:r.state});assert.match(memory.text,/Eric Taylor/);assert.match(memory.text,/example.org\/history/);
  assert.ok(memory.estimatedTokens<=3600);
  assert.equal(new DialogueSessions({storage:store}).preview('s','What is the current population?').state.researchFocusId,null);
});
