import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const app=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const part=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const cleanText=(text,max)=>String(text||"").slice(0,max);
test("research speech waits for busy tools but never expires or duplicates a delivered result",()=>{
 const calls=[],c=vm.createContext({speakLearned:{checked:true},speechBlocked:false,rec:null,speaking:false,activeController:null,activeToolControllers:new Set([{}]),pendingAsks:new Set(),state:"thinking",speechQueue:[],deferredResearchSpeech:new Map(),announcedResearchSpeech:new Set(),MAX_DEFERRED_RESEARCH_SPEECH:50,cleanText,setLiveStatus:()=>{},say:(text,opts)=>calls.push({text,opts})});
 vm.runInContext(part("  function canSpeakBackgroundUpdate()","  speakLearned.onchange"),c);
 c.deferResearchSpeech("x","Ready");assert.equal(calls.length,0);
 c.activeToolControllers.clear();assert.equal(c.flushDeferredResearchSpeech(),true);
 assert.equal(calls[0].text,"Ready");assert.equal(c.announcedResearchSpeech.size,0);
 calls[0].opts.onend();c.deferResearchSpeech("x","Duplicate");assert.equal(calls.length,1);
});
test("review text is available in a hidden tab without waiting for animation frames",async()=>{
 const c=vm.createContext({cleanText,requestAnimationFrame:()=>{throw Error("must not wait for a frame");}});
 vm.runInContext(part("  function revealText(","  async function revealConversation"),c);
 const el={textContent:"",classList:{remove:()=>{}}};await c.revealText(el,"A considered answer");
 assert.equal(el.textContent,"A considered answer");
});
function canvasFixture(result,drawn) {
 const messages=[],panel={isConnected:true,replaceChildren(){},classList:{remove(){}}};
 const turn={isConnected:true,querySelector:()=>panel,setAttribute(){}};
 const c=vm.createContext({activity:{start(){}},finishActivity(){},sessionId:"test",responseGeneration:1,AbortController,renderedActions:new Map(),activeToolControllers:new Set(),cleanText,actionIdentity:a=>a.actionId,newRequestId:()=>"r_test",postJson:async()=>{c.requests++;return result;},requests:0,renderCanvasWorkspace:()=>drawn,renderReviewSummary(){},appendTextElement(){},showAnswerToolError(){},refreshActivityState:()=>messages.push("Ready"),setLiveStatus:m=>messages.push(m),say:m=>messages.push("SPOKEN:"+m),flushDeferredResearchSpeech:()=>{c.flushes++;},flushes:0});
 vm.runInContext(part("  async function generateCanvasFromAction(","  async function ask("),c);
 return {c,turn,messages};
}
test("canvas fallback is not announced as a successfully drawn visual",async()=>{
 const f=canvasFixture({ok:true,spec:{}},false);
 await f.c.generateCanvasFromAction(f.turn,"visual_123",1);
 assert.match(f.messages.at(-1),/could not be drawn/);
 assert.equal(f.c.renderedActions.size,0);assert.equal(f.c.flushes,1);
});
test("rejected canvas remains retryable and failure is not overwritten by idle cleanup",async()=>{
 const f=canvasFixture({ok:false,reason:"Unsupported"},false);
 await f.c.generateCanvasFromAction(f.turn,"visual_123",1);
 assert.match(f.messages.at(-1),/could not be safely completed/);
 await f.c.generateCanvasFromAction(f.turn,"visual_123",1);
 assert.equal(f.c.requests,2);
});
test("completed canvas announces its actual visual and alternative",async()=>{
 const f=canvasFixture({ok:true,spec:{}},true);
 await f.c.generateCanvasFromAction(f.turn,"visual_123",1);
 assert.equal(f.messages.at(-1),"Visual and text alternative ready.");
});
test("late canvas response after cancellation cannot draw or speak",async()=>{
 const f=canvasFixture({ok:true,spec:{}},true);let resolve;
 f.c.postJson=()=>new Promise(r=>{resolve=r;});const promise=f.c.generateCanvasFromAction(f.turn,"visual_123",1);
 [...f.c.activeToolControllers][0].abort();resolve({ok:true,spec:{}});await promise;
 assert.equal(f.c.renderedActions.size,0);assert.equal(f.messages.some(s=>s.startsWith("SPOKEN:")),false);
});
test("clipped review prose visibly marks omission instead of silently joining broken words",()=>{
 const c=vm.createContext({});vm.runInContext(part("  function cleanText(","  function appendTextElement"),c);
 const text=c.cleanText("A long review explanation that must be clipped",22);
 assert.ok(text.length<=22);assert.match(text,/…$/);
});
test("diagram boxes retain long labels instead of silently cutting them at 24 characters",()=>{
 const writes=[],context={measureText:t=>({width:t.length*6}),beginPath(){},moveTo(){},lineTo(){},stroke(){},rect(){},fill(){},fillText:t=>writes.push(t)};
 const c=vm.createContext({CANVAS_COLORS:{grey:"#666"}});vm.runInContext(part("  function positionedCanvasNodes(","  function renderCanvasTable("),c);
 c.drawCanvasDiagram(context,{width:960,height:700,nodes:[{id:"one",label:"Companies ownership and registries module",color:"grey"}],edges:[]});
 assert.match(writes.join(" "),/Companies ownership and registries module/);
});
test("dense diagrams fall back instead of painting overlapping clipped boxes",()=>{
 const rects=[],context={measureText:t=>({width:t.length*6}),beginPath(){},moveTo(){},lineTo(){},stroke(){},rect:(...a)=>rects.push(a),fill(){},fillText(){}};
 const c=vm.createContext({CANVAS_COLORS:{grey:"#666"}});vm.runInContext(part("  function positionedCanvasNodes(","  function renderCanvasTable("),c);
 const nodes=Array.from({length:12},(_,i)=>({id:"n"+i,label:"Long label ".repeat(9),color:"grey"}));
 assert.equal(c.drawCanvasDiagram(context,{width:320,height:580,nodes,edges:[]}),false);
 assert.equal(rects.length,0);
});
test("enlarged labels at explicit edge positions are kept inside the validated canvas",()=>{
 const rects=[],context={measureText:t=>({width:t.length*6}),beginPath(){},moveTo(){},lineTo(){},stroke(){},rect:(...a)=>rects.push(a),fill(){},fillText(){}};
 const c=vm.createContext({CANVAS_COLORS:{grey:"#666"}});vm.runInContext(part("  function positionedCanvasNodes(","  function renderCanvasTable("),c);
 c.drawCanvasDiagram(context,{width:960,height:240,nodes:[{id:"n",x:480,y:215,label:"Long label ".repeat(9),color:"grey"}],edges:[]});
 assert.equal(rects.length,1);for(const [x,y,w,h] of rects)assert.ok(x>=0&&y>=0&&x+w<=960&&y+h<=240);
});
test("three long nodes in a short canvas use the safe alternative when rows cannot fit",()=>{
 const rects=[],context={measureText:t=>({width:t.length*6}),beginPath(){},moveTo(){},lineTo(){},stroke(){},rect:(...a)=>rects.push(a),fill(){},fillText(){}};
 const c=vm.createContext({CANVAS_COLORS:{grey:"#666"}});vm.runInContext(part("  function positionedCanvasNodes(","  function renderCanvasTable("),c);
 const nodes=Array.from({length:3},(_,i)=>({id:"n"+i,label:"Long label ".repeat(9),color:"grey"}));
 assert.equal(c.drawCanvasDiagram(context,{width:480,height:240,nodes,edges:[]}),false);assert.equal(rects.length,0);
});
