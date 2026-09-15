import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interactionCommand} from '../lib/interaction-policy.mjs';
import {DialogueSessions,resolveDialogue} from '../lib/dialogue.mjs';
import {createReviewJobs} from '../lib/review-jobs.mjs';
test('polite and compound action requests remain explicit, with per-action negation',()=>{
  assert.equal(interactionCommand('Can you use the MOM skill as well as explain why the previous search failed?')?.kind,'review');
  assert.equal(interactionCommand('Use MOMM and do not guess.')?.kind,'review');
  const both=interactionCommand('Search that and use MOMM.');assert.equal(both?.kind,'search');assert.equal(both?.subject,'that');assert.equal(both?.review,true);
  assert.equal(interactionCommand('I need you to do the additional search. Can you use the MOM skill as well?')?.review,true);
  for(const q of ['What does MOMM do?','My mum said this.','Do not use MOMM.','The page says "use MOMM".','Do not search that and do not use MOMM.'])assert.equal(interactionCommand(q)?.review||interactionCommand(q)?.kind==='review',false,q);
});
test('do both binds only to the two actions offered on the completed subject',()=>{
  assert.equal(resolveDialogue('Do both.').route,'clarify');
  const d=new DialogueSessions(),first=d.resolve('fixture','Has the Foundations Amendment Bill passed?',{turnId:'t1',clientTurn:1});
  d.markInFlight('fixture',first);d.complete('fixture',first.semanticKey,{pendingAction:{kind:'research',subject:first.canonical,researchMode:'live_sources',reviewTarget:'ep_fixture'}});
  const both=d.preview('fixture','Do both.');assert.equal(both.route,'research');assert.equal(both.reviewRequested,true);assert.equal(both.reviewTarget,'ep_fixture');assert.match(both.canonical,/Foundations/i);
  const another=d.preview('fixture','Tell me about fishing.');d.commit('fixture',another);assert.equal(d.preview('fixture','Do both.').route,'clarify');
});
test('one server job survives observers and always saves terminal no-report failures',async()=>{
  let finish,executions=0;const saved=[];
  const jobs=createReviewJobs({prepare:b=>({sessionId:b.sessionId,resultKey:'episode:ep_fixture',episodeId:'ep_fixture',target:{kind:'episode',id:'ep_fixture'}}),save:(c,r)=>saved.push(structuredClone(r)),execute:async()=>{executions++;return new Promise(resolve=>{finish=resolve;});}});
  const first=jobs.start({sessionId:'one'}),same=jobs.start({sessionId:'one'});assert.equal(first,same);await Promise.resolve();assert.equal(executions,1);
  assert.equal(jobs.get('two','episode:ep_fixture'),null);assert.equal(first.controller.signal.aborted,false);
  finish({ok:false,reason:'provider_timeout'});const result=await first.promise;assert.equal(result.operation.phase,'failed');assert.equal(saved.at(-1).reason,'provider_timeout');assert.ok(saved.at(-1).operation.finishedAt);
});
