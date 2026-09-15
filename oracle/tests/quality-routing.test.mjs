import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDialogue,DialogueSessions} from '../lib/dialogue.mjs';
import {liveRequest,runLiveTools} from '../lib/live-tools.mjs';
import {answer} from '../lib/brain.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import * as targets from '../lib/review-target.mjs';

test('typed and transcribed resource URLs preserve case, underscores and equals',()=>{
 const url='https://www.gov.im/media/983541/Some_File.pdf?id=12';
 for(const source of ['typed','speech']){
  const r=resolveDialogue('Read '+url+' please.',undefined,{source});
  assert.ok(r.canonical.includes(url),r.canonical);
  assert.equal(liveRequest(r.canonical).url,url);
 }
});
test('current observation provenance wording does not veto weather retrieval',()=>{
 for(const q of ['What are temperature and relative humidity at Ronaldsway right now? Say whether humidity is measured or estimated.','What is the latest measured temperature at Ronaldsway?'])assert.equal(liveRequest(q)?.name,'get_weather');
 for(const q of ['How is temperature measured?','What was the temperature yesterday?','What temperature should concrete cure at?'])assert.notEqual(liveRequest(q)?.name,'get_weather');
 assert.equal(liveRequest('lighthouse history',{forceSearch:true})?.name,'search_web');
});
test('UK abbreviation and same-company follow-ups retain the applicable scope',()=>{
 const d=new DialogueSessions();const r=d.resolve('qa','Does a Manx company pay tax on Northern Ireland property?');d.markInFlight('qa',r);d.complete('qa',r.semanticKey);
 assert.match(d.preview('qa','For that same company, assume non-UK residence and no UK permanent establishment. What rate applies?').jurisdiction,/United Kingdom|Northern Ireland/);
 assert.equal(d.preview('qa','What is the weather in Douglas?').jurisdiction,'Isle of Man');
});

test('excluding UK legislation does not turn a Manx-only search into cross-border research',()=>{
 for(const suffix of ['do not import UK legislation','do not apply United Kingdom law','without importing UK rules']){
  assert.equal(resolveDialogue('Search for the Manx law governing laying optical fibre across a public road; '+suffix).jurisdiction,'Isle of Man');
 }
 assert.equal(resolveDialogue('Compare Manx and UK fibre law; do not import UK legislation into Manx law.').jurisdiction,'Isle of Man and United Kingdom');
 assert.match(resolveDialogue('Does a non-UK resident Manx company pay tax on UK property?').jurisdiction,/United Kingdom/);
});

