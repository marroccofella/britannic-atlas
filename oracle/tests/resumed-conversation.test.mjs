import test from 'node:test';import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {DialogueSessions,resolveDialogue} from '../lib/dialogue.mjs';
import {conversationRepairQuestion} from '../public/conversation-policy.mjs';
import {sourceRelevant,historySourceAnswer,navigationOnly} from '../lib/source-passages.mjs';
import {liveRequest,runLiveTools} from '../lib/live-tools.mjs';
import {persistPublicEvidence,sourceExcerptSeal} from '../lib/evidence-ledger.mjs';
import {answer} from '../lib/brain.mjs';
const topic='Check the evidence for Isle of Man post-glacial land separation from Britain and Ireland, and the official record of ancient monuments.';
const performance="I want to see how good you've become since the last time we spoke.";
function fixture(t){const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());return {kb,store:new ConversationStore(kb.db)};}
function completed(d,q,id){const r=d.resolve('s',q,{turnId:id,clientTurn:1});d.markInFlight('s',r);d.complete('s',r.semanticKey,{pendingAction:{kind:'research',subject:r.canonical,jurisdiction:'Isle of Man',researchMode:'live_sources'}});return r;}
test('performance comparisons preserve the factual task and are never public searches',()=>{
 const d=new DialogueSessions();completed(d,topic,'topic');const before=d.get('s').pendingAction;
 for(const q of [performance,'Have you improved since we last spoke?','Are you any better now?']){const r=d.preview('s',q);assert.equal(r.conversationMeta,true,q);assert.deepEqual(r.state.pendingAction,before);assert.equal(r.preservePendingAction,true);assert.equal(liveRequest(q,{forceSearch:true}),null);}
 assert.equal(conversationRepairQuestion('Have the roads improved since last year?'),false);
 assert.notEqual(resolveDialogue(performance+' What is the current population?').conversationMeta,true);
});
test('a saved legacy performance target recovers the last factual source offer before do it',t=>{
 const {store}=fixture(t),d=new DialogueSessions({storage:store});const r=completed(d,topic,'topic');
 store.start({id:'topic',sessionId:'s',question:topic,resolution:r});store.finish('topic',{answer:'Synthetic source-check offer.',metadata:{meta:{researchOffered:true,nextSteps:[{kind:'research',subject:r.canonical,researchMode:'live_sources'}]}}});
 const bad=resolveDialogue('Explain synthetic Manx accounting');const poisoned={...bad.state,lastSubstantiveQuestion:performance,lastAnswerSubject:performance,pendingAction:{kind:'research',subject:performance,status:'offered',researchMode:'live_sources'}};
 store.start({id:'bad',sessionId:'s',question:performance,resolution:{...bad,canonical:performance}});store.finish('bad',{answer:'Synthetic evaluation response.',metadata:{meta:{researchOffered:true}}});store.saveState('s',poisoned);
 const resumed=new DialogueSessions({storage:store}),next=resumed.preview('s','Do it.');assert.equal(next.route,'research');assert.match(next.canonical,/post.glacial/);assert.match(next.canonical,/ancient monuments/);
 const request=liveRequest(next.canonical);assert.equal(request.name,'read_sources');assert.ok(request.urls.some(u=>u.includes('livrepository')));assert.ok(request.urls.some(u=>u.includes('isleofmanher')));
 assert.equal(resumed.get('s').contextRecovery.reason,'legacy_conversation_diagnostic');
});
test('legacy recovery does not restore a cancelled offer or replace a new factual subject',t=>{
 const {store}=fixture(t),d=new DialogueSessions({storage:store});const r=completed(d,topic,'topic');store.start({id:'topic',sessionId:'s',question:topic,resolution:r});store.finish('topic',{metadata:{meta:{researchOffered:true}}});
 store.saveState('s',{...d.get('s'),lastSubstantiveQuestion:performance,pendingAction:null});assert.equal(new DialogueSessions({storage:store}).get('s').pendingAction,null);
 completed(d,'Explain the history of England','foreign');assert.deepEqual(new DialogueSessions({storage:store}).get('s'),d.get('s')); 
});
test('self assessment uses recorded capability facts without a new model or source call',async t=>{
 const {kb,store}=fixture(t),d=new DialogueSessions({storage:store});completed(d,topic,'topic');const resolution=d.preview('s',performance),events=[];
 await answer({kb,question:performance,resolution,sessionId:'s',conversations:store,emit:(name,data)=>events.push({name,data}),liveTools:()=>assert.fail('No factual lookup'),runModel:()=>assert.fail('No invented performance history')});
 const result=events.find(e=>e.name==='meta').data;assert.equal(result.conversationMeta,true);assert.equal(result.costUsd,0);assert.equal(result.researchable,false);assert.match(events.filter(e=>e.name==='token').map(e=>e.data.text).join(''),/saved conversation/i);
});
test('generic Island words do not make wage or bills pages relevant to archaeology',()=>{
 assert.equal(sourceRelevant(topic,'Tynwald approved a new minimum wage for people on the Isle of Man. The government gives supporting information.'),false);
 assert.equal(sourceRelevant(topic,'History Tynwald Timeline 1417. Bills before the House. Register for updates. Isle of Man information.'),false);
 assert.equal(sourceRelevant(topic,'Post-glacial sea levels flooded the land bridge to Cumbria; the exact severance age remains uncertain.'),true);
 assert.equal(sourceRelevant(topic,'The Historic Environment Record contains archaeological sites and ancient monuments.'),true);
});
test('unrelated discovered pages produce no answer evidence or saved knowledge',async t=>{
 const {kb}=fixture(t);const live=await runLiveTools({question:topic,request:{name:'search_web'},allowRecovery:false,runModel:async()=>({structured:{urls:['https://www.gov.im/wage-update']},costUsd:0}),get:async url=>({url,headers:{'content-type':'text/html'},body:'<main><p>Tynwald approved a new minimum wage for people on the Isle of Man. This is government supporting information.</p></main>'})});
 assert.equal(live.claims.length,0);assert.equal(persistPublicEvidence(kb,live,{question:topic}).stored,0);assert.ok(live.calls.some(c=>c.code==='readable_unrelated'));
});
test('explicitly selected public pages remain readable even outside the previous subject',async()=>{
 const url='https://www.gov.im/wage-update';const live=await runLiveTools({question:'Read '+url,allowRecovery:false,get:async()=>({url,headers:{'content-type':'text/html'},body:'<main><p>Tynwald approved a new minimum wage for workers on the Isle of Man.</p></main>'})});assert.equal(live.claims.length,1);
});
test('contents pointers are not stored as factual passages',t=>{
 const {kb}=fixture(t),url='https://manxnationalheritage.im/report.pdf',claim={evidenceKind:'source_excerpt',text:'Contents. Ancient monuments ................................ 25. List of illustrations ......................... 30.',sources:[{url}],fetchedAt:new Date().toISOString()};
 const receipt=persistPublicEvidence(kb,{claims:[claim],calls:[{name:'read_page',status:'complete',url,evidenceSeals:[sourceExcerptSeal(claim)]}]},{question:topic});assert.equal(receipt.stored,0);assert.equal(receipt.reasons.navigation_only,1);
});

