import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {messageProblem} from "../public/conversation-policy.mjs";
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const ask=app.slice(app.indexOf('  async function ask('),app.indexOf('  function handle('));
const render=app.slice(app.indexOf('  function renderSavedTurn('),app.indexOf('  async function restoreConversation('));
const navigation=app.slice(app.indexOf('  $("#newConversation").onclick'),app.indexOf('  $("#olderTurns").onclick'));
const open=app.slice(app.indexOf('  async function openConversation('),app.indexOf('  $("#newConversation").onclick'));
function installAsk(context) {
  Object.assign(context,{activity:{start(){},clear(){},snapshot(){return[];}},finishActivity(){},newRequestId:context.newRequestId||(()=> 'pending-test'),messageProblem,$:()=>({removeAttribute(){}})});
  Object.assign(context,{typedActivity:{clear(){}},searchGeneration:0,stopListening(){},resumeIfConversation(){},pendingAsks:new Set(),refreshActivityState(){},setLiveStatus(){}});
  if(context.transcript)context.transcript.prepend=context.transcript.append;
  vm.runInContext(ask,context);
}
test('missing secure browser randomness shows a clear disabled state without throwing',()=>{
  const controls=[{},{},{}],heard={},live={},nodes=new Map([['#heard',heard],['#liveStatus',live]]);
  const c=vm.createContext({crypto:{},document:{querySelector:key=>nodes.get(key)||{},querySelectorAll:()=>controls},createManiVisual:()=>({setMotionPreference(){}}),Uint8Array,localStorage:{getItem:()=>null,setItem(){}}});
  const bootstrap=app.slice(app.indexOf('(() => {'),app.indexOf('  let activeController'))+'})();';
  assert.doesNotThrow(()=>vm.runInContext(bootstrap,c));assert.match(heard.textContent,/secure/i);assert.ok(controls.every(node=>node.disabled));
});
test('a failed send clears all references to the active answer',async()=>{
  const target=element();target.setAttribute=()=>{};target.scrollIntoView=()=>{};
  const c=vm.createContext({sessionId:'A',historyReady:Promise.resolve(),activeController:null,activeQuestion:'',activeTurnElement:null,wantListening:false,closeSpeechConfirm(){},hush(){},setState(){},AbortController,responseGeneration:0,newRequestId:()=> 'r1',clientTurn:0,rememberClientTurn(){},tpl:{content:{firstElementChild:{cloneNode:()=>target}}},transcript:{append(){}},fetch:async()=>{throw new Error('offline');},markIncomplete(){}});
  installAsk(c);await c.ask('Hello Mani');assert.equal(c.activeController,null);assert.equal(c.activeTurnElement,null);
});

test('a failed send restores only its own unsent draft, never newer input or another chat',async()=>{
  for(const scenario of ['restore','new-draft','new-session','new-request','aborted']) {
    const target=element();target.setAttribute=()=>{};target.scrollIntoView=()=>{};
    const input={value:'',removeAttribute(){}};let fail;
    const c=vm.createContext({sessionId:'A',historyReady:Promise.resolve(),activeController:null,activeQuestion:'',activeTurnElement:null,wantListening:false,closeSpeechConfirm(){},hush(){},setState(){},AbortController,responseGeneration:0,newRequestId:()=> 'r1',clientTurn:0,rememberClientTurn(){},tpl:{content:{firstElementChild:{cloneNode:()=>target}}},transcript:{append(){}},fetch:()=>new Promise((_resolve,reject)=>fail=reject),markIncomplete(){}});
    installAsk(c);c.$=()=>input;const pending=c.ask('Keep this question');await new Promise(resolve=>setImmediate(resolve));
    if(scenario==='new-draft')input.value='A newer draft';
    if(scenario==='new-session')c.sessionId='B';
    if(scenario==='new-request')c.responseGeneration++;
    if(scenario==='aborted')c.activeController.abort();
    const error=new Error('offline');if(scenario==='aborted')error.name='AbortError';fail(error);await pending;
    assert.equal(input.value,scenario==='restore'?'Keep this question':scenario==='new-draft'?'A newer draft':'',scenario);
  }
});

test('speaking pace restores a valid preference and saves changes without requiring storage',()=>{
  const block=app.slice(app.indexOf('  // Remember speaking pace'),app.indexOf('  if (!globalThis.crypto'));
  const saved=new Map([['oracle.rate','1.2']]),rate={value:'1'};
  const localStorage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
  vm.runInNewContext(block,{rate,localStorage});assert.equal(rate.value,'1.2');
  rate.value='0.85';rate.oninput();assert.equal(saved.get('oracle.rate'),'0.85');
  for(const bad of ['0','-1','NaN','99','']) {saved.set('oracle.rate',bad);rate.value='1';vm.runInNewContext(block,{rate,localStorage});assert.equal(rate.value,'1');}
  assert.doesNotThrow(()=>{vm.runInNewContext(block,{rate,localStorage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}}});rate.onchange();});
});