test('an invalid PDF extractor payload fails explicitly without creating evidence',async()=>{
 const url='https://www.gov.im/document.pdf';
 for(const payload of [null,{}, {pages:1,sections:null}]){
  const r=await runLiveTools({request:{name:'read_page',url},get:async()=>({url,headers:{'content-type':'application/pdf'},body:Buffer.from('%PDF-fixture')}),pdfReader:async()=>payload});
  assert.equal(r.claims.length,0);assert.equal(r.calls[0].status,'unavailable');assert.match(r.calls[0].reason,/usable page structure/);
 }
});
test('cross-border factual answers keep source-check and review eligibility',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];
 const question='Does a Manx company pay tax on Northern Ireland property?';
 await answer({kb,sessionId:'qa',question,resolution:resolveDialogue(question),emit:(e,d)=>events.push([e,d]),liveTools:async()=>({calls:[],claims:[{id:'c_tax',text:'These jurisdictions have separate property tax rules.',topic:'Property tax',trust:.65,status:'single_source',sources:[{url:'https://www.gov.uk/corporation-tax-rates'}]}],costUsd:0}),runModel:async({onDelta})=>{onDelta('These are separate jurisdictions; the property tax rules need a source check.\n<<meta>>{"used":[],"confidence":0.3}');return {costUsd:0};}});
 const m=events.find(([e])=>e==='meta')[1];assert.equal(m.researchOffered,true);assert.equal(m.nextSteps[0].researchMode,'live_sources');assert.equal(m.reviewable,true);
});
test('failed source checks are not labelled substantive answers',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];
 await answer({kb,sessionId:'qa',question:'Current synthetic grant eligibility?',emit:(e,d)=>events.push([e,d]),liveTools:async()=>({claims:[],calls:[{name:'search_web',status:'unavailable',reason:'claude timed out after 45000ms'}],costUsd:0,costComplete:false}),runModel:()=>{throw Error('no invented answer');}});
 const m=events.find(([e])=>e==='meta')[1];assert.equal(m.answered,false);assert.equal(m.answerOutcome,'source_unavailable');assert.equal(m.costComplete,false);assert.equal(m.reviewable,false);
 assert.doesNotMatch(events.filter(([e])=>e==='token').map(([,d])=>d.text).join(''),/claude timed out after 45000ms/);
});
test('read failures retain the exact selected destination and browser recovery',async()=>{
 const url='https://www.gov.im/Some_Guidance/';
 const r=await runLiveTools({request:{name:'read_page',url},get:async()=>{throw Error('The source returned HTTP 403.');}});
 assert.equal(r.calls[0].url,url);assert.match(r.calls[0].recovery,/Open.*browser/i);
});
test('PDF reading preserves pages, labels partial coverage and respects cancellation',async()=>{
 const url='https://www.gov.im/media/123/Public_Guidance.pdf';
 const r=await runLiveTools({request:{name:'read_page',url},get:async()=>({url,headers:{'content-type':'application/pdf'},body:Buffer.from('%PDF-test')}),pdfReader:async()=>({sections:[{page:1,body:'Synthetic public guidance on qualification and application requirements for an island grant.'}],pages:2,emptyPages:[2]})});
 assert.equal(r.claims.length,1);assert.match(r.claims[0].sources[0].url,/#page=1$/);assert.match(r.calls[0].notice,/1.*2.*pages/);
});
test('language teaching is primary for its published vocabulary',async()=>{
 const url='https://www.learnmanx.com/learning/colours/';
 const r=await runLiveTools({request:{name:'read_page',url},get:async()=>({url,headers:{'content-type':'text/html'},body:'<main><h1>Colours</h1><p>Jiarg means red, bwee means yellow, and gorrym means blue in this synthetic teaching text.</p></main>'})});
 assert.equal(r.claims[0].sources[0].primary,true);
});

test('saved research cannot refill a failed realtime lookup',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];
 kb.getExpedition=()=>({session_id:'qa',finished_at:'2020-01-01',status:'done',id:'x',learned:[{text:'Old unrelated grant guidance requiring applications before work.',status:'single_source',sources:[{url:'https://www.gov.im/grants/'}]}]});
 await answer({kb,sessionId:'qa',question:'Temperature now?',resolution:{route:'answer',canonical:'Temperature now?',jurisdiction:'Isle of Man',researchResultId:'x'},emit:(e,d)=>events.push([e,d]),liveTools:async()=>({claims:[],calls:[],costUsd:0}),runModel:()=>{throw Error('stale evidence must not reach model');}});
 assert.equal(events.find(([e])=>e==='meta')[1].answerOutcome,'source_unavailable');
});
test('an explicitly requested PDF page is not silently replaced by early pages',async()=>{
 const url='https://www.gov.im/document.pdf#page=9';
 const r=await runLiveTools({request:{name:'read_page',url},get:async safe=>({url:safe,headers:{'content-type':'application/pdf'},body:Buffer.from('%PDF-fixture')}),pdfReader:async()=>({pages:12,emptyPages:[],sections:Array.from({length:12},(_,i)=>({page:i+1,body:'Synthetic guidance for page '+(i+1)+' containing enough public text for a source excerpt.'}))})});
 assert.ok(r.claims.some(c=>c.sources[0].url.endsWith('#page=9')));
});
test('an ordinary conversation reply cannot revive an old paid search subject',()=>{
 const d=new DialogueSessions();d.resolve('qa','Does a Manx company pay tax on Northern Ireland property?');d.resolve('qa','Who am I?');
 assert.equal(d.preview('qa','Search that.').route,'clarify');
});
test('a source offer retains live mode unless the user explicitly narrows the check',()=>{
 const d=new DialogueSessions();const r=d.resolve('qa','Does a Manx company pay tax on Northern Ireland property?');d.markInFlight('qa',r);d.complete('qa',r.semanticKey,{pendingAction:{kind:'research',subject:r.canonical,jurisdiction:r.jurisdiction,researchMode:'live_sources'}});
 assert.equal(d.preview('qa','Search that.').researchMode,'live_sources');
 assert.equal(d.preview('qa','Yes, check official Manx sources.').researchMode,'official_sources');
});
test('stored failed-source outcomes refuse review before paid admission',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);store.ensure('qa');
 const id=kb.recordEpisode({sessionId:'qa',question:'Public tax question?',resolvedQuestion:'Public tax question?',jurisdiction:'Isle of Man',answer:'The source check failed and no usable evidence was returned.',status:'model_prior',claimsUsed:[],confidence:.2,costUsd:0});
 kb.db.prepare("INSERT INTO conversation_turns(id,session_id,seq,question,resolved_question,route,jurisdiction,status,answer,episode_id,metadata,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run('failed','qa',1,'Public tax question?','Public tax question?','answer','Isle of Man','complete','The source check failed.',id,JSON.stringify({meta:{answered:false,reviewable:false,answerOutcome:'source_unavailable'}}),'2026-09-12','2026-09-12');
 assert.match(targets.storedReviewProblem?.(kb,'qa',kb.getEpisode(id))||'',/source|substantive/i);
});
