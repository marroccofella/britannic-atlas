import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceCapture,wakeRequest} from '../public/voice-capture.mjs';
function fixture({throwConstructor=false}={}) {
 let now=0,id=0;const timers=new Map(),instances=[],submits=[],drafts=[],statuses=[],states=[],fatal=[];
 const platform={document:{hidden:false},performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:key=>timers.delete(key)};
 class Recognition {constructor(){if(throwConstructor)throw Error('unavailable');instances.push(this);}start(){}stop(){this.stopped=true;}abort(){this.aborted=true;}}
 const capture=createVoiceCapture({Recognition,platform,onSubmit:x=>submits.push(x),onDraft:x=>drafts.push(x),onState:x=>states.push(x),onStatus:x=>statuses.push(x),onFatal:x=>fatal.push(x)});
 function advance(ms){const end=now+ms;for(;;){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
 function result(rows,r=instances.at(-1)){r.onresult({results:rows.map(([text,isFinal=true])=>Object.assign([{transcript:text,confidence:.95}],{isFinal}))});}
 function start(mode='capture'){capture.start(mode);instances.at(-1)?.onstart();return instances.at(-1);}
 return {capture,instances,submits,drafts,statuses,states,fatal,timers,platform,advance,result,start};
}
test('one final clause waits and a second clause joins exactly once',()=>{
 const f=fixture(),r=f.start();assert.equal(r.continuous,true);
 f.result([['What is the population']]);f.advance(1400);assert.equal(f.submits.length,0);
 r.onspeechstart();f.result([['What is the population'],['of Douglas?']]);f.advance(2300);assert.equal(f.submits.length,0);
 f.advance(100);assert.equal(f.submits[0].text,'What is the population of Douglas?');assert.equal(f.submits.length,1);
 f.result([['stale words']],r);assert.equal(f.submits.length,1);
});
test('native end resumes capture without losing the earlier final clause',()=>{
 const f=fixture();f.start();f.result([['Tell me about']]);f.instances.at(-1).onend();f.advance(500);f.instances.at(-1).onstart();
 f.result([['Douglas harbour.']]);f.advance(2400);assert.equal(f.submits[0].text,'Tell me about Douglas harbour.');
});
test('send during a reconnect submits the saved draft instead of discarding it',()=>{
 const f=fixture(),r=f.start();f.result([['Where is Douglas?']]);r.onend();f.capture.stop({awaitFinal:true});
 assert.equal(f.submits[0]?.text,'Where is Douglas?');assert.equal(f.capture.mode,'off');
});
test('a throwing recognition constructor fails closed with a visible status',()=>{
 const f=fixture({throwConstructor:true});assert.doesNotThrow(()=>f.capture.start());
 assert.equal(f.capture.mode,'off');assert.equal(f.timers.size,0);assert.equal(f.fatal.length,1);
});
test('wake phrases are anchored and ambient words never reach the app',()=>{
 for(const name of ['Mannin','money','Mani','Manny'])assert.equal(wakeRequest('Hey '+name+', weather please'),'weather please');
 assert.equal(wakeRequest('I told him hey money was the name'),null);
 const f=fixture();f.start('wake');f.result([['private ambient words']]);assert.equal(f.drafts.length,0);assert.equal(f.submits.length,0);
 f.result([['private ambient words'],['Hey money, what is MOMM?']]);assert.equal(f.capture.mode,'capture');
 f.advance(2400);assert.equal(f.submits[0].text,'what is MOMM?');
});
test('bare wake phrase waits for a question and never sends the trigger',()=>{
 const f=fixture();f.start('wake');f.result([['Hey Mannin']]);f.advance(7000);assert.equal(f.submits.length,0);
 f.result([['Hey Mannin'],['Who are you?']]);f.advance(2400);assert.equal(f.submits[0].text,'Who are you?');
});
test('unfinished speech and unfinalised native results require confirmation',()=>{
 for(const [text,isFinal] of [['I was asking if',true],['weather tomorrow',false]]){
  const f=fixture();f.start();f.result([[text,isFinal]]);f.advance(4500);
  assert.equal(f.submits[0].needsConfirmation,true);assert.equal(f.submits[0].text,text);
 }
});
test('missing start and end events have bounded recovery and release',()=>{
 const f=fixture();f.capture.start();f.advance(40000);assert.equal(f.capture.mode,'off');assert.equal(f.fatal.length,1);assert.equal(f.timers.size,0);
 const g=fixture();g.start();g.result([['A question?']]);g.capture.stop({awaitFinal:true});g.advance(1500);
 assert.equal(g.submits[0].text,'A question?');assert.equal(g.capture.mode,'off');
});
test('permission denial never retries and stale events cannot affect a fresh session',()=>{
 const f=fixture(),old=f.start();old.onerror({error:'not-allowed'});f.advance(10000);assert.equal(f.instances.length,1);assert.equal(f.fatal.length,1);
 const fresh=f.start();old.onstart();old.onend();f.result([['old']],old);assert.equal(f.capture.active,fresh);assert.equal(f.submits.length,0);
});
test('explicit cancel clears timers and never submits ambient or delayed words',()=>{
 const f=fixture(),r=f.start('wake');f.capture.cancel();f.result([['Hey money buy something']],r);f.advance(100000);
 assert.equal(f.submits.length,0);assert.equal(f.timers.size,0);
});
test('hidden tab cannot acquire recognition',()=>{
 const f=fixture();f.platform.document.hidden=true;f.capture.start('wake');assert.equal(f.instances.length,0);assert.equal(f.capture.mode,'off');
});
test('wake phrase split across final segments is recognised without leaking earlier ambient speech',()=>{
 const f=fixture();f.start('wake');f.result([['private ambient talk'],['Hey']]);
 f.result([['private ambient talk'],['Hey'],['money, who are you?']]);f.advance(2400);
 assert.equal(f.submits[0]?.text,'who are you?');
});
test('the transcript length limit includes final words carried across a reconnect',()=>{
 const f=fixture(),r=f.start();f.result([['x'.repeat(1900)]]);r.onend();f.advance(500);f.instances.at(-1).onstart();
 f.result([['y'.repeat(300)]]);assert.ok(f.submits[0].text.length<=2000);assert.equal(f.submits[0].needsConfirmation,true);
});
test('a lost connection with interim words stops claiming the microphone is listening',()=>{
 for(const event of ['end','error']){
  const f=fixture(),r=f.start();f.result([['Could you show me',false]]);
  if(event==='end')r.onend();else r.onerror({error:'network'});
  assert.equal(f.states.at(-1),'finishing');assert.equal(f.capture.active,null);f.advance(2400);
  assert.equal(f.submits[0].needsConfirmation,true);assert.equal(f.submits[0].text,'Could you show me');
 }
});
