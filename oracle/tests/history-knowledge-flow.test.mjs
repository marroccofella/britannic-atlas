import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {DialogueSessions,resolveDialogue} from '../lib/dialogue.mjs';
import {liveRequest,runLiveTools} from '../lib/live-tools.mjs';
import {persistPublicEvidence,evidenceCurrent} from '../lib/evidence-ledger.mjs';
import {answer} from '../lib/brain.mjs';
const history='What is the earliest evidence of human settlement on the Isle of Man?';
const land='What did you mean about the separation from England and Ireland? Be specific. And what evidence supports those ages? Are there registered ancient monuments?';
function offered(){const d=new DialogueSessions(),r=d.resolve('s',history,{turnId:'history',clientTurn:1});d.markInFlight('s',r);d.complete('s',r.semanticKey,{pendingAction:{kind:'research',subject:r.canonical,jurisdiction:'Isle of Man',researchMode:'live_sources'}});return d;}
async function read(url,text,question='Read '+url){return runLiveTools({question,allowRecovery:false,get:async()=>({url,headers:{'content-type':'text/html'},body:'<main><h1>Early Manx settlement</h1><p>'+text+'</p></main>'})});}
test('compound assent uses the pending task in typed and confident speech',()=>{
 for(const q of ['Of course, yes, do it.','OK, Yep. Are you?','Tell. Tell me.'])for(const source of ['typed','speech']){const r=offered().preview('s',q,{source,recognitionConfidence:.9});assert.equal(r.route,'research',q);assert.match(r.canonical,/earliest evidence/);}
});
test('denial and a changed factual question cannot consent to an older search',()=>{
 for(const q of ['Yes, but do not search.','Of course, yes, do not do it.','Yes, but tell me about something else.'])assert.notEqual(offered().preview('s',q).route,'research',q);
 assert.equal(offered().preview('s','Of course, yes, do it.',{source:'speech',recognitionConfidence:.5}).route,'clarify');
 assert.equal(resolveDialogue('Of course, yes, do it.').route,'clarify');
});
test('history evidence requests perform a source check without a second permission',()=>{
 for(const q of ["Let's talk about the background of the country and its very first beginnings. What is the oldest piece of information you can find about its existence?",history,land])assert.ok(liveRequest(q),q);
 for(const q of ['Do not search for the oldest history.','What is a knowledge base?'])assert.equal(liveRequest(q),null);
});
test('a Manx historical relation does not switch the whole answer to England',()=>{
 const r=offered().preview('s',land);assert.equal(r.jurisdiction,'Isle of Man');assert.match(r.canonical,/Isle of Man/);
 assert.equal(offered().preview('s','What is the history of England?').jurisdiction,'England');
});
test('diagnostic turns preserve the factual offer and do not invent a new task',()=>{
 for(const q of ['You asked me to do it and I told you to do it. Why are you losing context?','List all the issues.','Reflect on this conversation and its failures.']){const d=offered(),before=d.get('s').pendingAction;const r=d.resolve('s',q);assert.deepEqual(r.state.pendingAction,before,q);assert.equal(r.preservePendingAction,true,q);assert.notEqual(r.route,'research');}
});
test('a delivery complaint can resume the already requested public source check',()=>{
 const r=offered().preview('s',"You haven't given me the answer and you're still making me repeat myself. Nothing else came from your blurb.");assert.equal(r.route,'research');assert.match(r.canonical,/earliest evidence/);
});
test('same passage from separate sources has independent freshness and evidence identity',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const text='Synthetic Manx archaeology evidence describes early settlement on the island.';
 const ids=[];for(const url of ['https://manxnationalheritage.im/early-people','https://www.gov.im/archaeology']){const receipt=persistPublicEvidence(kb,await read(url,text),{question:history});assert.equal(receipt.stored,1);ids.push(receipt.ids[0]);assert.equal(evidenceCurrent(kb.getClaim(receipt.ids[0])),true);}
 assert.notEqual(ids[0],ids[1]);assert.equal(kb.getClaim(ids[0]).sources.length,1);
});
test('a reader excerpt cannot collide with and promote a seed or model claim',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const url='https://www.gov.im/archaeology';const live=await read(url,'Synthetic Manx archaeology describes early settlement evidence.');
 const old=kb.upsertClaim({text:live.claims[0].text,kind:'seed',jurisdiction:'IM',sources:[{url:'https://www.gov.im/seed'}]}).claim;
 const receipt=persistPublicEvidence(kb,live,{question:history});const fresh=kb.getClaim(receipt.ids[0]);assert.notEqual(fresh.id,old.id);assert.equal(fresh.kind,'source_excerpt');assert.equal(fresh.status,'single_source');
});
test('repeat source reads report refreshes without growing support and preserve page citations',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const url='https://manxnationalheritage.im/early-people',live=await read(url,'Synthetic early Manx settlement is documented in archaeology.');
 const a=persistPublicEvidence(kb,live,{question:history}),b=persistPublicEvidence(kb,live,{question:history});assert.equal(a.added,1);assert.equal(b.added,0);assert.equal(b.refreshed,1);assert.deepEqual(a.ids,b.ids);assert.equal(kb.getClaim(a.ids[0]).support,1);assert.equal(b.entries[0].sources[0].url,url);
});
test('public contact footer does not discard the factual passage or become learned knowledge',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const url='https://manxnationalheritage.im/early-people';const live=await read(url,'Synthetic Manx archaeology documents early human settlement. Public enquiries: enquiries@manxnationalheritage.im.');
 const r=persistPublicEvidence(kb,live,{question:history});assert.equal(r.stored,1);assert.match(kb.getClaim(r.ids[0]).text,/early human settlement/);assert.doesNotMatch(kb.getClaim(r.ids[0]).text,/@/);assert.equal(evidenceCurrent(kb.getClaim(r.ids[0])),true);
 assert.equal(persistPublicEvidence(kb,live,{question:'My email is private@example.org'}).stored,0);
 live.claims[0].text='Tampered synthetic passage must not be stored.';assert.equal(persistPublicEvidence(kb,live,{question:history}).stored,0);
});
test('source reads and storage happen before the history answer and the model sees actual runtime facts',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());let tools=0,meta;
 await answer({kb,question:history,sessionId:'history',emit:(e,d)=>{if(e==='meta')meta=d;},liveTools:async()=>{tools++;return read('https://manxnationalheritage.im/early-people','Synthetic early Manx settlement archaeology is described here.');},runModel:async o=>{assert.equal(tools,1);assert.ok(kb.count()>0);assert.match(o.system,/SQLite.*FTS5/s);assert.match(o.prompt,/KNOWLEDGE WRITE RECEIPT/);const id=o.prompt.match(/SOURCE EXCERPT \[(c_[a-z0-9]+)\]/)[1];o.onDelta('Early Manx settlement has archaeological evidence. ['+id+']\n<<meta>>{"used":["'+id+'"],"confidence":0.5,"researchable":true}');return {costUsd:0};}});
 assert.equal(meta.knowledgeWrite.added,1);assert.equal(meta.knowledgeWrite.entries.length,1);
});

