import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {conversationReviewTarget} from '../lib/conversation-review.mjs';
import {wholeRequestCoveredByTool} from '../public/request-coverage.mjs';
import {persistPublicEvidence,evidenceCurrent} from '../lib/evidence-ledger.mjs';
import {resolveDialogue} from '../lib/dialogue.mjs';
import {runLiveTools} from '../lib/live-tools.mjs';
import {VectorStore} from '../lib/vector-store.mjs';

test('town temperatures do not silently answer another locality or a second task',()=>{
 for(const q of ['Temperatures in Douglas and Ballasalla','Temperatures in Douglas and explain its history','Weather in Douglas with the latest transport disruption'])assert.equal(wholeRequestCoveredByTool(q,'get_town_weather'),false,q);
 for(const q of ['What are the temperatures in every major town and city?','Current temperature in Douglas and Ramsey','How cold is it in Peel?'])assert.equal(wholeRequestCoveredByTool(q,'get_town_weather'),true,q);
});
test('source URL mutation invalidates the evidence record',async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const url='https://www.gov.im/harbours';
 const live=await runLiveTools({question:'Read '+url,allowRecovery:false,get:async()=>({url,headers:{'content-type':'text/html'},body:'<h1>Manx harbours</h1><p>Public harbour opening hours for Manx mariners and visitor moorings.</p>'})});
 const r=persistPublicEvidence(kb,live,{question:'Manx harbour opening hours'});
 const c=kb.getClaim(r.ids[0]);assert.equal(evidenceCurrent(c),true);c.sources[0].url='https://unrelated.org/harbours';assert.equal(evidenceCurrent(c),false);
});
test('legacy chunks without checksums are quarantined until rebuilt or re-read',t=>{
 const s=new VectorStore(':memory:',{dimensions:3,modelId:'synthetic'});t.after(()=>s.close());
 s.put({id:'test',url:'https://www.gov.im/harbours',title:'Manx harbours',kind:'official_document',contentHash:'fixture',fetchedAt:new Date().toISOString()},[{body:'Manx harbour opening hours',tokens:6}],[[1,0,0]]);
 s.db.exec('UPDATE chunks SET body_hash=NULL');assert.equal(s.integrity().unsealed,1);assert.equal(s.search('Manx harbour hours',[1,0,0]).length,0);
});
test('public conversation review excludes unlabelled personal disclosures',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const c=new ConversationStore(kb.db);
 for(const [i,q] of ['Temperatures in the major Manx towns?','I have depression and live in Douglas','My daughter attends a church in Ramsey'].entries()){
  c.start({id:'row'+i,sessionId:'s',question:q,resolution:{route:'answer',jurisdiction:'Isle of Man',canonical:q}});c.finish('row'+i,{answer:'Synthetic response.'});
 }
 const target=conversationReviewTarget(kb,'s');assert.equal(target.included,1);assert.doesNotMatch(kb.getEpisode(target.key).answer,/depression|daughter/);
});
test('a new substantive question clears an earlier review retry target',()=>{
 const reviewed=resolveDialogue('Use MOMM to review the conversation.');
 const fresh=resolveDialogue('What are the temperatures in Douglas?',reviewed.state);
 assert.notEqual(resolveDialogue('Try do it for me',fresh.state).route,'review');
});
test('model research citations cannot promote a finding through repetition',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
 const input={text:'A synthetic model claim about Manx harbour hours.',jurisdiction:'IM',support:3,sources:[{url:'https://www.gov.im/harbours'}],provenance:{expedition:'synthetic'}};
 let c=kb.upsertClaim(input).claim;assert.equal(c.status,'single_source');assert.equal(c.evidenceKind,'research_finding');
 c=kb.upsertClaim({...input,evidenceKey:'another-model-run'}).claim;assert.equal(c.status,'single_source');
});
