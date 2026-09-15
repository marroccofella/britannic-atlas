import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReviewJobs} from '../lib/review-jobs.mjs';
const prepare=b=>({sessionId:b.sessionId,resultKey:'episode:fixture',episodeId:'fixture',target:{kind:'episode',id:'fixture'}});
test('a failed admission write cannot leave a stuck or dispatched job',async()=>{
  let fail=true,count=0;const jobs=createReviewJobs({prepare,save:()=>{if(fail)throw Error('Synthetic write failure');},execute:async()=>{count++;return {ok:true};}});
  assert.throws(()=>jobs.start({sessionId:'s'}));assert.equal(jobs.get('s','episode:fixture'),null);assert.equal(count,0);
  fail=false;await jobs.start({sessionId:'s'}).promise;assert.equal(count,1);
});
test('allowance refusal records not-started without a dispatched receipt',async()=>{
  const rows=[];const jobs=createReviewJobs({prepare,save:(c,r)=>rows.push(structuredClone(r)),execute:async()=>({ok:false,reason:'allowance_exhausted'})});
  const result=await jobs.start({sessionId:'s'}).promise;assert.equal(result.operation.phase,'not_started');assert.equal(result.operation.dispatchedAt,undefined);
  assert.ok(!rows.some(r=>r.operation.phase==='dispatching'));
});
test('explicit stop cancels only the intended session and prevents undispatched work',async()=>{
  let executions=0;const jobs=createReviewJobs({prepare,save:()=>{},execute:async()=>{executions++;return {ok:true};}});
  const stopped=jobs.start({sessionId:'s'}),other=jobs.start({sessionId:'other'});jobs.stop('s');
  assert.equal((await stopped.promise).reason,'stopped');assert.equal((await other.promise).ok,true);assert.equal(executions,1);
});