test('an incomplete older turn can be marked without replacing the current live announcement',()=>{
  const source=app.slice(app.indexOf('  function markIncomplete('),app.indexOf('  function safeMapWorkspaceHref('));
  const announcements=[],c=vm.createContext({setLiveStatus:message=>announcements.push(message)});vm.runInContext(source,c);
  const old=element();c.markIncomplete(old,'Old request stopped',false);assert.equal(old.querySelector('.note').textContent,'Old request stopped');assert.deepEqual(announcements,[]);
  c.markIncomplete(element(),'Current request failed');assert.deepEqual(announcements,['Current request failed']);
});
test('reopening a chat waits for its older reset request before allowing a new answer',async()=>{
  let resetA;const pendingA=new Promise(resolve=>resetA=resolve);
  const c=vm.createContext({sessionId:'A',clientTurn:0,historyCursor:null,pendingConversationResets:new Map(),heard:{},$:()=>({classList:{add(){}}}),
    fetch:(_url,options)=>JSON.parse(options.body).sessionId==='A'?pendingA:Promise.resolve(),hush(){},rememberSession(){},clearConversationView(){},restoreConversation:async()=>{},connectResearchEvents(){}});
  vm.runInContext(open,c);await c.openConversation('B');
  let reopened=false;const opening=c.openConversation('A').then(()=>reopened=true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(reopened,false);
  resetA();await opening;assert.equal(reopened,true);
});
test('rapid back-and-forth navigation waits for every reset even when replies arrive out of order',async()=>{
  const resetA=[];
  const c=vm.createContext({sessionId:'A',clientTurn:0,historyCursor:null,pendingConversationResets:new Map(),heard:{},$:()=>({classList:{add(){}}}),
    fetch:(_url,options)=>JSON.parse(options.body).sessionId==='A'?new Promise(resolve=>resetA.push(resolve)):Promise.resolve(),hush(){},rememberSession(){},clearConversationView(){},restoreConversation:async()=>{},connectResearchEvents(){}});
  vm.runInContext(open,c);await c.openConversation('B');const firstReturn=c.openConversation('A');await c.openConversation('B');
  let ready=false;const lastReturn=c.openConversation('A').then(()=>ready=true);
  resetA[1]();await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);
  resetA[0]();await Promise.all([firstReturn,lastReturn]);assert.equal(ready,true);
});
test('a delayed new-conversation creation cannot override a later history selection',async()=>{
  let created;const buttons=new Map([['#newConversation',{}],['#conversationHistory',{}]]),opened=[];
  const c=vm.createContext({navigationIntent:0,historyReady:Promise.resolve(),$:id=>buttons.get(id),postJson:()=>new Promise(resolve=>created=resolve),openConversation:async id=>opened.push(id),setLiveStatus(){}});
  vm.runInContext(navigation,c);buttons.get('#newConversation').onclick();const creating=c.historyReady;
  buttons.get('#conversationHistory').onchange({target:{value:'chosen'}});created({conversation:{id:'late-new'}});await creating;
  assert.deepEqual(opened,['chosen']);
});
test('a submission awaiting history cannot migrate into a different conversation',async()=>{
  let ready;let requests=0;
  const c=vm.createContext({sessionId:'A',historyReady:new Promise(resolve=>ready=resolve),fetch:()=>{requests++;throw new Error('must not submit');}});
  installAsk(c);const pending=c.ask('This belongs to A');c.sessionId='B';ready();await pending;
  assert.equal(requests,0);
});
test('switching away and back fences a stale submission even when the id matches again',async()=>{
  let ready;const old=new Promise(resolve=>ready=resolve);
  const c=vm.createContext({sessionId:'A',historyReady:old,fetch:()=>{throw new Error('must not submit');}});
  installAsk(c);const pending=c.ask('This was submitted before the switch');c.historyReady=Promise.resolve();ready();await pending;
});
function element() {
  const classes=new Set(),fields=new Map();
  return {dataset:{},classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},
    querySelector:key=>{if(!fields.has(key)) fields.set(key,{textContent:'',classList:{add(){},remove(){}}});return fields.get(key);}};
}

test('restoration and older pagination maintain newest-first DOM order without changing stored history',async()=>{
  const nodes=new Map();
  const transcript={children:[],get firstElementChild(){return this.children[0]||null;},insertBefore(el,before){
    const old=this.children.indexOf(el);if(old>=0)this.children.splice(old,1);
    const at=this.children.indexOf(before);if(at<0)this.children.push(el);else this.children.splice(at,0,el);
  }};
  const row=n=>({id:'r'+n,question:'Question '+n,answer:'Answer '+n,status:'complete',metadata:{}});
  let rows=[row(3),row(4),row(5)];
  const c=vm.createContext({transcript,turns:new Map(),tpl:{content:{firstElementChild:{cloneNode:element}}},handle(){},markIncomplete(){},
    historyGeneration:0,historyCursor:null,sessionId:'A',clientTurn:0,lastResolvedQuestion:'',
    $:key=>{if(!nodes.has(key))nodes.set(key,{classList:{toggle(){}}});return nodes.get(key);},
    fetch:async()=>({ok:true,json:async()=>({turns:rows,before:3,conversation:{title:'Test'}})}),
    rememberClientTurn(){},syncResearch:async()=>{},refreshConversationList:async()=>{}});
  let activityClears=0;c.activity={clear(){activityClears++;}};vm.runInContext(render+app.slice(app.indexOf('  async function restoreConversation('),app.indexOf('  async function openConversation(')),c);
  await c.restoreConversation('A');
  assert.deepEqual(transcript.children.map(el=>el.dataset.requestId),['r5','r4','r3']);
  rows=[row(1),row(2)];await c.restoreConversation('A',{older:true});
  assert.deepEqual(transcript.children.map(el=>el.dataset.requestId),['r5','r4','r3','r2','r1']);
  await c.restoreConversation('A',{older:true});assert.equal(transcript.children.length,5);assert.equal(activityClears,1,'Older pagination must preserve live progress');
});