test('a complaint with a restated factual question retains tools and factual answering',async t=>{
 const q="You're making me repeat myself: what is the forecast for Ramsey?";
 assert.equal(conversationRepairQuestion('You keep asking me again; what is the population of Douglas?'),false);
 assert.equal(conversationRepairQuestion(q),false);assert.ok(liveRequest(q));
 const {kb}=fixture(t),resolution=resolveDialogue(q);assert.notEqual(resolution.conversationMeta,true);let called=false,looked=false;
 await answer({kb,question:q,resolution,sessionId:"synthetic-complaint",emit:()=>{},liveTools:async()=>{looked=true;return {claims:[{id:'c_synthetic',text:'Synthetic Ramsey forecast evidence.',status:'single_source',trust:.6,evidenceKind:'source_excerpt',sources:[{url:'https://www.gov.im/weather'}]}],calls:[],costUsd:0};},runModel:async({onDelta})=>{called=true;onDelta('A synthetic forecast response.');return {costUsd:0};}});assert.equal(called,true);assert.equal(looked,true);
});
function legacy(t,{done=false,extra={}}={}){
 const {store}=fixture(t),d=new DialogueSessions({storage:store});const r=completed(d,topic,'first');
 store.start({id:'first',sessionId:'s',question:topic,resolution:r});store.finish('first',{metadata:{meta:{researchOffered:true}}});
 if(done){store.start({id:'done',sessionId:'s',question:'Do it.',resolution:{...r,route:'research'}});store.finish('done',{answer:'The source check completed.',metadata:{meta:{tools:[{name:'read_page',status:'complete'}]}}});}
 store.saveState('s',{...d.get('s'),...extra,lastSubstantiveQuestion:performance,pendingAction:{kind:'research',subject:performance,status:'offered'}});return store;
}
test('legacy replay consumes research that actually completed',t=>{const store=legacy(t,{done:true});assert.equal(store.loadState('s').pendingAction,null);});
test('legacy subject recovery retains unrelated saved answer and UI context',t=>{const store=legacy(t,{extra:{researchFocusId:'exp_saved',conversationTopic:'saved-topic',customContext:{value:'retained'}}});const s=store.loadState('s');assert.equal(s.researchFocusId,'exp_saved');assert.equal(s.conversationTopic,'saved-topic');assert.deepEqual(s.customContext,{value:'retained'});assert.match(s.pendingAction.subject,/ancient monuments/);});
test('legacy recovery is persisted once for the next load',t=>{const store=legacy(t);const first=store.loadState('s');assert.deepEqual(store.get('s').dialogue,first);assert.deepEqual(store.loadState('s'),first);});
test('public relevance fails closed without useful terms and admits explicitly named sites',()=>{assert.equal(sourceRelevant('Isle of Man government information request','Ferry timetable changes this week.'),false);assert.equal(sourceRelevant('Which ancient monuments include Cashtal yn Ard?','Cashtal yn Ard has chambered tombs and a forecourt.'),true);});
test('performance speech separates an unpunctuated saved subject',async t=>{const {kb}=fixture(t),events=[];await answer({kb,question:performance,resolution:{...resolveDialogue(performance),state:{pendingAction:{subject:'Isle of Man ancient monuments'}}},emit:(name,data)=>events.push({name,data})});assert.match(events.filter(e=>e.name==='token').map(e=>e.data.text).join(''),/monuments[.!?] I will use/);});
test('curly apostrophes preserve the bounded historical answer',()=>{
 const claims=[{id:'c_mnh',evidenceKind:'source_excerpt',text:'8000 BC - 4000 BC',sources:[{url:'https://manxnationalheritage.im/wp-content/uploads/2020/05/MOTM-EarlyPeople-AMesolithic.pdf#page=1'}]},{id:'c_report',evidenceKind:'source_excerpt',text:'Cass ny Hawin II is the earliest known house on Man, later ninth millennium cal. BC',sources:[{url:'https://www.archaeopress.com/Archaeopress/DMS/9A26816D482B4A05BD823311F1F20BA7/9781805832553-sample.pdf#page=15'}]}];
 const q='Let’s talk about the earliest evidence of human settlement on the Isle of Man.';assert.ok(historySourceAnswer(q,claims));
});