test('two inspected history passages answer directly with completed writes and exact page citations',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];
 const question='What is the earliest evidence of people living on the Isle of Man? Distinguish the oldest known house from the date of first arrival, and cite the sources.';
 const get=async url=>({url,headers:{'content-type':'application/pdf'},body:Buffer.from('%PDF-'+(url.includes('Archaeopress')?'excavation':'leaflet'))});
 const pdfReader=async bytes=>bytes.toString().includes('excavation')?{pages:18,sections:[{page:15,body:'A pit-house (Cass ny Hawin II), dating to the later ninth millennium cal BC, which is currently the earliest house on Man.'}]}:{pages:4,sections:[{page:1,body:'The Manx Mesolithic (8000 BC - 4000 BC). Early human settlement is described in this period overview.'}]};
 let indexed=false;
 await answer({kb,question,sessionId:'bounded-history',emit:(name,data)=>{if(name==='token'){assert.equal(indexed,true);assert.equal(kb.count(),2);}events.push({name,data});},retrieval:{syncLedger:async()=>{assert.equal(kb.count(),2);indexed=true;},stats:()=>({ledger:{indexable:2,indexed:2,missing:0,stale:0}})},liveTools:options=>runLiveTools({...options,get,pdfReader,allowRecovery:false}),runModel:async()=>assert.fail('Covered source answer must not call a generative model')});
 const meta=events.find(e=>e.name==='meta').data,text=events.filter(e=>e.name==='token').map(e=>e.data.text).join('');
 assert.equal(meta.model,'public-source-tools');assert.equal(meta.costUsd,0);assert.equal(meta.knowledgeWrite.added,2);assert.equal(meta.knowledgeWrite.index.missing,0);assert.equal(meta.used.length,2);
 assert.ok(meta.used.some(c=>c.sources.some(s=>s.url.endsWith('sample.pdf#page=15'))));assert.ok(meta.used.some(c=>c.sources.some(s=>s.url.endsWith('Mesolithic.pdf#page=1'))));
 assert.match(text,/not a date of first arrival/);assert.doesNotMatch(text,/Irish coasts/);assert.ok(events.findIndex(e=>e.name==='tool')<events.findIndex(e=>e.name==='token'));
});
