import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {VectorStore} from '../lib/vector-store.mjs';
import {ManxRetrieval} from '../lib/manx-retrieval.mjs';
import {knowledgeMap} from '../lib/knowledge-map.mjs';
import {resolveDialogue} from '../lib/dialogue.mjs';
import {answer} from '../lib/brain.mjs';
import {META_MARKER} from '../lib/segmenter.mjs';
const embedder={countTokens:s=>s.split(/\s+/).length,embed:async texts=>texts.map(()=>[1,0,0])};
function fixture(t,getEmbedder=async()=>embedder){const kb=new KnowledgeBase(':memory:'),store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});const retrieval=new ManxRetrieval(kb,null,{store,getEmbedder,debounceMs:2});t.after(()=>{retrieval.close();kb.close();});return {kb,store,retrieval};}
const claim=(kb,extra={})=>kb.upsertClaim({text:'Fixture: Douglas harbour supports ferry operations and coastal navigation.',topic:'ferries',jurisdiction:'IM',kind:'seed',sources:[{url:'https://www.gov.im/old-source/'}],support:2,...extra}).claim;

test('an inactive document for an eligible unchanged claim is restored',async t=>{
 const {kb,store,retrieval}=fixture(t);const c=claim(kb);await retrieval.syncLedger();
 store.deactivate('claim_'+c.id);assert.equal(store.current('claim_'+c.id).active,0);
 await retrieval.syncLedger();
 assert.equal(store.current('claim_'+c.id).active,1);assert.equal(retrieval.stats().ledger.missing,0);
});
test('freshness detects changed text and source provenance, then refreshes both',async t=>{
 const {kb,store,retrieval}=fixture(t);const c=claim(kb);await retrieval.syncLedger();
 kb.replaceSources(c.id,[{url:'https://www.gov.im/corrected-source/'}]);
 assert.equal(retrieval.stats().ledger.stale,1);assert.equal(retrieval.stats().ledger.missing,1);
 await retrieval.syncLedger();assert.equal(store.current('claim_'+c.id).url,'https://www.gov.im/corrected-source/');assert.equal(retrieval.stats().ledger.stale,0);
 kb.db.prepare('UPDATE claims SET topic=? WHERE id=?').run('updated ferry guidance',c.id);assert.equal(retrieval.stats().ledger.stale,1);
});
test('closing during model loading prevents embedding and writes after shutdown',async t=>{
 let release,embeddings=0;const gate=new Promise(r=>{release=r;});const {kb,retrieval}=fixture(t,async()=>{await gate;return {...embedder,embed:async texts=>{embeddings++;return embedder.embed(texts);}};});claim(kb);
 const running=retrieval.watch();retrieval.close();release();await running;
 assert.equal(embeddings,0);assert.equal(retrieval.sync.state,'closed');assert.equal(retrieval.timer,null);
});
test('a retraction arriving during embedding cannot be written back into the active index',async t=>{
 let release,started;const entered=new Promise(r=>{started=r;}),gate=new Promise(r=>{release=r;});
 const {kb,store,retrieval}=fixture(t,async()=>({...embedder,embed:async texts=>{started();await gate;return embedder.embed(texts);}}));const c=claim(kb);
 const running=retrieval.syncLedger();await entered;kb.upsertClaim({text:c.text,status:'retracted'});release();await running;
 assert.notEqual(store.current('claim_'+c.id)?.active,1);
});
test('model failure back-off also applies to answers using a populated index',async t=>{
 let available=true,attempts=0;const {kb,retrieval}=fixture(t,async()=>{attempts++;if(!available)throw Error('Synthetic offline model');return embedder;});claim(kb);await retrieval.syncLedger();available=false;
 const one=await retrieval.focus('ferry operations');retrieval.modelFailedAt=Date.now()-60000;const failedAt=retrieval.modelFailedAt;const two=await retrieval.focus('coastal navigation');assert.equal(retrieval.modelFailedAt,failedAt,'cached failures must not postpone the next permitted retry');
 assert.equal(one.retrievalMode,'keyword_fallback_model_unavailable');assert.equal(two.retrievalMode,'keyword_fallback_model_unavailable');assert.equal(attempts,2,'one initial load and one failed load, without a retry on the next answer');
});
test('concurrent answers report their own retrieval mode',async t=>{
 let release,started;const entered=new Promise(r=>{started=r;}),gate=new Promise(r=>{release=r;});let lookup=0;
 const {kb,retrieval}=fixture(t,async()=>{lookup++;if(lookup===2){started();await gate;throw Error('First answer cannot load its model');}return embedder;});claim(kb);await retrieval.syncLedger();
 const first=retrieval.focus('ferry operations');await entered;const second=await retrieval.focus('coastal navigation');release();const failed=await first;
 assert.equal(second.retrievalMode,'hybrid');assert.equal(failed.retrievalMode,'keyword_fallback_model_unavailable');
});
test('knowledge maps disclose keyword limits, truncation and record dates',t=>{
 const {kb}=fixture(t);for(let i=0;i<45;i++)claim(kb,{text:`Fixture ferries harbour timetable entry number ${i}.`});
 const map=knowledgeMap(kb,'ferries');assert.equal(map.summary.limited,true);assert.match(map.speech,/first 40|more than 40/);assert.doesNotMatch(map.speech,/newest evidence/);assert.match(map.speech,/record/);
 const miss=knowledgeMap(kb,'unmatched paraphrase');assert.doesNotMatch(miss.speech,/nothing in the Manx ledger/);assert.match(miss.speech,/keyword/);
});
test('knowledge-map primary-source counts do not mislabel foreign primary sources as Manx',t=>{
 const {kb}=fixture(t);claim(kb,{sources:[{url:'https://www.gov.uk/fixture/'}]});
 assert.doesNotMatch(knowledgeMap(kb,'ferries').speech,/official Manx sources/);assert.match(knowledgeMap(kb,'ferries').speech,/primary sources/);
});
test('learning a referential foreign subject never silently changes its jurisdiction to Manx',()=>{
 const prior=resolveDialogue('What is company tax in France?');
 const next=resolveDialogue('Learn more about that.',prior.state);assert.equal(next.jurisdiction,'France');assert.doesNotMatch(next.canonical,/official Isle of Man sources/);
});
test('a personal or product conversation is not turned into a public learning brief',()=>{
 const prior=resolveDialogue('Who am I?');const next=resolveDialogue('Learn more about that.',prior.state);assert.notEqual(next.route,'research');
});

