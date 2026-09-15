import {test} from "node:test";
import assert from "node:assert/strict";
import {createManiMicrophone} from "../public/mani-microphone.mjs";
function fixture() {
 const frames=new Map(),timers=new Map(),values=[],modes=[];let id=0,resolve,level=.05,stops=0,closes=0,requests=0;
 const stream={getTracks:()=>[{stop(){stops++;}}]};
 class Context {state="running";createAnalyser(){return{fftSize:1024,getFloatTimeDomainData(a){a.fill(level);}};}createMediaStreamSource(){return{connect(){},disconnect(){}};}resume(){return Promise.resolve();}close(){closes++;return Promise.resolve();}}
 const platform={document:Object.assign(new EventTarget(),{hidden:false}),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),AudioContext:Context,navigator:{mediaDevices:{getUserMedia(){requests++;return new Promise(r=>{resolve=r;});}}},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:i=>frames.delete(i)};
 const meter=createManiMicrophone({clearInput(){},inputAudio:x=>values.push(x)},platform,m=>modes.push(m));
 return{meter,frames,timers,values,modes,platform,stream,resolve:()=>resolve(stream),level:v=>{level=v;},counts:()=>({stops,closes,requests}),step:()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(f=>f());}};
}
test("microphone is acquired only on explicit start and RMS follows speech then silence",async()=>{
 const f=fixture();assert.equal(f.counts().requests,0);const started=f.meter.start();f.resolve();assert.equal(await started,true);
 assert.ok(f.values.at(-1)>.5);f.level(0);f.step();assert.equal(f.values.at(-1),0);
 f.meter.stop();assert.equal(f.counts().stops,1);assert.equal(f.counts().closes,1);assert.equal(f.frames.size,0);
});
test("permission resolving after cancellation immediately stops its stream and cannot light the logo",async()=>{
 const f=fixture(),started=f.meter.start();f.meter.stop();f.resolve();assert.equal(await started,false);
 assert.equal(f.counts().stops,1);assert.equal(f.values.length,0);assert.equal(f.frames.size,0);
});
test("meter failure leaves transcript-based feedback available without failing recognition",async()=>{
 const modes=[],meter=createManiMicrophone({clearInput(){}},{navigator:{}},m=>modes.push(m));
 assert.equal(await meter.start(),false);assert.equal(modes.at(-1),"transcript");
});
test("hiding the page releases the microphone meter without stale frames",async()=>{
 const f=fixture(),started=f.meter.start();f.resolve();await started;f.platform.document.hidden=true;f.step();
 assert.equal(f.frames.size,0);assert.equal(f.counts().stops,1);assert.equal(f.counts().closes,1);
});
test("destroyed meter cannot reacquire a microphone",async()=>{
 const f=fixture();f.meter.destroy();assert.equal(await f.meter.start(),false);assert.equal(f.counts().requests,0);
});
test("visibility change closes microphone tracks even when animation frames are suspended",async()=>{
 const f=fixture(),started=f.meter.start();f.resolve();await started;
 f.platform.document.hidden=true;f.platform.document.dispatchEvent(new Event("visibilitychange"));
 assert.equal(f.counts().stops,1);assert.equal(f.counts().closes,1);assert.equal(f.frames.size,0);
});
test("a stalled audio-context resume times out and releases its microphone",async()=>{
 const f=fixture();f.platform.AudioContext.prototype.resume=()=>new Promise(()=>{});
 const started=f.meter.start();f.resolve();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.timers.size,1);[...f.timers.values()][0]();
 assert.equal(await started,false);assert.equal(f.counts().stops,1);assert.equal(f.counts().closes,1);
 assert.equal(f.modes.at(-1),"transcript");assert.equal(f.frames.size,0);
});
test("cancelling while audio resume waits settles immediately without stale capture",async()=>{
 const f=fixture();f.platform.AudioContext.prototype.resume=()=>new Promise(()=>{});
 const started=f.meter.start();f.resolve();await new Promise(resolve=>setImmediate(resolve));f.meter.stop();
 assert.equal(await started,false);assert.equal(f.counts().stops,1);assert.equal(f.counts().closes,1);assert.equal(f.timers.size,0);
});
test("an automatic start cannot acquire a microphone while hidden",async()=>{
 const f=fixture();f.platform.document.hidden=true;assert.equal(await f.meter.start(),false);assert.equal(f.counts().requests,0);
});
