import * as passages from '../lib/source-passages.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase,claimId} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {sourcePassages} from '../lib/source-passages.mjs';
import {renderFocus} from '../lib/brain.mjs';
import {runLiveTools,liveRequest} from '../lib/live-tools.mjs';
import {persistPublicEvidence,evidenceCurrent,syncPublicEvidence} from '../lib/evidence-ledger.mjs';
import {resolveDialogue} from '../lib/dialogue.mjs';
const url='https://manxnationalheritage.im/research/early-people';
async function source(text,sourceUrl=url){return runLiveTools({question:'Read '+sourceUrl,allowRecovery:false,get:async()=>({url:sourceUrl,headers:{'content-type':'text/html'},body:'<main><p>'+text+'</p></main>'})});}
test('targeted source selection omits unrelated ancillary sections but full reads retain them',()=>{
 const sections=[{body:'Mesolithic archaeology records early settlement evidence.'},{body:'The cafeteria serves seasonal refreshments beside the shop.'}];
 assert.equal(sourcePassages(sections,'Mesolithic archaeology').sections.length,1);
 assert.equal(sourcePassages(sections,'Read the whole document').sections.length,2);
});
test('research findings retain their citation URLs without being labelled verbatim source excerpts',()=>{
 const rendered=renderFocus({coverage:'thin',claims:[{id:'c_test',text:'Synthetic model research.',evidenceKind:'research_finding',sources:[{url,title:'Source'}]}]});
 assert.match(rendered,/model-researched/);assert.match(rendered,/early-people/);assert.doesNotMatch(rendered,/SOURCE EXCERPT/);
});
test('source identities preserve case changes and exact PDF page references',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
 const ids=[];for(const text of ['Manx evidence records the Early Settlement.','Manx evidence records the early settlement.']){const r=persistPublicEvidence(kb,await source(text),{question:'Manx settlement evidence'});ids.push(r.ids[0]);assert.equal(evidenceCurrent(kb.getClaim(r.ids[0])),true);}assert.notEqual(...ids);
 const input={kind:'source_excerpt',text:'Synthetic Manx archaeological evidence in a PDF source.',jurisdiction:'IM'};
 assert.notEqual(kb.upsertClaim({...input,sources:[{url:url+'.pdf#page=1'}]}).claim.id,kb.upsertClaim({...input,sources:[{url:url+'.pdf#page=2'}]}).claim.id);
});
test('private prompts and contact-only pages do not enter the shared factual ledger',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const live=await source('Public enquiries: enquiries@manxnationalheritage.im.');
 assert.equal(persistPublicEvidence(kb,live,{question:'Manx archaeology'}).stored,0);assert.equal(kb.count(),0);
});
test('vector failure preserves saved-source receipt without pretending indexing completed',async()=>{
 const receipt={stored:1};await syncPublicEvidence(receipt,{syncLedger:async()=>{throw Error('Synthetic index outage');},stats:()=>({ledger:{indexable:1,indexed:0}})});
 assert.equal(receipt.stored,1);assert.equal(receipt.index,null);assert.match(receipt.indexError,/failed/);
});
test('mixed Manx cross-border public evidence is eligible; foreign-only conversation is not',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const live=await source('The Manx archaeological evidence records a connection with Cumbria.');
 assert.equal(persistPublicEvidence(kb,live,{question:'Manx history and Britain',jurisdiction:'Isle of Man and United Kingdom'}).stored,1);
 assert.equal(persistPublicEvidence(kb,live,{question:'History of England',jurisdiction:'England'}).stored,0);
});
test('architecture lookup is local, mixed factual questions keep their factual task',()=>{
 assert.equal(resolveDialogue('How does your knowledge base work?').route,'knowledge_info');
 assert.equal(resolveDialogue('How big is your knowledge base?').route,'knowledge_map');
 assert.notEqual(resolveDialogue('How does your knowledge base work? What is the earliest human evidence?').route,'knowledge_info');
 assert.equal(liveRequest('What is the oldest Manx motor car?').name,'search_web');
});
test('conversation context retains actual knowledge-write evidence separately from assistant prose',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db);
 store.start({id:'receipt',sessionId:'one',question:'Early Manx evidence',resolution:{route:'answer',jurisdiction:'Isle of Man',canonical:'Early Manx evidence'}});
 store.finish('receipt',{answer:'Synthetic answer.',metadata:{meta:{knowledgeWrite:{added:1,refreshed:0,rejected:0,entries:[{id:'c_safe',sources:[{url}]}],index:{indexable:1,indexed:1,missing:0,stale:0}}}}});
 assert.match(store.context('one','Was this saved?').text,/knowledgeWrite.*added.*early-people/s);
});

