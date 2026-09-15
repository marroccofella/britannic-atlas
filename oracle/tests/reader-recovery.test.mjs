import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runLiveTools,liveRequest,trustedPage} from '../lib/live-tools.mjs';
import {sourcePassages} from '../lib/source-passages.mjs';
import {rejectionPage} from '../lib/source-content.mjs';
import {accessRows} from '../public/source-access.mjs';
const html=(url,text)=>({url,headers:{'content-type':'text/html'},body:`<main><p>${text}</p></main>`});
const good='This public parliamentary document contains the relevant synthetic register legislation findings for the requested subject.';
test('publisher challenge pages are failures, ordinary security discussion is readable',()=>{
  assert.equal(rejectionPage('<h1>Checking your browser before accessing www.gov.im</h1><p>This process is automatic. Your browser will redirect shortly.</p>'),true);
  assert.equal(rejectionPage('Request Rejected'),true);
  assert.equal(rejectionPage('<article><p>A CAPTCHA verifies that someone is human. This article discusses browser security.</p></article>'),false);
});
test('dated parliamentary catalogue selects readable public documents',()=>{
  const request=liveRequest('Has the Foundations Amendment Bill passed and received Royal Assent?');
  assert.equal(request?.name,'read_sources');assert.ok(request.urls.some(u=>u.includes('2026-PP-0094')));
  for(const url of request.urls)assert.ok(trustedPage(url));
});
test('PDF selection finds a relevant passage beyond the page prefix and first eight pages',()=>{
  const pages=Array.from({length:100},(_,i)=>({page:i+1,body:'Unrelated committee business. '.repeat(180)}));
  pages[81].body+='Foundations Amendment Act: Royal Assent was announced on the recorded sitting date.';
  const selected=sourcePassages(pages,'Did the Foundations Amendment Bill receive Royal Assent?');
  assert.equal(selected.sections[0].page,82);assert.match(selected.sections[0].body,/Royal Assent/);assert.ok(selected.characters<=12000);
});
test('empty searches retain diagnostics without claiming success or hiding the failure',async()=>{
  const r=await runLiveTools({question:'Public register legislation?',request:{name:'search_web'},runModel:async()=>({structured:{urls:[]},webSearches:1,durationMs:42}),get:async()=>{throw Error('no candidates');}});
  assert.equal(r.calls.length,1);assert.equal(r.calls[0].status,'unavailable');assert.equal(r.calls[0].candidateCount,0);assert.equal(r.calls[0].webSearches,1);
  assert.equal(accessRows(r.calls).length,1);assert.equal(accessRows(r.calls)[0].url,null);
});
test('a blocked page automatically reads an independently discovered public alternative',async()=>{
  const original='https://www.gov.im/blocked/',alternate='https://tynwald.org.im/record/';let searches=0;
  const r=await runLiveTools({question:'Public register legislation?',request:{name:'read_page',url:original},allowRecovery:true,
    runModel:async opts=>{searches++;assert.deepEqual(opts.tools,['WebSearch']);assert.ok(!opts.prompt.includes('private conversation'));return {structured:{urls:[original,alternate]},webSearches:1};},
    get:async url=>{if(url===original)throw Object.assign(Error('Publisher challenge'),{code:'site_blocked'});return html(url,good);}});
  assert.equal(searches,1);assert.equal(r.claims.length,1);assert.equal(r.claims[0].sources[0].url,alternate);assert.equal(r.calls[0].status,'unavailable');
  assert.ok(r.calls.some(c=>c.recoveryFor===original&&c.status==='complete'));
});
test('internal deadline retains a completed source and terminates the unfinished progress row',async()=>{
  const events=[];
  const r=await runLiveTools({question:'Public records',request:{name:'read_sources',urls:['https://www.gov.im/a/','https://www.gov.im/b/']},timeoutMs:40,
    emit:(t,d)=>events.push(d),get:async(url,{signal})=>{if(url.endsWith('/a/'))return html(url,good);await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
  assert.equal(r.claims.length,1);assert.ok(r.calls.some(c=>c.code==='lookup_deadline'));assert.equal(events.at(-1).status,'unavailable');
});
test('explicit cancellation still rejects instead of answering with partial content',async()=>{
  const controller=new AbortController();
  await assert.rejects(runLiveTools({question:'Public records',request:{name:'read_page',url:'https://www.gov.im/a/'},signal:controller.signal,get:async()=>{controller.abort();throw controller.signal.reason;}}),{name:'AbortError'});
});
test('town weather requests do not silently become airport observations',()=>{
  assert.equal(liveRequest('Weather in Douglas and Ramsey today?').name,'get_town_weather');
  assert.equal(liveRequest('Weather elsewhere on the Island?').name,'search_web');
});
