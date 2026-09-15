import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {messageProblem} from "../public/conversation-policy.mjs";
import {createVoiceCapture} from "../public/voice-capture.mjs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const pump = app.slice(app.indexOf("  function pumpSpeech()"), app.indexOf("  function hush("));
const drain = app.slice(app.indexOf("  function onSpeechDrained()"), app.indexOf("  // ---------- state ----------"));
const activity = app.slice(app.indexOf("  function refreshActivityState()"), app.indexOf("  function setState("));
const hush = app.slice(app.indexOf("  function hush("), app.indexOf("  function onSpeechDrained()"));
const pause = app.slice(app.indexOf("  function pauseConversation("), app.indexOf("  async function deliberateAnswer("));
const recognition = app.slice(app.indexOf("  function startListening()"), app.indexOf("  function resumeIfConversation()"));
function fixture() {
  const timers = new Map(); let timerId = 0;
  const context = vm.createContext({
    newRequestId:()=> 'progress-test',activity:{start(){},finish(){}},finishActivity(){},messageProblem,$:()=>({removeAttribute(){}}),
    activeProgress:false, speechBlocked:false, playbackHooks:new Set(), deferredResearchSpeech:new Map(), setLiveStatus:()=>{},
    speechQueue: [{ text: "Hello from Mani" }], speaking: false, playbackActive:false, activeToolControllers:new Set(), activeUtterance: null, activeController: null, speechGeneration: 0, speechStartTimer: null,
    state: "thinking", visualState: "idle", voice: null, rate: { value: 1 }, drainHook: null,
    pendingSearches:new Set(),pendingAsks:new Set(),searchGeneration:0,researchRecords:new Map(),sessionId:"test",typedActivity:{clear(){}},inputSignals:[],
    microphoneMeter:{start(){},stop(){}},document:{hidden:false},
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { cancel() {}, speaking: false, paused: false, speak(u) { this.utterance = u; }, resume() { this.paused = false; }, pause() { this.paused = true; } },
    flushDeferredResearchSpeech: () => false,
    setTimeout: fn => { timers.set(++timerId,fn); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  context.maniVisual = { setState: s => { context.visualState=s; }, speechBoundary: () => {}, beginSpeech:()=>{},clearInput:()=>{},inputPulse:kind=>context.inputSignals.push(kind),inputPause:kind=>context.inputSignals.push(`pause:${kind}`) };
  context.setState = s => { context.state=s; context.maniVisual.setState(s); };
  vm.runInContext(`${pump}\n${drain}\n${activity}\n${pause}`,context);
  return { c:context, timers, flush() { const tasks=[...timers.values()]; timers.clear(); tasks.forEach(fn=>fn()); } };
}

test("resume restores the glow from active playback even when the voice omits onresume", () => {
  const {c} = fixture();
  c.activeUtterance = {}; c.speechSynthesis.speaking = true;
  const entry={playing:true,paused:false,pauseEl:{textContent:""},nowEl:{textContent:""}};
  c.pauseConversation(entry); assert.equal(c.visualState,"paused");
  c.pauseConversation(entry); assert.equal(c.visualState,"speaking");
});

test("a buffering voice cannot illuminate the orb from its busy flag", () => {
  const f=fixture(); f.c.pumpSpeech();
  assert.equal(f.c.visualState,"idle");
  f.c.speechSynthesis.speaking=true; f.flush();
  assert.notEqual(f.c.visualState,"speaking");
  f.c.activeUtterance.onboundary({name:"word",charIndex:0});
  assert.equal(f.c.visualState,"speaking");
});

test("an utterance ending without onstart leaves no stale thinking state or timer", () => {
  const f=fixture(); f.c.pumpSpeech();
  f.c.activeUtterance.onend();
  assert.equal(f.c.speaking,false);
  assert.equal(f.c.state,"idle");
  assert.equal(f.timers.size,0);
});

test("MOMM reproduction: a long gap before the next utterance cannot trigger the old end watchdog",()=>{
  const f=fixture();f.c.pumpSpeech();const first=f.c.activeUtterance;first.onstart();
  f.c.speechQueue.push({text:"Second answer"});first.onend();const second=f.c.activeUtterance;
  f.c.speechSynthesis.speaking=false;for(let i=0;i<5;i++)f.flush();
  assert.equal(f.c.activeUtterance,second);assert.equal(f.c.playbackActive,false);
  first.onend();assert.equal(f.c.activeUtterance,second);
  second.onstart();assert.equal(f.c.playbackActive,true);
});

test("stale playback callbacks and start probes cannot illuminate a newer turn", () => {
  const f=fixture(); f.c.pumpSpeech();
  const old=f.c.activeUtterance;
  f.c.speechGeneration++; f.c.activeUtterance=null; f.c.visualState="listening";
  old.onstart(); old.onboundary(); old.onpause(); old.onresume(); old.onend();
  f.c.speechSynthesis.speaking=true; f.flush();
  assert.equal(f.c.visualState,"listening");
});

test("an answer still streaming between sentences returns to thinking, not idle",()=>{
  const {c}=fixture();c.activeController={};c.pumpSpeech();c.activeUtterance.onstart();
  assert.equal(c.state,'speaking');c.activeUtterance.onend();assert.equal(c.state,'thinking');
  c.activeController=null;c.refreshActivityState();assert.equal(c.state,'idle');
});
test("long-running answer tools rotate Mani until the last operation settles",()=>{
  const {c}=fixture();c.speechQueue=[];c.activeToolControllers.add({});c.refreshActivityState();assert.equal(c.state,'thinking');
  c.activeToolControllers.clear();c.refreshActivityState();assert.equal(c.state,'idle');
});
test('delayed pause and resume callbacks respect the actual browser playback state',()=>{
  const {c}=fixture();c.pumpSpeech();const u=c.activeUtterance;u.onstart();
  c.speechSynthesis.paused=true;u.onpause();assert.equal(c.visualState,'paused');
  c.speechSynthesis.paused=false;c.maniVisual.setState('speaking');u.onpause();assert.equal(c.visualState,'speaking');
  c.speechSynthesis.paused=true;c.maniVisual.setState('paused');u.onresume();assert.equal(c.visualState,'paused');
});
test('a delayed start cannot illuminate a paused utterance',()=>{
  const {c}=fixture();c.pumpSpeech();c.speechSynthesis.paused=true;c.activeUtterance.onstart();assert.notEqual(c.visualState,'speaking');
});
test('stopping review playback retains the thinking indication for a live answer',()=>{
  const {c}=fixture();Object.assign(c,{playbackHooks:new Set(),responseGeneration:0,wantListening:false});
  c.speechSynthesis.cancel=()=>{};c.activeController={};c.state='speaking';
  vm.runInContext(hush,c);c.hush({cancelAnswer:false,preserveListening:true});assert.equal(c.state,'thinking');
});

function recognitionFixture() {
  const {c}=fixture();
  c.speechQueue=[];
  Object.assign(c,{rec:null,restartTimer:null,recognitionCancelled:false,wantListening:false,heard:{},orb:{},setLiveStatus:()=>{},
    conversation:{checked:false}, asks:[], assessSpeech:text=>({original:text}),
    SR:class { start() {} abort() { this.stopped=true; } stop() { if (!this.started) throw new Error("not started yet"); this.stopped=true; } },
  });
  c.ask=(...args)=>c.asks.push(args);
  c.wakeListening={checked:false};c.wakeStatus={};
  c.voiceCapture=createVoiceCapture({Recognition:class{constructor(){return new c.SR();}},platform:c,
    onActive:r=>{c.rec=r;},onState:s=>{c.setState(s);if(s==="idle")c.refreshActivityState();},
    onDraft:({final,interim})=>{c.heard.textContent=[final,interim].filter(Boolean).join(" ");},
    onStatus:t=>{c.heard.textContent=t;},onSubmit:({text})=>c.ask(text),
    onMeter:on=>on?c.microphoneMeter.start():c.microphoneMeter.stop(),
    onInput:kind=>kind==="pause"?c.maniVisual.inputPause("speech"):c.maniVisual.inputPulse("speech")});
  c.state="idle";
  vm.runInContext(recognition,c);
  vm.runInContext(app.slice(app.indexOf("  orb.onclick ="),app.indexOf("  function isEditableTarget")),c);
  return c;
}

test("microphone click shows opening immediately and a second click cancels it", () => {
  const c=recognitionFixture();
  c.orb.onclick(); const old=c.rec;
  assert.equal(c.state,"starting");
  c.orb.onclick();
  assert.equal(c.state,"idle");
  assert.equal(c.rec,null);
  assert.equal(old.stopped,true);
});

test("cancelled microphone startup cannot rotate or submit a late result", () => {
  const c=recognitionFixture();
  c.startListening(); const old=c.rec; c.stopListening();
  old.started=true; old.onstart();
  const result=[{transcript:"a cancelled question",confidence:1}]; result.isFinal=true;
  old.onresult({results:[result]});
  assert.equal(c.state,"idle");
  assert.equal(old.stopped,true);
  assert.equal(c.asks.length,0);
});

test("late microphone events cannot stop a new listening session", () => {
  const c=recognitionFixture();
  c.startListening(); const old=c.rec; c.stopListening(); c.startListening(); const current=c.rec;
  assert.notEqual(old,current);
  current.onstart(); old.onend(); old.onerror({error:"not-allowed"}); old.onstart();
  assert.equal(c.rec,current);
  assert.equal(c.state,"listening");
});

test("recognition startup failure clears the opening state and permits retry", () => {
  const c=recognitionFixture();
  c.SR=class { start() { throw new Error("unavailable"); } };
  c.startListening();
  assert.equal(c.state,"idle"); assert.equal(c.rec,null);
  assert.match(c.heard.textContent,/could not|couldn.t/i);
});

test("recognition ending before start retries without stranding opening", () => {
  const c=recognitionFixture(); c.startListening(); c.rec.onend();
  assert.equal(c.state,"listening");
  assert.doesNotMatch(c.heard.textContent,/opening/i);
});

test("releasing push-to-talk still accepts the final transcript from that session", () => {
  const c=recognitionFixture(); c.startListening(); const active=c.rec; active.started=true; active.onstart();
  c.stopListening({awaitFinal:true});
  const result=[{transcript:"What is the Manx flag?",confidence:1}]; result.isFinal=true;
  active.onresult({results:[result]});
  assert.equal(c.asks.length,1); assert.equal(c.asks[0][0],"What is the Manx flag?");
});

test("cancellation still fences a delayed start when another UI state replaced opening", () => {
  const c=recognitionFixture(); c.startListening(); const old=c.rec;
  c.state="speaking"; c.stopListening(); c.state="idle";
  old.started=true; old.onstart();
  assert.equal(c.state,"idle"); assert.equal(old.stopped,true);
});

test("speech input and pause drive feedback, and finalization stays active",()=>{
  const c=recognitionFixture();c.startListening();const r=c.rec;r.started=true;r.onstart();r.onspeechstart();
  assert.equal(c.inputSignals[0],"speech");r.onspeechend();assert.equal(c.state,"listening");
  assert.ok(c.inputSignals.includes("pause:speech"));r.onspeechstart();assert.equal(c.state,"listening");
  c.stopListening({awaitFinal:true});assert.equal(c.state,"finishing");r.onend();assert.equal(c.state,"idle");
});
test("a final transcript is accepted once and old input cannot interrupt the answer",()=>{
  const c=recognitionFixture();c.startListening();const r=c.rec;r.started=true;r.onstart();
  const result=[{transcript:"Manx flag",confidence:1}];result.isFinal=true;
  r.onresult({results:[result]});assert.equal(c.asks.length,0);c.stopListening({awaitFinal:true});r.onend();c.state="thinking";c.activeController={};
  r.onresult({results:[result]});r.onresult({results:[[{transcript:"stale"}]]});r.onspeechend();r.onerror({error:"not-allowed"});
  assert.equal(c.asks.length,1);assert.equal(c.state,"thinking");
});
test("explicit cancellation discards a delayed final transcript",()=>{
  const c=recognitionFixture();c.startListening();const r=c.rec;r.started=true;r.onstart();c.stopListening({awaitFinal:true});
  c.stopListening({discard:true});const result=[{transcript:"cancelled",confidence:1}];result.isFinal=true;
  r.onresult({results:[result]});assert.equal(c.asks.length,0);assert.equal(c.state,"idle");
});
test("only research belonging to this conversation keeps thinking active",()=>{
  const {c}=fixture();c.speechQueue=[];c.researchRecords.set("a",{sessionId:"other",status:"running"});c.refreshActivityState();assert.equal(c.state,"idle");
  c.researchRecords.set("b",{sessionId:"test",status:"running"});c.refreshActivityState();assert.equal(c.state,"thinking");
  c.researchRecords.get("b").status="done";c.refreshActivityState();assert.equal(c.state,"idle");
});

test("microphone exit paths return to ongoing research instead of looking idle",()=>{
  for(const exit of ["end","error","cancel-opening","cancel-finalizing","start-failure"]) {
    const c=recognitionFixture();c.researchRecords.set("job",{sessionId:"test",status:"running"});
    if(exit==="start-failure") c.SR=class {start(){throw new Error("unavailable");}};
    c.startListening();const r=c.rec;
    if(exit==="cancel-opening") c.stopListening({discard:true});
    else if(exit!=="start-failure") {
      r.started=true;r.onstart();
      if(exit==="end") r.onend();
      if(exit==="error") r.onerror({error:"no-speech"});
      if(exit==="cancel-finalizing") {c.stopListening({awaitFinal:true});c.stopListening({discard:true});}
    }
    assert.equal(c.state,["end","error"].includes(exit)?"listening":"thinking",exit);
  }
});
test("waiting for history shows work immediately and Stop fences the pending question",async()=>{
  const {c}=fixture();let resolve;c.historyReady=new Promise(r=>{resolve=r;});c.speechQueue=[];
  c.stopListening=()=>{};c.setLiveStatus=()=>{};
  const start=app.indexOf("  async function ask(question,");
  const end=app.indexOf("    const questionKey =",start);
  vm.runInContext(app.slice(start,end)+' return "ready"; }',c);
  const answer=c.ask("test");assert.equal(c.state,"thinking");assert.equal(c.pendingAsks.size,1);
  c.pendingAsks.clear();resolve();assert.equal(await answer,undefined);assert.equal(c.state,"idle");
});

test("voice startup timeout settles state and makes failure visible",()=>{
  const f=fixture();const messages=[];f.c.setLiveStatus=t=>messages.push(t);
  f.c.pumpSpeech();for(let i=0;i<61;i++)f.flush();
  assert.equal(f.c.activeUtterance,null);assert.equal(f.c.speaking,false);
  assert.equal(f.c.speechBlocked,true);assert.equal(f.timers.size,0);
  assert.match(messages.at(-1),/Voice playback failed/);
});
test("synchronous voice-service failure does not strand the queue",()=>{
  const f=fixture();f.c.speechSynthesis.speak=()=>{throw Error("no voice");};
  f.c.pumpSpeech();assert.equal(f.c.speaking,false);assert.equal(f.c.speechBlocked,true);
  assert.equal(f.c.state,"idle");assert.equal(f.timers.size,0);
});
test("missing native end event is recovered only after playback has stopped",()=>{
  const f=fixture();f.c.pumpSpeech();f.c.activeUtterance.onstart();
  f.c.speechSynthesis.speaking=true;f.flush();assert.equal(f.c.speaking,true);
  f.c.speechSynthesis.speaking=false;for(let i=0;i<3;i++)f.flush();
  assert.equal(f.c.state,"idle");assert.equal(f.c.activeUtterance,null);
});
test("manual replay preserves pending research while explicit Stop clears it",()=>{
  const {c}=fixture();Object.assign(c,{responseGeneration:0,wantListening:false,stopListening:()=>{}});
  c.deferredResearchSpeech.set("research1",{text:"Result"});vm.runInContext(hush,c);
  c.hush({cancelAnswer:false});assert.equal(c.deferredResearchSpeech.size,1);
  c.hush();assert.equal(c.deferredResearchSpeech.size,0);
});
test("keep-listening callbacks cannot reopen recognition in a hidden tab",()=>{
 const c=recognitionFixture();c.document.hidden=true;c.wantListening=true;c.conversation.checked=true;
 c.startListening();assert.equal(c.rec,null);assert.equal(c.state,"idle");
});
test("interrupt from wake mode promotes capture, not merely its visual label",()=>{
 const c=recognitionFixture();vm.runInContext(app.slice(app.indexOf("  function bargeIn()"),app.indexOf("  orb.onclick =")),c);
 c.hush=()=>{};c.voiceCapture.start("wake");c.rec.onstart();c.activeToolControllers.add({});
 c.orb.onclick();assert.equal(c.voiceCapture.mode,"capture");c.rec.onstart();
 assert.equal(c.state,"listening");
});

test('MOMM: progress speech stops before microphone capture without aborting the answer',()=>{const c=recognitionFixture();const order=[];c.activeProgress=true;c.speaking=true;c.hush=options=>{assert.equal(options.cancelAnswer,false);assert.equal(options.preserveListening,true);order.push('silence');c.activeProgress=false;};c.voiceCapture={mode:'off',start:()=>order.push('capture')};c.startListening();assert.deepEqual(order,['silence','capture']);});
