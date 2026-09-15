import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {DialogueSessions,createDialogueState} from '../lib/dialogue.mjs';
import {answer} from '../lib/brain.mjs';

const questions=[
  'What is the current statutory title and SD number of the Telecommunications Development Order?',
  'What are the licensing and penalty provisions of the Communications Act 2021?',
  'Are there statutory apparatus rights over private land?',
  'What are the Highways Act 1986 Schedule 4 requirements for cable works?',
  'Is fibre entirely within private land exempt from network licensing?'
];
function fixture(t){
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
  const store=new ConversationStore(kb.db);store.ensure('s');
  const add=(id,subject,unresolved,at,session='s')=>kb.db.prepare("INSERT INTO expeditions(id,question,session_id,jurisdiction,status,summary,preview,created_at,finished_at) VALUES(?,?,?,'IM','done',?,?,?,?)")
    .run(id,subject,session,'Some points remain unverified; see the remaining questions below.',JSON.stringify({unresolved,unreachable:[{url:'https://legislation.gov.im/fibre.pdf',reason:'Request Rejected'}]}),at,at);
  add('leadership','Who holds the Tynwald leadership posts?',['When does the term end?'],'2026-09-08');
  add('fibre','How can I lay optical fibre in the Isle of Man?',questions,'2026-09-09');
  add('private','Secret fibre project',['PRIVATE_OTHER_CHAT'],'2026-09-10','other');
  const sessions=new DialogueSessions({storage:store});
  sessions.set('s',{...createDialogueState(),lastSubstantiveQuestion:'Answer the remaining questions you stated.',pendingQuestion:'Which one, Tynwald leadership or fibre permissions?',pendingQuestionSubject:'Answer the remaining questions you stated.'});
  return {kb,store,sessions,add};
}
test('the exact remaining-questions request binds the latest result, not an older clarification',t=>{
  const {store,sessions}=fixture(t);
  const result=sessions.preview('s','Answer the remaining questions you stated.');
  assert.equal(result.route,'answer');assert.equal(result.researchResultId,'fibre');
  assert.match(result.canonical,/lay optical fibre/);assert.equal(result.state.pendingQuestion,null);
  const memory=store.context('s',result.raw,{dialogue:result.state});
  for(const question of questions)assert.ok(memory.text.includes(question));
  assert.match(memory.text,/Request Rejected/);assert.doesNotMatch(memory.text,/Tynwald|PRIVATE_OTHER_CHAT/);
  assert.ok(memory.estimatedTokens<=3600);
});
test('the repeated correction stays attached after reload and cannot start paid research',t=>{
  const {store,sessions}=fixture(t);
  sessions.resolve('s','Answer the remaining questions you stated.');
  const restored=new DialogueSessions({storage:store});
  const result=restored.preview('s',"In your response, you stated that there were some other questions still outstanding. I'm referring to you answering those that you stated were still outstanding.");
  assert.equal(result.route,'answer');assert.equal(result.researchResultId,'fibre');assert.equal(result.state.pendingAction,null);
});
test('an explicitly named earlier result is respected, and a new question releases the binding',t=>{
  const {sessions}=fixture(t);
  const older=sessions.resolve('s','Answer the remaining questions about Tynwald leadership.');
  assert.equal(older.researchResultId,'leadership');
  const newer=sessions.resolve('s','What is the current population?');
  assert.equal(newer.researchResultId,undefined);assert.equal(newer.state.researchFocusId,null);
  assert.doesNotMatch(newer.canonical,/Tynwald|fibre/);
});
test('absent or malformed research asks one honest question without fabricating a result',t=>{
  const {kb,sessions}=fixture(t);
  kb.db.prepare('DELETE FROM expeditions WHERE session_id=?').run('s');
  const result=sessions.preview('s','Answer the remaining questions you stated.');
  assert.equal(result.route,'clarify');assert.equal(result.conversationMeta,true);
  assert.match(result.speech,/saved research result/i);
});
test('the actual answer prompt and retrieval query carry the selected questions within budget',async t=>{
  const {kb,store,sessions}=fixture(t);let prompt,lookup;
  const raw='Answer the remaining questions you stated.',resolution=sessions.preview('s',raw);
  await answer({kb,conversations:store,sessionId:'s',question:raw,resolution,emit(){},
    retrieval:{async focus(q){lookup=q;return {claims:[],coverage:'none',coverageRatio:0,budgetUsed:0};}},
    runModel:async input=>{prompt=input.prompt;input.onDelta('The five unresolved fibre points are saved, but the legislation page was blocked.');return {costUsd:0,durationMs:1};}});
  assert.match(lookup,/optical fibre/);
  for(const question of questions)assert.ok(prompt.includes(question));
  assert.doesNotMatch(prompt,/Tynwald leadership|PRIVATE_OTHER_CHAT/);
});
test('a rejected low-confidence speech transcript cannot bypass clarification',t=>{
  const {sessions}=fixture(t);
  const result=sessions.preview('s','Answer the remaining questions you stated.',{source:'speech',recognitionConfidence:.1});
  assert.equal(result.route,'clarify');assert.equal(result.researchResultId,undefined);
});
test('naming a subject with no saved result does not silently select fibre',t=>{
  const {sessions}=fixture(t);
  const result=sessions.preview('s','Answer the remaining questions about hotel refurbishment.');
  assert.equal(result.route,'clarify');assert.equal(result.researchResultId,undefined);
});
test('a later accepted source check carries the saved questions, not just the original broad topic',t=>{
  const {sessions}=fixture(t);
  const follow=sessions.resolve('s','Answer the remaining questions you stated.',{turnId:'current',clientTurn:9});
  sessions.markInFlight('s',follow);
  sessions.complete('s',follow.semanticKey,{pendingAction:{kind:'research',subject:follow.canonical}});
  const approved=sessions.preview('s','Yes, check official Manx sources.');
  assert.equal(approved.route,'research');
  for(const question of questions)assert.ok(approved.canonical.includes(question));
});
