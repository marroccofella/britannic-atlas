import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {ResultStore} from '../lib/results.mjs';
import {reviewTarget} from '../lib/review-target.mjs';
test('a same-subject failed search does not hide the substantive answer to review',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db),sessionId='fixture';
  const add=(id,question,meta)=>{const answer='Synthetic public factual answer concerning Foundations legislation on the Isle of Man.';
    const ep=kb.recordEpisode({sessionId,question,resolvedQuestion:question,jurisdiction:'Isle of Man',answer,status:'model_prior',confidence:.3,claimsUsed:[]});
    store.start({id,sessionId,question,resolution:{route:'answer',canonical:question,jurisdiction:'Isle of Man'}});store.finish(id,{answer,episodeId:ep,metadata:{meta}});return ep;};
  const original=add('first','Foundations Amendment Bill status?',{reviewable:true});add('second','Foundations Amendment Bill status?',{reviewable:false,answered:false,answerOutcome:'source_unavailable'});
  assert.equal(reviewTarget(kb,sessionId).key,original);
  add('third','Current weather?',{reviewable:false,conversationMeta:true});assert.equal(reviewTarget(kb,sessionId).key,undefined);
});
test('future context contains actual dated diagnostics and terminal review receipt',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db),results=new ResultStore(kb.db);
  store.start({id:'fixture',sessionId:'one',question:'Check public facts',resolution:{route:'answer',canonical:'Public facts',jurisdiction:'Isle of Man'}});
  store.finish('fixture',{answer:'I dispatched both successfully.',metadata:{meta:{tools:[{name:'search_web',status:'unavailable',code:'error_max_turns',checkedAt:'2026-09-12T12:00:00Z',webSearches:1}]}}});
  results.put('one','episode:ep_fixture','public answer',{ok:false,reason:'provider_timeout',operation:{phase:'failed',requestedAt:'2026-09-12T12:00:00Z',finishedAt:'2026-09-12T12:02:00Z'}});
  results.put('two','episode:ep_other','another answer',{ok:true,operation:{phase:'completed'},privateSentinel:'NEVER_CROSS_SESSIONS'});
  const context=store.context('one','Why did the search and review fail?').text;
  assert.match(context,/error_max_turns/);assert.match(context,/provider_timeout/);assert.match(context,/2026-09-12T12:02:00Z/);assert.doesNotMatch(context,/NEVER_CROSS_SESSIONS/);
});
