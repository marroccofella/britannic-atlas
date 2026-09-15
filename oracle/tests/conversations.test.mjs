import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore,assistantQuestion,estimateTokens,fitText} from '../lib/conversations.mjs';
import {DialogueSessions,createDialogueState,resolveDialogue} from '../lib/dialogue.mjs';
import {salientTerms} from '../lib/entailment.mjs';
import {answer,ORACLE_SYSTEM} from '../lib/brain.mjs';
import {acquireInstanceLease} from '../lib/instance-lease.mjs';

function fixture(t) { const kb=new KnowledgeBase(':memory:'); t.after(()=>kb.close()); return {kb,store:new ConversationStore(kb.db)}; }
function turn(store,session,id,question,answer,extra={}) {
  store.start({id,sessionId:session,clientTurn:Number(id.replace(/\D/g,''))||1,question,resolution:{canonical:question,route:'answer',jurisdiction:'Isle of Man'}});
  store.finish(id,{answer,...extra});
}
test('long answers retain their ending question in bounded conversational memory',t=>{
  const {store}=fixture(t); const reply='A lengthy explanation. '.repeat(500)+' Which EU country do you live in?';
  turn(store,'s','r1','Explain Manx loopholes',reply);
  store.saveState('s',{pendingQuestion:assistantQuestion(reply),pendingQuestionSubject:'Explain Manx loopholes'});
  const memory=store.context('s','Ireland.');
  assert.match(memory.text,/Which EU country/); assert.ok(memory.estimatedTokens<=memory.budgetTokens);
  assert.equal(store.page('s').turns[0].answer,reply);
});
test('full transcript paging, local replies and idempotency keep conversation boundaries',t=>{
  const {store}=fixture(t);
  for(let n=1;n<=95;n++) turn(store,'s',`r${n}`,`Question ${n}`,`Answer ${n}`);
  turn(store,'private','private1','Secret other session','do not retrieve this');
  let before=null,rows=[];
  do { const page=store.page('s',{before}); rows.push(...page.turns); before=page.before; } while(before);
  assert.equal(rows.length,95); assert.equal(new Set(rows.map(row=>row.id)).size,95);
  assert.equal(store.start({id:'r1',sessionId:'s',question:'duplicate',resolution:{}}),false);
  assert.equal(store.finish('r1',{answer:'overwritten'}),false);
  assert.doesNotMatch(store.context('s','Secret other session').text,/do not retrieve/);
});
test('older relevant dialogue is recalled while a long session stays bounded',t=>{
  const {store}=fixture(t); turn(store,'s','r1','What are the Manx flag colours?','The flag note is ruby and silver.');
  for(let n=2;n<=120;n++) turn(store,'s',`r${n}`,'Discuss unrelated railways','Railway context. '.repeat(900));
  const memory=store.context('s','What did we say about flag colours?');
  assert.match(memory.text,/ruby and silver/); assert.ok(memory.estimatedTokens<=3600);
});
test('legacy migration is idempotent and restores the question Mani was asking',t=>{
  const {kb,store}=fixture(t);
  kb.recordEpisode({sessionId:'legacy',question:'Explain Manx loopholes for EU residents',answer:'Tell me which EU country you live in.',jurisdiction:'Isle of Man',confidence:.5,status:'model_prior',claimsUsed:[]});
  store.importLegacy('legacy');store.importLegacy('legacy');
  assert.equal(store.page('legacy').turns.length,1);
  const sessions=new DialogueSessions({storage:store});
  assert.equal(sessions.preview('legacy','Ireland.',{source:'speech',recognitionConfidence:.9}).route,'answer');
});
test('cached dialogue survives eviction and restart interruption clears only in-flight state',t=>{
  const {store}=fixture(t);const sessions=new DialogueSessions({storage:store,maxSessions:1});
  const state={...createDialogueState(),lastSubstantiveQuestion:'Explain Manx tax',pendingQuestion:'Which country are you resident in?',inFlightKey:'working'};
  sessions.set('s',state);sessions.set('other',createDialogueState());
  assert.equal(sessions.get('s').pendingQuestion,state.pendingQuestion);
  store.start({id:'r1',sessionId:'s',question:'Ireland',resolution:{canonical:'Ireland',route:'answer',jurisdiction:'Isle of Man'}});
  store.checkpoint('r1','This partial answer was spoken.');
  store.interruptRunning();
  assert.equal(store.page('s').turns[0].status,'interrupted');
  assert.equal(store.page('s').turns[0].answer,'This partial answer was spoken.');
  assert.equal(new DialogueSessions({storage:store}).get('s').inFlightKey,null);
  assert.equal(store.loadState('s').pendingQuestion,state.pendingQuestion);
});
test('a second live instance cannot invalidate an active answer; stale leases are recoverable',t=>{
  const {kb,store}=fixture(t);const release=acquireInstanceLease(kb.db,{pid:123,alive:()=>true});
  store.start({id:'r1',sessionId:'s',question:'Hello',resolution:{canonical:'Hello',route:'answer',jurisdiction:'Isle of Man'}});
  assert.throws(()=>acquireInstanceLease(kb.db,{pid:456,alive:()=>true}),/already open/);
  assert.equal(store.finish('r1',{answer:'Still intact'}),true);
  const releaseNext=acquireInstanceLease(kb.db,{pid:456,alive:()=>false});
  release();assert.throws(()=>acquireInstanceLease(kb.db,{alive:()=>true}),/already open/);
  releaseNext();acquireInstanceLease(kb.db,{alive:()=>true})();
});
test('unkeyed cancellation clears in-flight state without deleting saved conversational context',t=>{
  const {store}=fixture(t),sessions=new DialogueSessions({storage:store});
  sessions.set('s',{...createDialogueState(),inFlightKey:'abc',lastSubstantiveQuestion:'Explain Manx law'});
  sessions.cancel('s');assert.equal(sessions.get('s').inFlightKey,null);assert.equal(store.loadState('s').inFlightKey,null);
  assert.equal(store.loadState('s').lastSubstantiveQuestion,'Explain Manx law');
});
test('turn payloads omit fields belonging only to conversation records',t=>{
  const {store}=fixture(t);turn(store,'s','r1','Hello','Hello there');
  assert.equal(Object.hasOwn(store.page('s').turns[0],'dialogue'),false);
});
test('already imported episodes are not reloaded during a later migration pass',t=>{
  const {kb,store}=fixture(t);kb.recordEpisode({sessionId:'s',question:'Question',answer:'Answer',confidence:.5,claimsUsed:[]});
  store.importLegacy('s');let loaded=0;
  store.db={prepare(sql){const statement=kb.db.prepare(sql);return /^SELECT \* FROM episodes/.test(sql)?{all(...args){const rows=statement.all(...args);loaded+=rows.length;return rows;}}:statement;}};
  store.importLegacy('s');assert.equal(loaded,0);
});
test('yes can answer a saved clarification but cannot authorize an unoffered research job',()=>{
  const state={...createDialogueState(),lastSubstantiveQuestion:'Explain the Manx flag',pendingQuestion:'Would you like a short explanation?',pendingQuestionSubject:'Explain the Manx flag'};
  assert.equal(resolveDialogue('Yes.',state,{source:'speech',recognitionConfidence:.9}).route,'answer');
  assert.equal(resolveDialogue('Yes.',createDialogueState(),{source:'speech',recognitionConfidence:.9}).route,'clarify');
});
test('home-scope follow-up offers belong to the answer just completed, not its stable topic',()=>{
  for(const reply of ['Loopholes.','You asked me which country?','Yes.']){
    const sessions=new DialogueSessions();
    const state={...resolveDialogue('Explain Manx tax loopholes',createDialogueState()).state,pendingQuestion:'Would you like a short explanation?',pendingQuestionSubject:'Explain Manx tax loopholes'};
    const follow=resolveDialogue(reply,state,{turnId:'current',clientTurn:2});sessions.markInFlight('s',follow);
    sessions.complete('s',follow.semanticKey,{pendingAction:{kind:'research',subject:follow.canonical}});
    assert.equal(sessions.get('s').pendingAction.origin.semanticKey,follow.semanticKey);
    assert.equal(resolveDialogue('Yes, check the official sources.',sessions.get('s')).route,'research');
  }
});
test('a recycled PID cannot impersonate a live Oracle database owner',t=>{
  const {kb}=fixture(t);acquireInstanceLease(kb.db,{pid:4242,alive:()=>true,identity:()=> 'old-process-birth'});
  assert.doesNotThrow(()=>acquireInstanceLease(kb.db,{pid:99,alive:()=>true,identity:()=> 'new-process-birth'}));
});
test('a foreign-only answer does not offer an incompatible official-Manx research action',async t=>{
  const {kb,store}=fixture(t);store.ensure('s');
  const result=await answer({kb,conversations:store,question:'What are the company requirements in Jersey?',resolution:resolveDialogue('What are the company requirements in Jersey?'),sessionId:'s',emit(){},runModel:async input=>{input.onDelta('This needs current verification. <oracle_meta>{"confidence":0.2,"researchable":true,"expedition":true}</oracle_meta>');return {costUsd:0};}});
  assert.equal(result.researchOffered,true);
  assert.equal(result.nextSteps[0].researchMode,'live_sources');
  assert.equal(result.nextSteps[0].jurisdiction,'Jersey');
});
test('long pending questions retain a readable beginning and their actual final question',()=>{
  const question='Which of the following European Union member states, '+'considering residence rules, '.repeat(40)+'do you live in?';
  const remembered=assistantQuestion('Some answer. '+question);assert.match(remembered,/^Which/);assert.match(remembered,/do you live in\?/);assert.ok(remembered.length<=900);
});
test('deleting a turn maintains the FTS external-content index',t=>{
  const {kb,store}=fixture(t);turn(store,'s','r1','Flag colours','A flag result');
  kb.db.prepare('DELETE FROM conversation_turns WHERE id=?').run('r1');
  assert.doesNotThrow(()=>kb.db.exec("INSERT INTO conversation_fts(conversation_fts,rank) VALUES('integrity-check',1)"));
});
test('short clarification replies use the actual saved question and never launch research',()=>{
  const state={...createDialogueState(),lastSubstantiveQuestion:'Explain Manx loopholes compared with Canada',pendingQuestion:'Where are you resident?',pendingQuestionSubject:'Explain Manx loopholes compared with Canada'};
  const ambiguous=resolveDialogue('Island.',state,{source:'speech',recognitionConfidence:.9});
  assert.equal(ambiguous.route,'clarify');assert.match(ambiguous.speech,/Where are you resident/);assert.doesNotMatch(ambiguous.speech,/EU country/);
  assert.equal(resolveDialogue('Ireland.',state,{source:'speech',recognitionConfidence:.9}).route,'answer');
  assert.equal(resolveDialogue('You asked me which country?',state).preservePendingQuestion,true);
});
test('repeated topic echoes keep a stable subject instead of nesting the full prior request',()=>{
  let state=resolveDialogue('Explain Manx loopholes',createDialogueState()).state;
  for(let n=0;n<220;n++) { const result=resolveDialogue('Loopholes.',state);assert.equal(result.route,'answer');assert.ok(result.canonical.length<1500);state=result.state; }
});
test('older completed research is retrieved by topic and isolated by conversation',t=>{
  const {kb,store}=fixture(t);store.ensure('s');
  const insert=kb.db.prepare("INSERT INTO expeditions(id,question,session_id,status,summary,created_at,finished_at) VALUES(?,?,?,'done',?,?,?)");
  for(let n=0;n<5;n++) insert.run(`e${n}`,n===0?'Manx flag colours':'Unrelated railway journey','s',n===0?'The remembered flag result is scarlet.':'A recent railway result.',`2026-09-0${n+1}`,`2026-09-0${n+1}`);
  insert.run('secret','Manx flag colours','elsewhere','Secret cross-session result','2026-09-06','2026-09-06');
  const memory=store.context('s','What did we establish about flag colours?');
  assert.match(memory.text,/scarlet/);assert.doesNotMatch(memory.text,/Secret cross-session/);
});
test('prompt budget includes system, scope, evidence and a pathological resolved request',async t=>{
  const {kb,store}=fixture(t);store.ensure('s');let observed;
  await answer({kb,conversations:store,question:'Loopholes.',sessionId:'s',resolution:{...resolveDialogue('Explain Manx loopholes'),canonical:'loopholes '.repeat(6000)},emit(){},runModel:async input=>{
    observed=input;input.onDelta('I need more detail.');return {text:'I need more detail.',costUsd:0,durationMs:1};
  }});
  assert.ok(estimateTokens(observed.system+observed.prompt)<=8500);assert.equal(observed.system,ORACLE_SYSTEM);
});
test('extractive fitting is Unicode-safe and contractions are not named evidence claims',()=>{
  assert.ok(estimateTokens(fitText('🏝️ Éire '.repeat(2000),300))<=300);
  assert.deepEqual(salientTerms("I’ll check. I've checked. You're welcome. Douglas is a place.").map(x=>x.display),['Douglas']);
});
