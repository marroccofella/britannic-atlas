import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {resolveDialogue} from '../lib/dialogue.mjs';
import {interactionCommand} from '../lib/interaction-policy.mjs';
import {liveRequest,runLiveTools} from '../lib/live-tools.mjs';
import {conversationReviewTarget} from '../lib/conversation-review.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {persistPublicEvidence,evidenceCurrent,sourceExcerptSeal} from '../lib/evidence-ledger.mjs';
import {VectorStore} from '../lib/vector-store.mjs';
import {ManxRetrieval} from '../lib/manx-retrieval.mjs';
import {answer} from '../lib/brain.mjs';
const fixture=t=>{const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());return kb;};
const noModel=()=>{throw Error('No model expected');};
const readFixture=async()=>runLiveTools({question:'Read https://www.gov.im/harbours',allowRecovery:false,get:async url=>({url,headers:{'content-type':'text/html'},body:'<h1>Manx harbour</h1><p>Public harbour opening hours and visitor moorings in the Isle of Man.</p>'})});
test('bare-do-it-starts-unoffered-work',()=>{
 for(const first of ['How many parishes are there?','Use MOMM to review this.']){const r=resolveDialogue('Do it',resolveDialogue(first).state);assert.ok(!['research','review'].includes(r.route),first);}
});
test('mum-possessive-dispatches-review',()=>{
 for(const q of ["Can you do mum's shopping list?","Use mom’s recipe for bonnag"])assert.notEqual(interactionCommand(q)?.kind,'review');
 assert.equal(interactionCommand('Perform a MUM review')?.kind,'review');
});
test('town-weather-historical-and-concept-misroute',()=>{
 for(const q of ['What was the temperature in Douglas during the 2010 TT?','What is the sea temperature at Port Erin?','What is the normal body temperature in Douglas?'])assert.notEqual(liveRequest(q)?.name,'get_town_weather');
});
test('conversation-review-answer-unfiltered',t=>{
 const kb=fixture(t),c=new ConversationStore(kb.db);
 c.start({id:'p',sessionId:'s',question:'Is the Douglas clinic open?',resolution:{route:'answer',jurisdiction:'IM'}});
 c.finish('p',{answer:'Given your depression diagnosis you mentioned, contact your doctor.'});
 assert.ok(!conversationReviewTarget(kb,'s').key);
});
test('runtime-info-false-positive',()=>{
 for(const q of ['Which version of the anthem did my mum sing?','Do not tell me what version of MOMM you use'])assert.notEqual(interactionCommand(q)?.kind,'runtime_info');
 assert.equal(interactionCommand('Ask MOMM itself what version it is')?.kind,'runtime_info');
});
test('dismiss-labels-lastoperation-open-page',()=>{
 assert.equal(resolveDialogue('No thanks').state.lastOperation?.kind,'dismissed');
});
test('inline-sync-failure-breaks-answer: actual index errors are contained',async t=>{
 const kb=fixture(t),store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});
 const retrieval=new ManxRetrieval(kb,null,{store,getEmbedder:async()=>{throw Error('Synthetic unavailable embedder');}});t.after(()=>retrieval.close());
 const now=new Date();const result=await answer({kb,retrieval,sessionId:'synthetic',emit:()=>{},question:'Current temperature in Douglas',runModel:noModel,liveTools:async o=>runLiveTools({...o,get:async url=>({url,headers:{'content-type':'application/json'},body:JSON.stringify({latitude:54.15,longitude:-4.49,current_units:{temperature_2m:'°C',time:'unixtime'},current:{temperature_2m:15,time:Math.floor(now/1000)}})})})});
 assert.match(result.text,/15 degrees/);assert.equal(retrieval.stats().sync.state,'model_unavailable');assert.equal(kb.count(),1);
});
test('excerpt-url-not-content-seal',async t=>{
 const kb=fixture(t),live=await readFixture();live.claims[0].text='This harbour is now permanently closed and abandoned.';
 assert.equal(persistPublicEvidence(kb,live,{question:'Manx harbour hours'}).stored,0);
});
test('source-excerpt-status-unclamped',async t=>{
 const kb=fixture(t),r=persistPublicEvidence(kb,await readFixture(),{question:'Manx harbour hours'});
 kb.db.prepare("UPDATE claims SET status='verified' WHERE id=?").run(r.ids[0]);assert.equal(kb.getClaim(r.ids[0]).status,'single_source');
});
test('official-hits-skip-document-health',async t=>{
 const kb=fixture(t),store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3}),embedder={countTokens:s=>s.split(' ').length,embed:async rows=>rows.map(()=>[1,0,0])};
 const retrieval=new ManxRetrieval(kb,null,{store,getEmbedder:async()=>embedder});t.after(()=>retrieval.close());
 store.put({id:'doc-fixture',kind:'official_document',url:'https://www.gov.im/harbours',title:'Manx harbours',contentHash:'synthetic',fetchedAt:new Date().toISOString()},[{body:'Harbour opening hours and moorings.',tokens:7},{body:'Harbour opening hours and boating.',tokens:7}],[[1,0,0],[1,0,0]]);
 store.db.prepare('DELETE FROM chunk_vectors WHERE chunk_id=?').run(store.db.prepare('SELECT id FROM chunks LIMIT 1').get().id);
 assert.equal((await retrieval.focus('Manx harbour opening hours')).claims.length,0);
});
test('evidence-current-date-and-null-source-safety',async t=>{
 const kb=fixture(t),r=persistPublicEvidence(kb,await readFixture(),{question:'Manx harbour hours'}),c=kb.getClaim(r.ids[0]);
 assert.equal(evidenceCurrent(c,new Date()),true);c.sources=[null];assert.equal(evidenceCurrent(c),false);
});
test('failed-town-source-keeps-its-url',async()=>{
 const r=await runLiveTools({question:'Current temperature in Douglas',allowRecovery:false,get:async()=>{throw Error('Synthetic outage');}});
 assert.match(r.calls[0].url||'',/^https:\/\/api.open-meteo.com\//);
});

test('ordinary public assistant wording remains eligible for conversation review',t=>{
 const kb=fixture(t),c=new ConversationStore(kb.db);c.start({id:'public-wording',sessionId:'s',question:'When does the Douglas library open?',resolution:{route:'answer',jurisdiction:'IM'}});c.finish('public-wording',{answer:"I've checked a public source; we found a published opening time."});assert.ok(conversationReviewTarget(kb,'s').key);
});
test('personal context split across lines remains private',t=>{
 const kb=fixture(t),c=new ConversationStore(kb.db);c.start({id:'private-lines',sessionId:'s',question:'When does the Douglas clinic open?',resolution:{route:'answer',jurisdiction:'IM'}});c.finish('private-lines',{answer:'Your\ndepression diagnosis needs a personal discussion.'});assert.ok(!conversationReviewTarget(kb,'s').key);
});
test('a denied web search does not block a local version answer',()=>assert.equal(interactionCommand("Which version of MOMM is this? Don't search the web.")?.kind,'runtime_info'));
test('malformed source lists cannot produce a source receipt',()=>assert.equal(sourceExcerptSeal({text:'Malformed fixture',sources:{url:'https://www.gov.im/x'}}),null));

test('an explicit retry without an earlier task asks for its subject',()=>{const r=resolveDialogue('Try do it for me');assert.equal(r.route,'clarify');assert.equal(r.jurisdiction,'Isle of Man');});