test('inline citations are retained even when metadata forgets their IDs',async t=>{
 const {kb}=fixture(t);const c=claim(kb);const events={};
 await answer({kb,question:'What supports ferry operations in Douglas harbour?',sessionId:'s',emit:(n,v)=>{events[n]=v;},runModel:async o=>{o.onDelta(c.text+` [${c.id}]\n`+META_MARKER+JSON.stringify({used:[],confidence:.8}));return {costUsd:0};}});
 assert.equal(events.meta.used[0]?.id,c.id);assert.deepEqual(kb.getEpisode(events.meta.episodeId).claims_used,[c.id]);
});
test('retrieving evidence without a citation is reported without manufacturing citations',async t=>{
 const {kb}=fixture(t);const c=claim(kb);const events={};
 await answer({kb,question:'What supports ferry operations in Douglas harbour?',sessionId:'s',emit:(n,v)=>{events[n]=v;},runModel:async o=>{o.onDelta(c.text+'\n'+META_MARKER+JSON.stringify({used:[],status:'verified',confidence:.99}));return {costUsd:0};}});
 assert.deepEqual(events.meta.used,[]);assert.equal(events.meta.status,'model_prior');assert.equal(events.meta.grounding.status,'uncited_retrieval');assert.ok(events.meta.grounding.retrieved>0);
});
test('invented citations and factual contradictions cannot inherit a verified badge',async t=>{
 const {kb}=fixture(t);const c=claim(kb);const events={};
 await answer({kb,question:'What supports ferry operations in Douglas harbour?',sessionId:'s',emit:(n,v)=>{events[n]=v;},runModel:async o=>{o.onDelta(`Ramsey harbour opened in 1888. [c_invented] [${c.id}]\n`+META_MARKER+JSON.stringify({used:[],status:'verified',confidence:.99}));return {costUsd:0};}});
 assert.equal(events.meta.status,'model_prior');assert.equal(events.meta.used.some(x=>x.id==='c_invented'),false);
});
