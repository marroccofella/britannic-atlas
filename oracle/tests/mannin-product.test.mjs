import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDialogue} from '../lib/dialogue.mjs';
import {answer,isResearchable} from '../lib/brain.mjs';
import {localConversation} from '../public/conversation-policy.mjs';
import {episodeReviewable,deliberateEpisode} from '../lib/deliberate.mjs';
import {voiceOptions} from '../public/voice-options.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

for(const question of ['Who are you? What are you? Why are you?',"What don't you know?",'What are your limitations?','What can you not do?','Who is Mannin?']) {
 test('product question stays local: '+question,async()=>{
  const resolution=resolveDialogue(question);assert.equal(resolution.route,'conversation');
  const events=[];const forbidden=()=>{throw Error('Product question must not retrieve or call a model');};
  await answer({question,resolution,emit:(event,data)=>events.push({event,data}),runModel:forbidden,retrieval:{focus:forbidden}});
  const meta=events.find(e=>e.event==='meta').data;
  assert.equal(meta.conversationMeta,true);assert.equal(meta.reviewable,false);assert.equal(meta.costUsd,0);
  assert.equal(isResearchable(question,{explicit:true}),false);
  assert.ok(resolution.speech.length<550);assert.doesNotMatch(resolution.speech,/unsourced.*prior|registry|tax rates|well established/i);
 });
}
test('all parts of a compound question must be about the product',()=>{
 for(const q of ['Who are you? What is corporation tax?','What do you know about tax?','What do you not know about the current budget?'])assert.notEqual(resolveDialogue(q).route,'conversation');
 assert.match(localConversation('Who are you?').text,/Mannin.*oracle for the Isle of Man/i);
});
test('a legacy stored product answer cannot bypass the server review gate',async()=>{
 const episode={id:'e_synthetic',session_id:'s_synthetic',question:"What don't you know?",resolved_question:"Answer this specifically for the Isle of Man: What don't you know?",answer:'I can be wrong.',status:'model_prior',sources:[],jurisdiction:'Isle of Man'};
 assert.equal(episodeReviewable({answer:episode.answer,resolvedQuestion:episode.resolved_question,status:episode.status}),false);
 let spent=false;
 const result=await deliberateEpisode({episode,allowance:{consume(){spent=true;throw Error('must not spend');}},dispatch(){throw Error('must not dispatch');}});
 assert.equal(result.ok,false);assert.equal(spent,false);
});
test('factual source-backed answers remain eligible for an explicitly requested second opinion',()=>{
 assert.equal(episodeReviewable({answer:'Check the named rule and its effective date.',resolvedQuestion:'What company filing rule applies?',status:'single_source',kind:'answer'}),true);
});
test('voice choices are bounded without losing a saved non-English voice',()=>{
 const voices=Array.from({length:300},(_,i)=>({name:'Voice '+i,lang:i<20?'en-GB':'fr-FR'}));
 assert.equal(voiceOptions(voices,'Voice 0').length,8);
 const saved=voiceOptions(voices,'Voice 250');assert.equal(saved.length,9);assert.ok(saved.includes(voices[250]));
 assert.equal(voiceOptions(voices,'Voice 250',{all:true}).length,300);
 assert.deepEqual(voiceOptions([],null),[]);
});
test('missing review confidence and agreement are not displayed as zero percent',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const block=app.slice(app.indexOf('    const confidence =',app.indexOf('  function renderReviewSummary(')),app.indexOf('    if (status.childNodes.length)',app.indexOf('  function renderReviewSummary(')));
 for(const missing of [null,undefined,'']){
  const labels=[];runInNewContext(block,{result:{confidence:missing},review:{agreement:missing},status:{appendChild:value=>labels.push(value)},badge:x=>x,cleanText:x=>String(x??'')});
  assert.deepEqual(labels,[]);
 }
 const labels=[];runInNewContext(block,{result:{confidence:0},review:{agreement:0},status:{appendChild:value=>labels.push(value)},badge:x=>x,cleanText:x=>String(x??'')});
 assert.deepEqual(labels,['confidence 0%','agreement 0%']);
});
