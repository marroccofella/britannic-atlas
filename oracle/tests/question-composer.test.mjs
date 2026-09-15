import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindQuestionComposer} from '../public/question-composer.mjs';
import {MAX_MESSAGE_CHARS,messageProblem} from '../public/conversation-policy.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {answer} from '../lib/brain.mjs';
import {readJson} from '../lib/http.mjs';
import {EventEmitter} from 'node:events';
class Field extends EventTarget {
  value=''; dataset={}; attributes=new Map(); focused=false;
  setAttribute(k,v){this.attributes.set(k,v);} removeAttribute(k){this.attributes.delete(k);}
  focus(){this.focused=true;}
  requestSubmit(){this.dispatchEvent(new Event('submit',{cancelable:true}));}
}
function fixture(onSubmit){const input=new Field(),form=new Field(),counter=new Field(),error=new Field(),sent=[];bindQuestionComposer({input,form,counter,error,onSubmit:onSubmit||((q)=>sent.push(q))});return{input,form,counter,error,sent};}
const type=(f,q)=>{f.input.value=q;f.input.dispatchEvent(new Event('input'));};
const enter=(f,props={})=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key:'Enter',...props});f.input.dispatchEvent(e);return e;};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const mode of ['Enter','button'])test(mode+' sends a complete multiline prompt at the boundary',async()=>{
 const f=fixture(),q='Opening\n'+ 'x'.repeat(MAX_MESSAGE_CHARS-13)+'\nEND!';type(f,q);
 assert.equal(q.length,MAX_MESSAGE_CHARS);assert.match(f.counter.textContent,/12,000 \/ 12,000/);
 if(mode==='Enter')enter(f);else f.form.requestSubmit();await flush();
 assert.deepEqual(f.sent,[q]);assert.equal(f.input.value,'');assert.match(f.counter.textContent,/^0 \/ 12,000/);
});
test('over-limit and empty prompts explain the problem beside the input without clearing it',async()=>{
 const f=fixture(),q='x'.repeat(MAX_MESSAGE_CHARS+1);type(f,q);enter(f);f.form.requestSubmit();await flush();
 assert.deepEqual(f.sent,[]);assert.equal(f.input.value,q);assert.equal(f.error.hidden,false);assert.match(f.error.textContent,/12,001/);assert.equal(f.input.attributes.get('aria-invalid'),'true');
 type(f,'Now valid');assert.equal(f.error.hidden,true);assert.equal(f.input.attributes.has('aria-invalid'),false);
 type(f,'   ');f.form.requestSubmit();assert.match(f.error.textContent,/Type a question/);assert.equal(f.input.value,'   ');
});
test('Shift+Enter, held Enter and IME confirmation never accidentally submit',async()=>{
 const f=fixture();type(f,'Composing a message');assert.equal(enter(f,{shiftKey:true}).defaultPrevented,false);
 enter(f,{repeat:true});enter(f,{isComposing:true});enter(f,{keyCode:229});
 f.input.dispatchEvent(new Event('compositionstart'));enter(f);f.form.requestSubmit();await flush();assert.deepEqual(f.sent,[]);
 f.input.dispatchEvent(new Event('compositionend'));enter(f);await flush();assert.deepEqual(f.sent,['Composing a message']);
});
test('a failing startup restores its draft and counter but cannot overwrite a later edit',async()=>{
 for(const newer of [false,true]){let reject;const f=fixture(()=>new Promise((_,no)=>reject=no));type(f,'Keep this draft');enter(f);await flush();if(newer){type(f,'newer');type(f,'');}reject(Error('unavailable'));await flush();assert.equal(f.input.value,newer?'':'Keep this draft');if(!newer){assert.match(f.error.textContent,/Could not send/);assert.match(f.counter.textContent,/^15 \/ /);}}
});
test('programmatic restores and wide Unicode use the same count as request validation',()=>{
 const f=fixture();type(f,'🏝️');assert.match(f.counter.textContent,/^3 \/ /);f.input.value='Restored draft';f.input.dispatchEvent(new Event('input'));assert.match(f.counter.textContent,/^14 \/ /);assert.equal(messageProblem('界'.repeat(MAX_MESSAGE_CHARS)),'');
});
test('full long request and expanded resolution survive saved-history paging',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const store=new ConversationStore(kb.db),question='start '+ 'x'.repeat(11000)+' MIDDLE instruction '+ 'y'.repeat(500)+' END instruction',canonical='Answer for the Isle of Man: '+question;
 store.start({id:'long',sessionId:'input-test',clientTurn:1,question,resolution:{canonical,route:'answer',jurisdiction:'Isle of Man'}});store.finish('long',{answer:'Synthetic reply'});
 const row=store.page('input-test').turns[0];assert.equal(row.question,question);assert.equal(row.resolved_question,canonical);
});
for(const reviewAfterSearch of [false,true])test('long original reaches the answer model intact, review handoff='+reviewAfterSearch,async t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const question='Explain this example: '+ 'x'.repeat(5000)+' MIDDLE-MUST-SURVIVE '+ 'y'.repeat(5000)+' END-MUST-SURVIVE';let prompt;
 await answer({kb,question,sessionId:'input-test',resolution:{route:'answer',canonical:question,jurisdiction:'Isle of Man',conversationMeta:true,reviewAfterSearch},emit(){},runModel:async input=>{prompt=input.prompt;input.onDelta('Synthetic explanation.');return{text:'Synthetic explanation.',costUsd:0,durationMs:1};}});
 assert.ok(prompt.includes(question),'Model must receive every character of the original');
});
test('maximum wide-Unicode prompt fits the existing HTTP envelope without byte truncation',async()=>{
 const question='界'.repeat(MAX_MESSAGE_CHARS),req=new EventEmitter();req.headers={};const decoded=readJson(req);const body=Buffer.from(JSON.stringify({question,sessionId:'synthetic',requestId:'long-unicode',source:'typed',replacePrevious:true,clientTurn:1}));assert.ok(body.length<64000);req.emit('data',body);req.emit('end');assert.equal((await decoded).question,question);
});