test('bibliographies and contents without dot leaders cannot become factual source passages',t=>{
 const bibliography='12. Researcher, A. Post-glacial land bridge. Quaternary 2023, 6, 3–10. [CrossRef] 13. Researcher, B. The ancient monuments. Archaeology 2022, 5, 20–35. [CrossRef] 14. Researcher, C. Cumbria sea level. Geology 2021, 7, 11–25. [CrossRef]';
 const contents='POLICY & PROCEDURE MANX MUSEUM AND NATIONAL TRUST Isle of Man Historic Environment Record (IOMHER) Access and Charging Policy & Procedure Contents Page 1. Content 3 2. Conditions of Use 4 4. Charges 7';
 const {kb}=fixture(t);for(const text of [bibliography,contents]){assert.equal(navigationOnly(text),true);const claim={evidenceKind:'source_excerpt',text,sources:[{url:'https://manxnationalheritage.im/report.pdf'}],fetchedAt:new Date().toISOString()};const receipt=persistPublicEvidence(kb,{claims:[claim],calls:[{name:'read_page',status:'complete',url:claim.sources[0].url,evidenceSeals:[sourceExcerptSeal(claim)]}]},{question:topic});assert.equal(receipt.stored,0);}
 assert.equal(navigationOnly('The Historic Environment Record records known archaeological sites. The absence of an entry does not mean an absence of archaeology.'),false);
});
