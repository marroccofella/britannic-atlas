import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){
 const timers=new Map();let id=0,starts=0,visible=false;
 const panel={classList:{contains:()=>!visible}},cancel={};
 const c=vm.createContext({pendingSearches:new Set(),conversation:{checked:false},wakeListening:{checked:true},wakeStatus:{},heard:{},rec:null,speaking:false,speechQueue:[],state:'idle',document:{hidden:false},restartTimer:null,SR:{},wantListening:false,
  speechConfirm:panel,$:s=>s==='#cancelSpeech'?cancel:{hidden:false},voiceCapture:{mode:'off',start(){starts++;}},closeSpeechConfirm(){visible=false;},
  setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),stopListening(){}});
 vm.runInContext(app.slice(app.indexOf('  function scheduleWake()'),app.indexOf('  function startListening()')),c);
 vm.runInContext(app.split('\n').find(line=>line.includes('$("#cancelSpeech").onclick =')),c);
 return {c,cancel,timers,get starts(){return starts;},show(){visible=true;},flush(){const due=[...timers.values()];timers.clear();due.forEach(fn=>fn());}};
}
test('enabling wake never opens a microphone behind speech confirmation',()=>{
 const f=fixture();f.show();f.c.wakeListening.onchange();f.flush();assert.equal(f.starts,0);
});
test('closing confirmation resumes explicitly enabled wake mode',()=>{
 const f=fixture();f.show();f.c.scheduleWake();f.flush();f.cancel.onclick();f.flush();assert.equal(f.starts,1);
});
test('cancelling pending wake prevents a stale scheduled microphone start',()=>{
 const f=fixture();f.c.scheduleWake();f.c.disableWake();f.flush();assert.equal(f.starts,0);
});

test('MOMM reproduction: disabling Keep listening before reply completion cannot restart capture',()=>{
 const f=fixture();let resumed=0;f.c.wakeListening.checked=false;
 f.c.startListening=()=>{resumed++;};f.c.conversation.checked=true;f.c.wantListening=true;
 vm.runInContext(app.slice(app.indexOf('  function resumeIfConversation()'),app.indexOf('  function canSpeakBackgroundUpdate()')),f.c);
 f.c.conversation.checked=false;f.c.conversation.onchange();f.c.resumeIfConversation();f.flush();
 assert.equal(resumed,0);
});
test('MOMM reproduction: both listening toggles share one wake owner after a hidden reply',()=>{
 const f=fixture();f.c.conversation.checked=true;f.c.wantListening=true;
 f.c.startListening=()=>{throw Error('full capture must defer to wake mode');};
 vm.runInContext(app.slice(app.indexOf('  function resumeIfConversation()'),app.indexOf('  function canSpeakBackgroundUpdate()')),f.c);
 f.c.document.hidden=true;f.c.resumeIfConversation();f.flush();assert.equal(f.starts,0);
 f.c.document.hidden=false;f.c.resumeIfConversation();f.c.scheduleWake();f.flush();assert.equal(f.starts,1);
});
test('MOMM suggestion reproduction: an authorized queued search reserves the channel before automatic listening',()=>{
 const f=fixture();let captures=0;f.c.startListening=()=>{captures++;};f.c.conversation.checked=true;f.c.wantListening=true;
 vm.runInContext(app.slice(app.indexOf('  function resumeIfConversation()'),app.indexOf('  function canSpeakBackgroundUpdate()')),f.c);
 f.c.pendingSearches.add({});f.c.wakeListening.checked=false;f.c.resumeIfConversation();assert.equal(captures,0);
 f.c.wakeListening.checked=true;f.c.scheduleWake();f.flush();assert.equal(f.starts,0);
 f.c.pendingSearches.clear();f.c.scheduleWake();f.flush();assert.equal(f.starts,1);
});
test('capture completion defers research speech until a submitted question can claim the channel',()=>{
 let mode='off',flushed=0,activeQuestion=false;const tasks=[];
 const c=vm.createContext({voiceCapture:{get mode(){return mode;}},refreshActivityState(){},queueMicrotask:fn=>tasks.push(fn),flushDeferredResearchSpeech(){if(!activeQuestion)flushed++;}});
 vm.runInContext(app.slice(app.indexOf('  function afterCaptureStops()'),app.indexOf('  function scheduleWake()')),c);
 c.afterCaptureStops();assert.equal(flushed,0);activeQuestion=true;tasks.shift()();assert.equal(flushed,0);
 activeQuestion=false;c.afterCaptureStops();tasks.shift()();assert.equal(flushed,1);
 c.afterCaptureStops();mode='capture';tasks.shift()();assert.equal(flushed,1);
});

test('live transcript keeps settled DOM stable, updates corrections immediately, and renders literal words',()=>{
 const nodes=[];const heard={scrollHeight:200,scrollTop:100,clientHeight:100,querySelector:selector=>nodes.find(n=>'.'+n.className===selector),replaceChildren(...next){nodes.splice(0,nodes.length,...next);}};
 const context=vm.createContext({heard,document:{createElement:()=>({textContent:'',className:''})}});
 const start=app.indexOf('    onDraft: ({final,interim}) => {')+'    onDraft: '.length;
 const callback=app.slice(start,app.indexOf('\n    onSubmit:',start)).trim().replace(/,$/,'');
 const render=vm.runInContext('('+callback+')',context);
 render({final:'Tell me about',interim:'Peal'});const settled=nodes[0];
 render({final:'Tell me about',interim:'Peel'});assert.equal(nodes[0],settled);assert.equal(nodes[1].textContent,' Peel');
 render({final:'Tell me about Peel',interim:''});assert.equal(nodes[0],settled);assert.equal(nodes[0].textContent,'Tell me about Peel');assert.equal(nodes[1].textContent,'');
 render({final:'<img src=x onerror=alert(1)>',interim:'<script>'});assert.equal(nodes[0].textContent,'<img src=x onerror=alert(1)>');assert.equal(nodes[1].textContent,' <script>');assert.equal(nodes.length,2);
});

test('live transcript follows the end but preserves deliberate scrollback',()=>{
 const nodes=[];const heard={scrollHeight:900,scrollTop:0,clientHeight:100,querySelector:selector=>nodes.find(n=>'.'+n.className===selector),replaceChildren(...next){nodes.splice(0,nodes.length,...next);}};
 const context=vm.createContext({heard,document:{createElement:()=>({textContent:'',className:''})}});
 const start=app.indexOf('    onDraft: ({final,interim}) => {')+'    onDraft: '.length;
 const render=vm.runInContext('('+app.slice(start,app.indexOf('\n    onSubmit:',start)).trim().replace(/,$/,'')+')',context);
 render({final:'Earlier words',interim:'new words'});assert.equal(heard.scrollTop,0);
 heard.scrollTop=800;render({final:'Earlier words',interim:'more words'});assert.equal(heard.scrollTop,900);
});