test('clicked Search waits for the answer stream, preserves narration and serializes further clicks',async()=>{
  const block=app.slice(app.indexOf('  function searchAnswer('),app.indexOf('  function renderNextSteps('));
  let settle;const sent=[];
  const c=vm.createContext({pendingSearches:new Set(),resumeIfConversation(){},sessionId:'A',navigationIntent:0,searchGeneration:0,searchQueue:Promise.resolve(),historyReady:Promise.resolve(),
    activeController:{settled:new Promise(resolve=>settle=resolve)},setLiveStatus(){},
    ask:async(q,options)=>{sent.push({q,options});}});
  vm.runInContext(block,c);
  const first=c.searchAnswer({isConnected:true,dataset:{requestId:'r1'}},{researchMode:'live_sources'});
  const second=c.searchAnswer({isConnected:true,dataset:{requestId:'r2'}},{researchMode:'sources'});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.length,0);
  c.activeController=null;settle();await Promise.all([first,second]);
  assert.deepEqual(sent.map(x=>x.options.researchTurnId),['r1','r2']);
  assert.ok(sent.every(x=>x.options.preserveSpeech===true));
});
test('Stop, a new conversation, or removed targets cancel a queued Search without running it',async()=>{
  const block=app.slice(app.indexOf('  function searchAnswer('),app.indexOf('  function renderNextSteps('));
  for(const cancel of ['stop','navigation','removed']){
    let settle;let calls=0;const turn={isConnected:true,dataset:{requestId:'r1'}};
    const c=vm.createContext({pendingSearches:new Set(),resumeIfConversation(){},sessionId:'A',navigationIntent:0,searchGeneration:0,searchQueue:Promise.resolve(),historyReady:Promise.resolve(),
      activeController:{settled:new Promise(resolve=>settle=resolve)},setLiveStatus(){},ask:async()=>{calls++;}});
    vm.runInContext(block,c);const pending=c.searchAnswer(turn,{});
    await new Promise(resolve=>setImmediate(resolve));
    if(cancel==='stop')c.searchGeneration++;if(cancel==='navigation')c.navigationIntent++;if(cancel==='removed')turn.isConnected=false;
    c.activeController=null;settle();await pending;assert.equal(calls,0,cancel);
  }
});

test('MOMM reproduction: Search rechecks its target authorization after the ask history await',async()=>{
  const target=element();target.setAttribute=()=>{};target.scrollIntoView=()=>{};let calls=0,allowed=true;
  const c=vm.createContext({sessionId:'A',historyReady:Promise.resolve(),activeController:null,activeQuestion:'',activeTurnElement:null,wantListening:false,closeSpeechConfirm(){},hush(){},setState(){},AbortController,responseGeneration:0,newRequestId:()=> 'r1',clientTurn:0,rememberClientTurn(){},tpl:{content:{firstElementChild:{cloneNode:()=>target}}},transcript:{append(){}},fetch:async()=>{calls++;throw new Error('should not send');},markIncomplete(){}});
  installAsk(c);
  const pending=c.ask('Search this answer',{preserveSpeech:true,canDispatch:()=>allowed});
  allowed=false;await pending;assert.equal(calls,0);
});
test('paging to an older research request merges its recovered result into one card',()=>{
  const recovered=element();recovered.classList.add('researchReturn');recovered.result='The recovered result and sources';
  const transcript={children:[recovered],insertBefore(el,before){const old=this.children.indexOf(el);if(old>=0)this.children.splice(old,1);const at=this.children.indexOf(before);if(at<0)this.children.push(el);else this.children.splice(at,0,el);}};
  const c=vm.createContext({transcript,turns:new Map([['expedition:e1',recovered]]),tpl:{content:{firstElementChild:{cloneNode:element}}},handle(){},markIncomplete(){}});
  vm.runInContext(render,c);
  const row={id:'r1',question:'Original request',answer:'Original answer',status:'complete',metadata:{expedition:{id:'e1'}}};
  c.renderSavedTurn(row);c.renderSavedTurn(row);
  assert.equal(transcript.children.length,1);assert.equal(transcript.children[0],recovered);
  assert.equal(recovered.dataset.requestId,'r1');assert.equal(recovered.result,'The recovered result and sources');
  assert.equal(recovered.querySelector('.a').textContent,'Original answer');
});
