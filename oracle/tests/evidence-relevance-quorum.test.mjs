import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runLiveTools} from '../lib/live-tools.mjs';
import {deliberateEpisode,episodeReviewable,EpisodeDeliberationGate,MommHourlyAllowance} from '../lib/deliberate.mjs';
test('an unrelated readable search result is not evidence about religion',async()=>{
  let searches=0;
  const result=await runLiveTools({question:'Isle of Man religious census affiliation figures?',request:{name:'search_web'},allowRecovery:true,
    runModel:async()=>({structured:{urls:[++searches===1?'https://www.gov.im/childcare/':'https://tynwald.org.im/census/']}}),
    get:async url=>({url,headers:{'content-type':'text/html'},body:url.includes('childcare')?'<main><p>Parents are invited to respond to a childcare availability survey this month.</p></main>':'<main><p>The religious affiliation census table lists voluntary respondents to the religion question.</p></main>'})});
  assert.equal(searches,2);assert.equal(result.claims.length,1);assert.match(result.claims[0].sources[0].url,/census/);assert.ok(result.calls.some(c=>c.code==='readable_unrelated'));
});
test('conversational interpretation is never eligible for factual external review',()=>{
  assert.equal(episodeReviewable({answer:'That was probably a misheard command based on our discussion.',resolvedQuestion:'Answer this specifically for the Isle of Man: What do you think I was trying to say based on our conversation?',status:'model_prior',kind:'answer'}),false);
});
test('one successful reviewer cannot satisfy a requested quorum of two',async()=>{
  let synthesis=0;
  const result=await deliberateEpisode({episode:{id:'fixture',session_id:'fixture',question:'What is Tynwald?',resolved_question:'What is Tynwald?',jurisdiction:'Isle of Man',answer:'Tynwald is the legislature of the Isle of Man.',status:'single_source',confidence:.6,kind:'answer',sources:[]},gate:new EpisodeDeliberationGate(),allowance:new MommHourlyAllowance({limit:3}),minSuccess:2,
    dispatch:async()=>({reviewers:[{agent:'grok',status:'success',verdict:'ACCEPT',summary:'Synthetic review.'}],findings:[]}),runModel:async()=>{synthesis++;return {structured:{answer:'Tynwald is the legislature.',status:'single_source',confidence:.6,corrections:[]}};}});
  assert.equal(result.ok,false);assert.equal(result.reason,'insufficient_review_quorum');assert.equal(synthesis,0);assert.equal(result.review.successes,1);
});
