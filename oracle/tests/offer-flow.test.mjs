import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDialogue,DialogueSessions} from '../lib/dialogue.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import * as savedResults from '../lib/results.mjs';
import {answer} from '../lib/brain.mjs';
import {parseForecast,readWeather} from '../lib/weather.mjs';
import {approvedPage} from '../public/page-actions.mjs';
import {reviewTarget} from '../lib/review-target.mjs';

const at=new Date('2026-09-11T13:00:00Z');
const forecastHTML='<div class="weather-issued">Issued on Friday, 11 September 2026 at 11:15am by Ronaldsway Met Office</div><p>Synthetic sunny forecast, maximum 17°C.</p><p>Synthetic rain tonight, minimum 12°C.</p><div>Footer</div>';
function fixture(t){const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('s');return {kb,store,d:new DialogueSessions({storage:store}),results:new savedResults.ResultStore(kb.db)};}

test('the reported current-weather question is an executable public-source read, not a model disclaimer',()=>{
  for(const source of ['typed','speech'])assert.equal(resolveDialogue("What's the current weather?",undefined,{source,recognitionConfidence:.9}).route,'weather');
});

test('weather issue times respect Island DST, reject stale/future/malformed pages and use only the forecast body',()=>{
  assert.equal(parseForecast(forecastHTML,at).issuedAt,'2026-09-11T10:15:00.000Z');
  assert.doesNotMatch(parseForecast(forecastHTML,at).forecast,/Footer/);
  assert.equal(parseForecast(forecastHTML.replace('Friday, 11 September','Sunday, 11 January'),new Date('2026-01-11T12:00:00Z')).issuedAt,'2026-01-11T11:15:00.000Z');
  for(const html of ['Request rejected','<h1>Weather</h1>',forecastHTML.replace('11 September','10 September'),forecastHTML.replace('11 September','12 September'),forecastHTML.replace('11:15am','25:15am')])assert.throws(()=>parseForecast(html,at));
});

test('weather fetch is bounded, one-shot, HTML-only and never follows a redirect or fabricates conditions',async()=>{
  let calls=0;const result=await readWeather({at,fetcher:async(url,options)=>{calls++;assert.equal(url,'https://www.gov.im/weather/');assert.equal(options.redirect,'error');return new Response(forecastHTML,{headers:{'content-type':'text/html'}});}});
  assert.equal(result.ok,true);assert.equal(calls,1);assert.match(result.text,/Synthetic sunny/);
  for(const response of [new Response('blocked',{status:403}),new Response('Request rejected',{headers:{'content-type':'text/html'}}),new Response(forecastHTML,{headers:{'content-type':'application/json'}}),new Response('x'.repeat(512001),{headers:{'content-type':'text/html'}})]){
    const failed=await readWeather({at,fetcher:async()=>response});assert.equal(failed.ok,false);assert.doesNotMatch(failed.text,/17|sunny/);assert.match(failed.text,/couldn’t read/);
  }
  const controller=new AbortController();controller.abort();await assert.rejects(readWeather({signal:controller.signal,fetcher:async()=>{throw Error('aborted');}}));
});

test('the new weather offer executes once, survives recap/reload and ignores arbitrary destinations',async t=>{
  const {kb,store,d}=fixture(t);const q=d.resolve('s',"What's the current weather?",{turnId:'weather-turn',clientTurn:1});d.markInFlight('s',q);
  const events=[];const result=await answer({kb,question:q.raw,resolution:q,emit:(e,data)=>events.push([e,data]),weatherReader:()=>readWeather({at,fetcher:async()=>new Response(forecastHTML,{headers:{'content-type':'text/html'}})}),runModel:()=>{throw Error('must not use a model');}});
  d.complete('s',q.semanticKey,{pendingAction:result.pendingAction});assert.equal(events.find(([e])=>e==='meta')[1].status,'single_source');
  const recap=d.resolve('s','Review the chat.',{turnId:'recap',clientTurn:2});d.markInFlight('s',recap);d.complete('s',recap.semanticKey,{preservePendingAction:recap.preservePendingAction});
  const restored=new DialogueSessions({storage:store});const action=restored.resolve('s','Do it.');assert.deepEqual(action.action,{kind:'open_page',target:'weather'});assert.equal(restored.preview('s','Do it.').route,'clarify');
  assert.equal(approvedPage('https://untrusted.invalid'),null);assert.equal(approvedPage('__proto__'),null);
});

test('declines, new topics, low confidence and negated assent never open an old weather offer',t=>{
  const {d}=fixture(t);
  const arm=()=>{const r=d.resolve('s',"What's the current weather?",{turnId:'weather'});d.markInFlight('s',r);d.complete('s',r.semanticKey,{pendingAction:{kind:'open_page',target:'weather',subject:r.canonical}});};
  for(const q of ['Not now.','What is MOMM?','What grants support hotels?']){arm();d.resolve('s',q);assert.notEqual(d.preview('s','Do it.').action?.kind,'open_page',q);}
  for(const q of ['Yes, but do not open it.','Yes, check official Manx sources.']){arm();assert.notEqual(d.preview('s',q).action?.kind,'open_page',q);}
  for(const q of ['Do it.','Open it.']){arm();assert.notEqual(d.preview('s',q,{source:'speech',recognitionConfidence:.5}).action?.kind,'open_page',q);}
});

