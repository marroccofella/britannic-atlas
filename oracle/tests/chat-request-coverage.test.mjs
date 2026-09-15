import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDialogue,DialogueSessions} from '../lib/dialogue.mjs';
import {answer} from '../lib/brain.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {liveRequest,runLiveTools,LiveLookupBudget} from '../lib/live-tools.mjs';
import {conversationRepairQuestion} from '../public/conversation-policy.mjs';
import {META_MARKER} from '../lib/segmenter.mjs';

const capabilityExample="We're testing the latest improvements. What external access do you have? If I was to ask outside Douglas, could you get me the weather in Peel?";
const noCall=()=>{throw Error('No external call is appropriate for this conversation turn');};
test('capability example answers both parts locally and preserves its concrete offer through a repair turn',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const d=new DialogueSessions();
  const first=d.resolve('coverage',capabilityExample,{turnId:'t1',clientTurn:1});
  assert.equal(first.conversationMeta,true);d.markInFlight('coverage',first);
  const events=[];const result=await answer({kb,sessionId:'coverage',question:capabilityExample,resolution:first,emit:(a,b)=>events.push([a,b]),runModel:noCall,liveTools:noCall});
  assert.match(result.text,/public.*(?:pages|sources)/i);assert.match(result.text,/Peel/);assert.match(result.text,/Island-wide.*not.*Peel/i);
  assert.match(result.pendingAction.subject,/weather in Peel/i);assert.equal(result.pendingAction.researchMode,'live_sources');
  const meta=events.find(([n])=>n==='meta')[1];assert.equal(meta.reviewable,false);assert.equal(meta.nextSteps[0].reviewAvailable,false);
  d.complete('coverage',first.semanticKey,{pendingAction:result.pendingAction});
  const repair=d.resolve('coverage','Did you see my question?',{turnId:'t2',clientTurn:2});assert.equal(repair.conversationMeta,true);
  d.markInFlight('coverage',repair);d.complete('coverage',repair.semanticKey,{preservePendingAction:repair.preservePendingAction});
  const all=d.preview('coverage','Do it all.');assert.equal(all.route,'research');assert.match(all.canonical,/weather in Peel/i);assert.notEqual(all.reviewRequested,true);
});
test('conversation diagnosis is never a source search or reviewable factual topic',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
  for(const question of ['Did you see my question?','Did you read my last question?','Analyse the conversation, see whether you misunderstood.','Analyze our chat and explain what went wrong.']){
    assert.equal(conversationRepairQuestion(question),true,question);
    const resolution=resolveDialogue(question);assert.equal(resolution.conversationMeta,true,question);
    const events=[];let seen=false;
    await answer({kb,sessionId:'repair',question,resolution,emit:(n,d)=>events.push([n,d]),liveTools:noCall,runModel:async o=>{seen=true;assert.match(o.prompt,/each part|every part/i);o.onDelta('I should check every part of your request against my reply.\n'+META_MARKER+JSON.stringify({used:[],researchable:true,expedition:true}));return {costUsd:0};}});
    assert.ok(seen);const meta=events.find(([n])=>n==='meta')[1];assert.equal(meta.reviewable,false);assert.equal(meta.researchable,false);assert.deepEqual(meta.nextSteps,[]);
  }
  assert.equal(conversationRepairQuestion('Analyse the latest government religious diversity report.'),false);
});
test('a forecast shortcut cannot drop the second part of a factual request',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());let synthesised=false;
  const question='Give me the Isle of Man forecast and explain the difference between forecasts and observations.';
  const claim={id:'c_forecast',topic:'Forecast',text:'The Island forecast predicts rain tomorrow.',trust:.65,status:'single_source',sources:[{url:'https://www.gov.im/weather/',title:'Forecast'}],evidenceKind:'source_excerpt',fetchedAt:new Date().toISOString()};
  const result=await answer({kb,sessionId:'compound',question,resolution:resolveDialogue(question),emit:()=>{},liveTools:async()=>({claims:[claim],calls:[{name:'get_forecast',status:'complete',text:claim.text}],costUsd:0}),runModel:async o=>{synthesised=true;assert.ok(o.prompt.includes(question));o.onDelta('Rain is forecast tomorrow. Forecasts predict; observations record measured conditions.\n'+META_MARKER+JSON.stringify({used:['c_forecast'],answer_outcome:'answered'}));return {costUsd:0};}});
  assert.ok(synthesised);assert.match(result.text,/observations record/);
});
test('actual mixed capability and weather requests retain both halves even if sources fail',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const question='What external access do you have? Get me the weather in Peel now.';
  const resolution=resolveDialogue(question);assert.notEqual(resolution.conversationMeta,true);
  const result=await answer({kb,sessionId:'mixed',question,resolution,emit:()=>{},liveTools:async o=>{assert.equal(o.request.name,'get_town_weather');assert.match(o.question,/Peel/i);return {claims:[],calls:[{name:'search_web',status:'unavailable',reason:'No usable sources',code:'no_source_candidates'}],costUsd:0};},runModel:noCall});
  assert.match(result.text,/public.*(?:pages|sources)/i);assert.match(result.text,/couldn.t complete this source check/i);
});
test('empty search discovery is not repeated with an identical query in the same turn',async()=>{
  let searches=0;const result=await runLiveTools({question:'Current weather in Peel',request:{name:'search_web'},allowRecovery:true,budget:new LiveLookupBudget(),runModel:async()=>{searches++;return {structured:{urls:[]},costUsd:0};},get:noCall});
  assert.equal(searches,1);assert.equal(result.calls.filter(c=>c.name==='search_web').length,1);
});
test('weather planner cannot substitute an Island observation or forecast for a named town',async()=>{
  let searches=0;const result=await runLiveTools({question:'Current conditions in Peel',request:{name:'plan_lookup'},budget:new LiveLookupBudget(),forecastReader:noCall,get:noCall,runModel:async o=>o.tools.length?(searches++,{structured:{urls:[]},costUsd:0}):{structured:{name:'get_forecast',url:''},costUsd:0}});
  assert.equal(searches,1);assert.equal(result.calls.some(c=>c.name==='get_forecast'),false);
  assert.equal(liveRequest(capabilityExample),null);
});
