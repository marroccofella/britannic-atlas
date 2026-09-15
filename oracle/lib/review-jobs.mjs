import {randomUUID} from 'node:crypto';
// A request observes a job; only an explicit server stop owns its cancellation.
export function createReviewJobs({prepare,execute,save,onStatus=()=>{}}){
  const running=new Map();
  const key=(sessionId,target)=>JSON.stringify([sessionId,target]);
  function start(body){
    const context=prepare(body);if(context.cached)return {cached:true,promise:Promise.resolve(context.cached),receipt:context.cached.operation};
    const id=key(context.sessionId,context.resultKey),existing=running.get(id);if(existing)return existing;
    const controller=new AbortController(),receipt={id:randomUUID(),phase:'accepted',requestedAt:new Date().toISOString(),target:context.resultKey};
    const job={controller,receipt,promise:null,sessionId:context.sessionId};
    save(context,{ok:false,episodeId:context.episodeId,target:context.target,operation:receipt,reason:'review_accepted'});
    running.set(id,job);
    job.promise=Promise.resolve().then(async()=>{
      let result;
      const dispatched=()=>{receipt.phase='reviewing';receipt.dispatchedAt=new Date().toISOString();save(context,{ok:false,episodeId:context.episodeId,target:context.target,operation:{...receipt},reason:'review_running'});};
      try{
        if(controller.signal.aborted)result={ok:false,reason:'stopped'};
        else{onStatus(context,'started',receipt);result=await execute(context,controller,dispatched);}
      }catch{result={ok:false,reason:'review_execution_failed',message:'The review could not produce a usable result.'};}
      if(controller.signal.aborted)result={ok:false,reason:'stopped',message:'The review was stopped.'};
      receipt.phase=result.ok?'completed':result.reason==='stopped'?'stopped':result.reason==='allowance_exhausted'?'not_started':'failed';receipt.finishedAt=new Date().toISOString();
      const completed={...result,episodeId:context.episodeId,target:context.target,operation:{...receipt}};
      try{save(context,completed);}catch{completed.ok=false;completed.reason='review_save_failed';completed.message='The review result could not be saved. Its completion is unconfirmed.';}
      try{onStatus(context,completed.ok?'finished':'failed',receipt,completed);}catch{/* A display failure must not reject a completed job. */}return completed;
    }).finally(()=>running.delete(id));
    return job;
  }
  return {start,stop:sessionId=>{for(const job of running.values())if(job.sessionId===sessionId)job.controller.abort();},get:(sessionId,target)=>running.get(key(sessionId,target))||null};
}
