import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import { MAX_MESSAGE_CHARS, messageProblem, localConversation, unfinishedRequest } from "../public/conversation-policy.mjs";
import { createDialogueState, DialogueSessions, resolveDialogue } from "../lib/dialogue.mjs";
import { answer, isResearchable, ORACLE_SYSTEM } from "../lib/brain.mjs";
import { entailmentCheck } from "../lib/entailment.mjs";
import { readJson } from "../lib/http.mjs";

for (const question of ["What is MOMM?", "Tell me about yourself.", "How can I trust you explain in detail", "Can you hear me?", "Hey, Maddie, are you there?", "Hello", "Thank you"]) {
  test("local conversation: " + question, async () => {
    const resolution=resolveDialogue(question,createDialogueState());
    assert.equal(resolution.route,"conversation");
    assert.equal(resolution.conversationMeta,true);
    const events=[];
    const forbidden=()=>{throw new Error("ordinary conversation must not use a model or retrieval");};
    const result=await answer({kb:null,retrieval:{focus:forbidden},question,resolution,emit:(event,data)=>events.push({event,data}),runModel:forbidden});
    assert.equal(result.local,true);
    const meta=events.find(e=>e.event==="meta").data;
    assert.equal(meta.costUsd,0);
    assert.equal(meta.reviewable,false);
    assert.equal(meta.researchable,false);
    assert.deepEqual(meta.nextSteps,[]);
    assert.ok(events.find(e=>e.event==="token").data.text.length < 400);
    assert.equal(isResearchable(question,{explicit:true}),false);
  });
}
test("input channel is acknowledged without invented hearing",()=>{
  assert.match(localConversation("Can you hear me?",{source:"typed"}).text,/read your message/);
  assert.match(localConversation("Can you hear me?",{source:"speech"}).text,/received what you said/);
  assert.equal(localConversation("Can you hear my recording and transcribe it?"),null);
});
test("MOMM example survives stored state and clears an unrelated source offer",()=>{
  let saved;
  const storage={loadState:()=>saved&&JSON.parse(saved),saveState:(_id,state)=>{saved=JSON.stringify(state);}};
  const sessions=new DialogueSessions({storage});
  sessions.set("s",{...createDialogueState(),lastSubstantiveQuestion:"How is the king?",pendingAction:{kind:"research",subject:"king"},pendingQuestion:"Which king?"});
  const first=sessions.resolve("s","What is MOMM?");
  assert.equal(first.state.pendingAction,null);
  assert.equal(first.state.pendingQuestion,null);
  const restored=new DialogueSessions({storage});
  const next=restored.resolve("s","Give me an example.");
  assert.equal(next.route,"conversation");
  assert.match(next.speech,/reviewers|MOMM/i);
  assert.doesNotMatch(next.speech,/\bking\b/i);
  assert.notEqual(restored.preview("s","Yes, check official Manx sources").route,"research");
});
test("unfinished king input cannot repeat the earlier health question",()=>{
  const state={...createDialogueState(),lastSubstantiveQuestion:"Answer this specifically for the Isle of Man: How is the king?"};
  const result=resolveDialogue("Is the king.",state);
  assert.equal(result.route,"clarify");
  assert.equal(result.canonical,null);
  assert.equal(result.speech,"Could you finish that question?");
  assert.equal(isResearchable("Is the king.",{explicit:true}),false);
  const next=resolveDialogue("What is the current population?",result.state);
  assert.equal(next.route,"answer");
  assert.doesNotMatch(next.canonical,/king/);
  assert.equal(next.intent,"live");
});
test("fragments ask once without speculative tax content; complete questions still work",()=>{
  const stale={...createDialogueState(),pendingQuestion:"Which tax do you mean?",pendingQuestionSubject:"UK property tax"};
  const fresh=resolveDialogue("What is the current population?",stale);
  assert.equal(fresh.state.pendingQuestion,null);
  assert.equal(fresh.state.pendingQuestionSubject,null);
  const followup=resolveDialogue("Northern Ireland",stale);
  assert.match(followup.canonical,/Which tax do you mean/);
  for(const q of ["What about?", "Who is the?", "I was asking if.", "What do we need to do to get the?"]){
    const result=resolveDialogue(q,createDialogueState());
    assert.equal(result.route,"clarify");
    assert.ok(result.speech.length<90);
    assert.doesNotMatch(result.speech,/tax|2017|2019|likely/i);
  }
  assert.equal(unfinishedRequest("Is the king alive?"),false);
  assert.equal(unfinishedRequest("What is the capital?"),false);
  assert.equal(resolveDialogue("What tax applies to UK property?",createDialogueState()).intent,"high_stakes");
});
test("bounded obvious typo repair does not guess at ordinary nouns",()=>{
  const news=resolveDialogue("what is todats news",createDialogueState());
  assert.match(news.canonical,/today's news/i);
  assert.equal(resolveDialogue("Tell me about Nissan cars",createDialogueState()).raw,"Tell me about Nissan cars");
  assert.equal(resolveDialogue("nlw do you know thes things and what are you",createDialogueState()).route,"conversation");
});
test("conversation recaps do not offer external research",()=>{
  const result=resolveDialogue("Tell me about this conversation.",createDialogueState());
  assert.equal(result.conversationMeta,true);
  assert.equal(isResearchable("Tell me about this conversation.",{explicit:true}),false);
  assert.match(ORACLE_SYSTEM,/one to three useful sentences/);
  assert.match(ORACLE_SYSTEM,/do not fill that gap with guessed rates/);
  assert.doesNotMatch(ORACLE_SYSTEM,/When it is false, say briefly that you did not catch a question/);
});
test("discourse words and Manx Island shorthand do not generate false source warnings",()=>{
  const claims=[{text:"Douglas is the capital of the Isle of Man.",topic:"geography"}];
  const result=entailmentCheck({answer:"Aye, Douglas is the capital of the Island.",claims});
  assert.deepEqual(result.unsupported,[]);
  assert.ok(entailmentCheck({answer:"Ramsey is the capital of the Island.",claims}).unsupported.includes("Ramsey"));
  assert.ok(entailmentCheck({answer:"The Island has 12345 residents.",claims:[{text:"Jersey has 12345 residents."}]}).unsupported.includes("Island"));
});
test("long messages are rejected explicitly, not silently truncated",()=>{
  assert.equal(messageProblem("a".repeat(MAX_MESSAGE_CHARS)),"");
  assert.match(messageProblem("a".repeat(MAX_MESSAGE_CHARS+1)),/12,001 \/ 12,000/);
  assert.match(messageProblem("a".repeat(MAX_MESSAGE_CHARS+1)),/has not been sent/);
});
test("body decoding preserves characters split between network chunks",async()=>{
  const req=new EventEmitter();req.headers={};
  const result=readJson(req);
  const bytes=Buffer.from(JSON.stringify({question:"Gaelg — gorrym"}));
  for(const byte of bytes)req.emit("data",Buffer.from([byte]));
  req.emit("end");
  assert.deepEqual(await result,{question:"Gaelg — gorrym"});
});
test("oversized HTTP bodies return readable 413 JSON without resetting the socket",async()=>{
  const server=http.createServer(async(req,res)=>{
    try { const body=await readJson(req,100);res.setHeader("Content-Type","application/json");res.end(JSON.stringify(body)); }
    catch(error){res.writeHead(error.status,{"Content-Type":"application/json","Connection":"close"});res.end(JSON.stringify({error:error.message}));}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url="http://127.0.0.1:"+server.address().port;
  try {
    for(const body of [JSON.stringify({question:"x".repeat(1000)}),"null"]){
      const response=await fetch(url,{method:"POST",body});
      assert.equal(response.status,body==="null"?400:413);
      assert.ok((await response.json()).error);
    }
    const response=await fetch(url,{method:"POST",body:'{"question":"Hello"}'});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{question:"Hello"});
  }finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
