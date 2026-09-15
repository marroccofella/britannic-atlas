// Called only after answer() has persisted its new episode. It cannot review
// a previous answer or manufacture a result after a cancelled lookup.
export function reviewAfterLookup({requested,result,sessionId,jobs,signal}={}){
 if(!requested)return null;signal?.throwIfAborted();
 if(!result?.episodeId)return {kind:'review_unavailable',operation:{phase:'not_started',reason:'No new saved answer was produced for the requested review.'}};
 try{const job=jobs.start({episodeId:result.episodeId,sessionId});return {kind:'review_answer',target:result.episodeId,label:'the answer from this request',serverStarted:true,operation:{...job.receipt}};}
 catch(error){return {kind:'review_unavailable',operation:{phase:'not_started',reason:error.message}};}
}