test('legacy source IDs refresh in place after upgrade without renewing another URL',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const live=await source('Synthetic Manx settlement evidence retained from the previous release.');
 const first=persistPublicEvidence(kb,live,{question:'Manx settlement'}),legacy=claimId(live.claims[0].text);kb.db.prepare('UPDATE claims SET id=? WHERE id=?').run(legacy,first.ids[0]);
 const again=persistPublicEvidence(kb,live,{question:'Manx settlement'});assert.equal(kb.count(),1);assert.equal(again.refreshed,1);assert.equal(again.ids[0],legacy);
 const other=await source(live.claims[0].text,'https://www.gov.im/early-people');const next=persistPublicEvidence(kb,other,{question:'Manx settlement'});assert.notEqual(next.ids[0],legacy);assert.equal(evidenceCurrent(kb.getClaim(legacy)),true);
});
test('explicit source commands work from a known subject without another offer',()=>{
 const r=resolveDialogue('Explain early Manx settlement');for(const q of ['Check the official Manx sources','Do your research'])assert.equal(resolveDialogue(q,r.state).route,'research');
});
test('empty foreign lookup has no misleading save-failure receipt',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());assert.equal(persistPublicEvidence(kb,{claims:[],calls:[]},{question:'English geography',jurisdiction:'England'}).reason,undefined);
});
test('recycling does not select a geology source but Manx cross-border geology does',()=>{
 assert.equal(liveRequest('Does Douglas have separate glass recycling?'),null);
 assert.equal(liveRequest('Isle of Man postglacial land separation from Britain',{jurisdiction:'Isle of Man and United Kingdom'}).name,'read_sources');
});

test('early settlement answer stays within the two actually read historical sources',()=>{
 const claims=[{id:'c_mnh',evidenceKind:'source_excerpt',sources:[{url:'https://manxnationalheritage.im/wp-content/uploads/2020/05/MOTM-EarlyPeople-AMesolithic.pdf#page=1'}],text:'The Manx Mesolithic (8000 BC - 4000 BC). The first people left traces during this period.'},{id:'c_report',evidenceKind:'source_excerpt',sources:[{url:'https://www.archaeopress.com/Archaeopress/DMS/9A26816D482B4A05BD823311F1F20BA7/9781805832553-sample.pdf#page=15'}],text:'A pit-house (Cass ny Hawin II), dating to the later ninth millennium cal BC, which is currently the earliest house on Man.'}];
 assert.equal(typeof passages.historySourceAnswer,'function');const q='What is the earliest evidence of people living on the Isle of Man? Distinguish the oldest known house from the date of first arrival, and cite the sources.';
 const r=passages.historySourceAnswer(q,claims);assert.ok(r);assert.match(r.text,/not a date of first arrival/);assert.match(r.text,/Cass ny Hawin II/);assert.doesNotMatch(r.text,/Irish coasts|joined.*Ireland/);assert.deepEqual(r.claimIds,['c_report','c_mnh']);
 for(const wording of [q+' Please cite your sources.','What is the earliest evidence of Manx settlement?','What is the oldest known dwelling in Mannin?'])assert.ok(passages.historySourceAnswer(wording,claims),wording);
 assert.equal(passages.historySourceAnswer(q,claims.slice(0,1)),null);assert.equal(passages.historySourceAnswer(q+' What is the population?',claims),null);assert.equal(passages.historySourceAnswer(q,claims.map(c=>({...c,evidenceKind:'research_finding'}))),null);
});
