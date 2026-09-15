import {test} from "node:test";
import assert from "node:assert/strict";
import {KnowledgeBase} from "../lib/kb.mjs";
import {ConversationStore} from "../lib/conversations.mjs";
import {ResultStore,researchOffer,researchReviewEpisode,publicResearchAccess} from "../lib/results.mjs";
import {buildResearchPreview,isOfficialManxSource,runExpedition,ExpeditionQueue,accessibleResearchSources,boundUnreachableSources} from "../lib/learning.mjs";
import {createDialogueState,resolveDialogue} from "../lib/dialogue.mjs";

const source={url:"https://www.gov.im/categories/weather/climate/",title:"Climate"};
test("completed artifacts survive store reconstruction and remain session isolated",t=>{
 const kb=new KnowledgeBase(":memory:");t.after(()=>kb.close());
 const store=new ResultStore(kb.db),payload={ok:true,answer:"Saved public result"};
 store.put("owner","episode:e_123","original",payload);
 const reopened=new ResultStore(kb.db);
 assert.deepEqual(reopened.get("owner","episode:e_123","original"),payload);
 assert.equal(reopened.get("stranger","episode:e_123"),null);
 assert.equal(reopened.get("owner","episode:e_123","changed"),null);
 assert.throws(()=>store.put("owner","episode:e_123","original",{answer:"x".repeat(160001)}),/too large/);
 assert.deepEqual(reopened.get("owner","episode:e_123"),payload);
});
test("clicked research offer is tied to the selected stored question and owner",t=>{
 const kb=new KnowledgeBase(":memory:");t.after(()=>kb.close());const turns=new ConversationStore(kb.db);
 function add(id,q,meta={}) {
  turns.start({id,sessionId:"owner",clientTurn:1,question:q,resolution:{canonical:q,route:"answer",jurisdiction:"Isle of Man"}});
  turns.finish(id,{answer:"Answer",metadata:{meta:{researchable:true,nextSteps:[{kind:"research",subject:q}],...meta}}});
 }
 add("r_old","What are the Manx flag colours?");add("r_new","Tell me about Douglas Harbour");
 assert.equal(researchOffer(kb.db,"owner","r_old")?.subject,"What are the Manx flag colours?");
 assert.equal(researchOffer(kb.db,"other","r_old"),null);
 add("r_meta","Tell me about this conversation");
 assert.equal(researchOffer(kb.db,"owner","r_meta"),null,"legacy meta offers are not researchable");
});
test("research review keeps limitations and uses only the expedition snapshot",()=>{
 const row={id:"x_123",session_id:"owner",jurisdiction:"IM",status:"partial",question:"Climate",summary:"S".repeat(5000),preview:{unresolved:["UNIQUE_LIMITATION rain days not verified"]},learned:[{text:"Known climate fact. ".repeat(400),status:"single_source",sources:[source]}]};
 const episode=researchReviewEpisode(row,"owner");
 assert.match(episode.answer,/UNIQUE_LIMITATION/);assert.ok(episode.answer.length<=4800);
 assert.deepEqual(episode.sources.map(s=>s.url),[source.url]);
 assert.equal(researchReviewEpisode(row,"stranger"),null);
 assert.equal(researchReviewEpisode({...row,status:"running"},"owner"),null);
 assert.equal(researchReviewEpisode({...row,learned:[{text:"Guess",status:"hypothesis",sources:[source]}]},"owner"),null);
});
test("conversation-memory requests do not become paid research",()=>{
 for(const q of ["Tell me about this conversation","Summarise our chat","What have we discussed?"]) {
  const r=resolveDialogue(q,createDialogueState());assert.equal(r.conversationMeta,true,q);assert.equal(r.route,"answer");
 }
 assert.notEqual(resolveDialogue("Tell me about Manx company law",createDialogueState()).conversationMeta,true);
});
test("primary Manx language institutions are recognised without trusting lookalikes",()=>{
 for(const u of ["https://www.learnmanx.com/resources/translations/","https://culturevannin.im/manx/"])assert.equal(isOfficialManxSource(u),true);
 for(const u of ["https://learnmanx.com.evil.example/x","https://fakeculturevannin.im/x"])assert.equal(isOfficialManxSource(u),false);
});
test("preview cannot repeat categorical absence invented in spoken summary",()=>{
 const p=buildResearchPreview({mode:"official_sources",strategies:["research"],findings:[{claim:"A source gives annual rainfall.",answersQuestion:true,sources:[source]}],unresolved:["Rain days remain unknown"],spoken:"Nobody publishes rain days."});
 assert.match(p.summary,/annual rainfall/);assert.doesNotMatch(p.summary,/Nobody publishes/);
 assert.ok(p.unresolved.some(x=>x.includes("unknown")));
});
test("malformed paid research is a processing failure, not a no-source result",async()=>{
 for(const structured of [null,{findings:{},unresolved:[]},{findings:[null],unresolved:[]},{findings:[{claim:"Unsupported fact"}],unresolved:[]}]) {
  await assert.rejects(runExpedition({kb:{focus:()=>({claims:[]}),updateExpeditionProgress:()=>{}},bus:{publish:()=>{}},root:process.cwd(),id:"x_bad",question:"Manx flag colours",mode:"official_sources",strategies:["research"],runModel:async()=>({costUsd:.4,structured})}),e=>/unreadable|usable evidence/.test(e.message)&&e.costUsd===.4);
 }
});
test("known cost survives a failed research worker",async()=>{
 const finished=[],events=[];const kb={expeditionsSince:()=>0,queueExpedition:()=>"x_cost",beginExpedition:()=>true,updateExpeditionProgress:()=>{},finishExpedition:(id,p)=>finished.push(p)};
 const queue=new ExpeditionQueue({kb,bus:{publish:(type,data)=>events.push({type,data})},root:process.cwd(),runExpeditionFn:async()=>{throw Object.assign(Error("malformed"),{costUsd:.4});}});
 queue.enqueue({question:"Manx climate values",sessionId:"owner",reason:"requested",mode:"official_sources"});
 await queue.whenIdle();queue.stop();
 assert.equal(finished[0].costUsd,.4);
 assert.equal(events.find(e=>e.type==="expedition.failed").data.costUsd,.4);
});
test("a citation to an explicitly unreadable official page cannot satisfy an official check",async()=>{
 const learned=[];
 const kb={focus:()=>({claims:[]}),updateExpeditionProgress:()=>{},finishExpedition:()=>{},resolveGapsFor:()=>{},
 upsertClaim:c=>{learned.push(c);return {created:true,claim:{id:"c_blocked",text:c.text,status:"single_source",sources:c.sources}};}};
 const result=await runExpedition({kb,bus:{publish:()=>{}},root:process.cwd(),id:"x_blocked",question:"Manx language colours",mode:"official_sources",strategies:["research"],runModel:async()=>({costUsd:.1,structured:{findings:[{claim:"Manx colours listed in a search snippet.",confidence:.7,answers_question:true,sources:[source]}],unresolved:["The page could not be opened"],unreachable_sources:[{url:source.url,reason:"403 Forbidden"}],spoken_summary:"Confirmed"}})});
 assert.equal(result.result,"official_source_unreachable");
 assert.equal(learned.length,0,"unreadable source alone must not teach a new proposition");
});
test("historical blocked-access results are relabelled without mutating the saved row",()=>{
 const row={id:"x_old",session_id:"owner",jurisdiction:"IM",mode:"official_sources",status:"done",result:"answered",summary:"Official answer",learned:[{text:"A source claim",answersQuestion:true,status:"single_source",sources:[source.url]}],preview:{unreachable:[{url:source.url+"#fragment",reason:"403"}],unresolved:["Not verified"]}};
 const original=JSON.stringify(row),corrected=publicResearchAccess(row);
 assert.equal(corrected.result,"official_source_unreachable");assert.equal(corrected.status,"empty");
 assert.deepEqual(corrected.learned,[]);assert.equal(JSON.stringify(row),original);
 assert.equal(researchReviewEpisode(row,"owner"),null);
});
test("every reported blocked URL is enforced beyond the eighth displayed page",()=>{
 const blocked=Array.from({length:12},(_,i)=>({url:"https://www.gov.im/p"+i,reason:"403"}));
 assert.deepEqual(accessibleResearchSources([{url:blocked[11].url}],boundUnreachableSources(blocked)),[]);
});
test("distinct query documents remain distinct and duplicate page fragments collapse",()=>{
 const cited=[{url:"https://www.gov.im/doc?id=2"}];
 assert.deepEqual(accessibleResearchSources(cited,[{url:"https://www.gov.im/doc?id=1"}]),cited);
 assert.equal(boundUnreachableSources([{url:source.url+"#one"},{url:source.url+"#two"}]).length,1);
});
test("unrelated blocked pages cannot rewrite a historical answer or invent a warning",()=>{
 const row={status:"done",result:"answered",mode:"official_sources",summary:"Readable answer",learned:[{text:"Fact",status:"single_source",sources:[source.url]}],preview:{unreachable:[{url:"https://www.gov.im/unrelated",reason:"403"}]}};
 assert.equal(publicResearchAccess(row),row);
});
test("correction retains nonofficial refusals and rejects string progress spreading",()=>{
 const row={status:"done",result:"answered",mode:"official_sources",progress:"old-json",learned:[{text:"Fact",answersQuestion:true,status:"single_source",sources:["https://news.example.com/a"]}],preview:{unreachable:[{url:"https://news.example.com/a",reason:"403"},{url:source.url,reason:"403"}]}};
 const corrected=publicResearchAccess(row);
 assert.equal(corrected.preview.unreachable.length,2);
 assert.equal(Object.hasOwn(corrected.progress,"0"),false);
});