test('a fresh weather result cannot make MOMM review an older unrelated answer',t=>{
  const {kb,store}=fixture(t);
  store.start({id:'weather-one',sessionId:'s',question:'Current weather?',resolution:{route:'weather',canonical:'Current weather',jurisdiction:'Isle of Man'}});
  store.finish('weather-one',{answer:'Direct official forecast.',metadata:{meta:{reviewable:false}}});
  const target=reviewTarget(kb,'s');assert.ok(target.key,target.reason);assert.match(target.assessment,/Current weather/);assert.doesNotMatch(target.assessment,/Strix/);
});

test('read out what you just did resolves a saved result without asking a model to describe its actions',()=>{
  for(const q of ['Read out aloud what you just did.','Read that aloud.','Read the chart aloud.','Read aloud the last answer.'])assert.equal(resolveDialogue(q,undefined,{source:'speech',recognitionConfidence:.9}).route,'readback',q);
  assert.notEqual(resolveDialogue('Do not read that aloud.').route,'readback');
});

test('reviewing the chat and reloading do not erase or invalidate the pending offer',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('s');
  let d=new DialogueSessions({storage:store});
  const q=d.resolve('s','What grants support hotel renovation?',{turnId:'source-turn',clientTurn:1});d.markInFlight('s',q);d.complete('s',q.semanticKey,{pendingAction:{kind:'research',subject:q.canonical}});
  const before=d.get('s').pendingAction;
  const recap=d.resolve('s','Review the chat.',{turnId:'recap',clientTurn:2});d.markInFlight('s',recap);d.complete('s',recap.semanticKey,{preservePendingAction:recap.preservePendingAction});
  assert.deepEqual(d.get('s').pendingAction,before);
  d=new DialogueSessions({storage:store});assert.equal(d.preview('s','Do it.').route,'research');
});

test('readback uses the same-conversation canvas payload, not the canvas launch announcement',t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db),results=new savedResults.ResultStore(kb.db);
  store.start({id:'visual-one',sessionId:'s',question:'Make a chart',resolution:{route:'visual',canonical:'Make a chart',jurisdiction:'Isle of Man'}});
  store.finish('visual-one',{answer:'I will build a canvas.',metadata:{action:{kind:'generate_canvas',actionId:'chart-one'}}});
  results.put('s','canvas:chart-one','fixture',{ok:true,spec:{version:1,factual:false,width:720,height:420,kind:'node-edge',title:'Synthetic jurisdiction chart',nodes:[{id:'a',label:'Assembly'},{id:'b',label:'Council'}],edges:[{from:'a',to:'b',label:'appoints'}]},narration:'An illustrative chart, not verified law.'});
  assert.equal(typeof savedResults.readbackResult,'function');
  const result=savedResults.readbackResult(kb,results,'s');assert.match(result.text,/Assembly.*appoints.*Council/s);assert.doesNotMatch(result.text,/I will build/);
  assert.equal(savedResults.readbackResult(kb,results,'other').text,undefined);
});

test('readback fails closed on a malformed saved chart instead of crashing or announcing a result',t=>{
  const {kb,store,results}=fixture(t);
  store.start({id:'bad-chart',sessionId:'s',question:'A chart',resolution:{route:'visual',canonical:'A chart',jurisdiction:'Isle of Man'}});
  store.finish('bad-chart',{answer:'Launching a chart',metadata:{action:{kind:'generate_canvas',actionId:'bad-chart'}}});
  results.put('s','canvas:bad-chart','fixture',{ok:true,spec:{kind:'bar',series:[{points:'invalid'}]}});
  assert.match(savedResults.readbackResult(kb,results,'s').reason,/invalid|unreadable/i);
});

test('readback reads a completed voiced MOMM result, not its launch message',t=>{
  const {kb,store,results}=fixture(t);
  store.start({id:'review-command',sessionId:'s',question:'Use MOMM',resolution:{route:'review',canonical:'Use MOMM',jurisdiction:'Isle of Man'}});
  store.finish('review-command',{answer:'I will ask MOMM to review that.',metadata:{action:{kind:'review_answer',target:'example-episode'}}});
  results.put('s','episode:example-episode','fixture',{ok:true,answer:'Synthetic considered answer from a completed review.'});
  assert.match(savedResults.readbackResult(kb,results,'s').text,/Synthetic considered answer/);
});

test('old null metadata is harmless to saved answer readback',t=>{
  const {kb,store,results}=fixture(t);
  store.start({id:'null-meta',sessionId:'s',question:'Example',resolution:{route:'answer',canonical:'Example',jurisdiction:'Isle of Man'}});
  store.finish('null-meta',{answer:'Saved example.',metadata:null});
  assert.match(savedResults.readbackResult(kb,results,'s').text,/Saved example/);
});
