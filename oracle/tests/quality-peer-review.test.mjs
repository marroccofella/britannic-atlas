import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveDialogue,DialogueSessions} from '../lib/dialogue.mjs';
import {liveRequest,runLiveTools,parseObservation} from '../lib/live-tools.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {answer} from '../lib/brain.mjs';
import {researchReviewEpisode} from '../lib/results.mjs';
import {rejectionPage} from '../lib/source-content.mjs';
const html='<main><p>Synthetic authoritative source text about public company tax guidance.</p></main>';

test('MOMM: read_sources executes the validated request contract, or reports it empty',async()=>{
 const r=await runLiveTools({question:'unrelated wording',request:{name:'read_sources',urls:['https://www.gov.uk/corporation-tax-rates']},get:async url=>({url,body:html,headers:{'content-type':'text/html'}})});
 assert.equal(r.calls.length,1);assert.equal(r.claims.length,1);
 const empty=await runLiveTools({question:'unrelated wording',request:{name:'read_sources',urls:[]}});assert.equal(empty.calls[0]?.status,'unavailable');
});
test('MOMM counterexamples: page anchor survives the real resolver, search URLs are read, and JSON accepts network bytes',async()=>{
 const r=resolveDialogue('Read https://www.gov.im/document.pdf#page=9 please.');assert.equal(liveRequest(r.canonical).url,'https://www.gov.im/document.pdf#page=9');
 const at=new Date();assert.doesNotThrow(()=>parseObservation(Buffer.from(JSON.stringify([{icaoId:'EGNS',obsTime:Math.floor(+at/1000),temp:12,dewp:9}])),at));
 let reads=0;await runLiveTools({question:'Public lighthouse rules?',request:{name:'search_web'},runModel:async()=>({structured:{urls:['https://www.gov.im/public/']},costUsd:0}),get:async url=>{reads++;return {url,body:html,headers:{'content-type':'text/html'}};}});assert.equal(reads,1);
});
test('MOMM: a public contact answer still offers question-only Search without allowing private-content review',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];
 await answer({kb,question:'Who handles public lighthouse services?',sessionId:'qa',emit:(e,d)=>events.push([e,d]),runModel:async({onDelta})=>{onDelta('Call +44 1624 685000 for details.\n<<meta>>{"used":[]}');return {};}});
 const m=events.find(([e])=>e==='meta')[1];assert.equal(m.researchOffered,true);assert.equal(m.reviewable,false);
});
test('MOMM: repeated explicit case follow-ups retain the latest qualifier without nested wrappers',()=>{
 let r=resolveDialogue('Does a Manx company pay tax on Northern Ireland property?');
 for(let i=0;i<12;i++)r=resolveDialogue('For that same company, clarification '+i+' '+('public assumption '.repeat(20)),r.state);
 assert.match(r.state.lastAnswerSubject,/clarification 11/);assert.ok(r.state.lastAnswerSubject.length<=1800);
 assert.ok((r.canonical.match(/Continue this case:/g)||[]).length<=1);
});
test('MOMM: cross-border research keeps its jurisdiction when projected for review',()=>{
 const r=researchReviewEpisode({id:'x',session_id:'qa',jurisdiction:'Isle of Man and Northern Ireland',question:'Company property taxation',status:'done',learned:[{text:'A substantive synthetic public-source company rule.',status:'single_source',sources:[{url:'https://www.gov.uk/public-guidance',title:'Public guidance'}]}]},'qa');
 assert.equal(r?.jurisdiction,'Isle of Man and Northern Ireland');
});
test('MOMM: explicit search carries jurisdiction on its own pending offer',()=>{
 const d=new DialogueSessions();d.resolve('qa','Does a Manx company sell Northern Ireland property tax-free?');
 const r=d.preview('qa','Search that.');assert.equal(r.pendingAction.jurisdiction,r.jurisdiction);
});
test('MOMM: completing a foreign-only topic cannot arm research on an older Manx answer',()=>{
 const d=new DialogueSessions();for(const q of ['Tell me about Manx infrastructure.','What is the capital of France?']){const r=d.resolve('qa',q);d.markInFlight('qa',r);d.complete('qa',r.semanticKey);}
 assert.notEqual(d.preview('qa','Go deeper.').route,'research');
});
test('MOMM counterexample: an empty news feed never returns a completed source answer',async()=>{
 const r=await runLiveTools({question:'News?',request:{name:'get_news'},get:async url=>({url,body:Buffer.from('<rss><channel></channel></rss>'),headers:{'content-type':'application/rss+xml'}})});
 assert.equal(r.claims.length,0);assert.equal(r.calls[0].status,'unavailable');
});
test('MOMM: text-only rejection is blocked but explanatory security text is allowed',()=>{
 assert.equal(rejectionPage('<p>Access denied. Captcha challenge required.</p>'),true);
 assert.equal(rejectionPage('<main><h1>Security terminology</h1><p>A captcha challenge is one way to distinguish automated requests from ordinary visitors.</p></main>'),false);
});
test('MOMM: recovery links have a distinct dedup key from indexed citations',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const recovery=app.slice(app.indexOf('for(const attempt of d.tools'),app.indexOf('// A citation must point'));
 assert.doesNotMatch(recovery,/seen\.add\(href\)/);assert.match(recovery,/failedSeen\.add/);
});
test('multi-part fallback keeps individually relevant dated evidence but never a failed-read ledger claim for a PDF',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];let prompt='';
 const question='New topic: what is the latest available Isle of Man population figure? Distinguish the latest estimate from the 2021 census and give each reference date.';
 const claim={id:'c_pop',text:'The population estimate was 84975 at Q1 2025.',topic:'Population estimate',trust:.8,status:'verified',verified_at:'2026-09-03',sources:[{url:'https://www.gov.im/population/'}]};
 const retrieval={focus:async()=>({claims:[claim],coverage:'thin',coverageRatio:.3,budgetUsed:20})};
 await answer({kb,retrieval,question,sessionId:'qa',emit:(e,d)=>events.push([e,d]),liveTools:async()=>({claims:[],calls:[{name:'read_page',status:'unavailable'}],costUsd:0}),runModel:async p=>{prompt=p.prompt;p.onDelta('A dated snapshot is available; a newer release was not checked.\n<<meta>>{"used":["c_pop"]}');return {};}});
 assert.match(prompt,/84975/);assert.equal(events.find(([e])=>e==='meta')[1].answerOutcome,'indexed_fallback');
 const pdf='https://www.gov.im/doc.pdf';events.length=0;
 await answer({kb,retrieval:{focus:async()=>({claims:[{...claim,text:'This PDF refused automated reading.',sources:[{url:pdf}]}],coverage:'thin',budgetUsed:20})},question:'Read '+pdf,sessionId:'qa',emit:(e,d)=>events.push([e,d]),liveTools:async()=>({claims:[],calls:[],costUsd:0}),runModel:()=>{throw Error('An access-barrier claim is not document text');}});
 assert.equal(events.find(([e])=>e==='meta')[1].answerOutcome,'source_unavailable');
});
