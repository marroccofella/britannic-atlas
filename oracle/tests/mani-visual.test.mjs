import { test } from "node:test";
import assert from "node:assert/strict";
import { createManiVisual, speechPlan } from "../public/mani-visual.mjs";

function fixture() {
  const frames = new Map(), attributes = new Map(), properties = new Map();
  const listeners = new Map();
  let id = 0, now = 0;
  const motion = { matches: false, addEventListener: (name, fn) => listeners.set(`motion:${name}`, fn), removeEventListener: (name) => listeners.delete(`motion:${name}`) };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  const rocks=[0,0,0];
  const button = { dataset: {}, querySelectorAll:()=>rocks.map((_,i)=>({setAttribute:(_key,value)=>rocks[i]=Number(value.match(/[-\d.]+/)[0])})), querySelector: () => ({ setAttribute: (key, value) => attributes.set(key, value) }), style: { setProperty: (key, value) => properties.set(key, value) } };
  const platform = { document, performance:{now:()=>now}, matchMedia: () => motion, requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; }, cancelAnimationFrame: (key) => frames.delete(key) };
  const visual = createManiVisual(button, platform);
  return { visual, button, frames, listeners, motion, document, rocks, angle: () => attributes.get("transform"), energy: () => Number(properties.get("--mani-energy")),
    level: name=>Number(properties.get(`--mani-${name}`)),
    elapse(ms) { now += ms; },
    advance(count = 30) { for (let i = 0; i < count; i++) { now += 16.67; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((fn) => fn(now)); } },
  };
}

test("listening dances visibly, remains bounded and follows voice level rather than spinning",()=>{
  const f=fixture();f.visual.setState("listening");let peak=0;
  for(let n=0;n<100;n++){f.visual.inputAudio(1);f.advance(1);peak=Math.max(peak,...f.rocks.map(Math.abs));}
  assert.ok(peak>7,"full voice should have a clearly visible dance");
  assert.ok(peak<=10,"the symbol must retain its coherent shape");
  assert.equal(f.angle(),"rotate(0.000)");assert.ok(f.level("input")>.95);
  for(let n=0;n<120;n++){f.visual.inputAudio(0);f.advance(1);}
  assert.ok(f.rocks.every(angle=>Math.abs(angle)<.01));assert.ok(f.level("input")<.01);
  f.visual.setMotionPreference("off");f.visual.inputAudio(1);f.advance();
  assert.ok(f.rocks.every(angle=>angle===0));assert.equal(f.frames.size,0);
});

test("listening never spins and only speech activates the central glow", () => {
  const f = fixture();
  assert.equal(f.frames.size, 0);
  f.visual.setState("starting"); f.advance();
  assert.equal(f.angle(), "rotate(0.000)"); assert.equal(f.energy(), 0);
  assert.equal(f.frames.size, 0);
  f.visual.setState("listening"); f.advance();
  assert.equal(f.angle(), "rotate(0.000)");
  assert.equal(f.energy(), 0);
  const stoppedAngle = f.angle();
  f.visual.setState("speaking"); f.advance();
  assert.equal(f.angle(), stoppedAngle);
  assert.ok(f.energy() > 0.3);
  f.visual.speechBoundary(); f.advance(3);
  assert.ok(f.energy() > 0.5);
  f.visual.setState("idle");
  assert.equal(f.energy(), 0);
  assert.equal(f.frames.size, 0);
});

test("thinking rotates the three legs without pretending speech has started",()=>{
  const f=fixture();f.visual.setState('thinking');f.advance();assert.notEqual(f.angle(),'rotate(0.000)');assert.equal(f.energy(),0);
  f.visual.setState('idle');const angle=f.angle();f.advance();assert.equal(f.angle(),angle);assert.equal(f.frames.size,0);
});
test("speech timing accounts for syllables, punctuation and selected speaking rate",()=>{
  const words=speechPlan('Manx articulation. Hello');
  assert.ok(words[1].duration>words[0].duration);
  assert.ok(words[2].start-words[1].start-words[1].duration>.2);
  assert.equal(words[1].index,5);assert.ok(speechPlan('articulation',2)[0].duration<words[1].duration);
});
test("the text-timed glow follows word envelopes and ignores stale or out-of-range boundaries",()=>{
  const f=fixture();f.visual.setState('speaking');f.visual.beginSpeech({text:'Hello. Articulation.'});
  f.advance(10);const peak=f.energy();f.advance(25);assert.ok(f.energy()<peak);
  f.visual.speechBoundary({name:'word',charIndex:7});f.advance(6);assert.ok(f.energy()>.3);
  f.visual.setState('paused');assert.equal(f.energy(),0);f.elapse(8000);
  f.visual.speechBoundary({name:'word',charIndex:0});assert.equal(f.energy(),0);
  f.visual.setState('speaking');f.advance(3);assert.ok(f.energy()>.2);
  f.visual.setState('idle');f.visual.speechBoundary({name:'word',charIndex:999});assert.equal(f.energy(),0);
});

test("speech boundary events cannot animate idle, listening or reduced-motion states", () => {
  const f=fixture(); f.visual.speechBoundary(); assert.equal(f.frames.size,0);
  f.visual.setState("listening"); f.visual.speechBoundary(); f.advance(); assert.equal(f.energy(),0);
  f.motion.matches=true; f.listeners.get("motion:change")(); f.visual.setState("speaking");
  f.visual.speechBoundary(); f.advance(); assert.equal(f.energy(),0.65); assert.equal(f.frames.size,0);
});

test("a missing speech-boundary event is ignored without breaking playback",()=>{
  const f=fixture();f.visual.setState("speaking");f.visual.beginSpeech({text:"Hello, Mannin."});
  assert.doesNotThrow(()=>f.visual.speechBoundary(null));f.advance(6);
  assert.ok(f.energy()>0);assert.equal(f.frames.size,1);
});

test("a long hidden interval cannot jump the rotation angle on the first resumed frame", () => {
  const f=fixture(); f.visual.setState("listening"); f.advance(); const angle=f.angle();
  f.document.hidden=true; f.listeners.get("visibilitychange")(); f.elapse(60000);
  f.document.hidden=false; f.listeners.get("visibilitychange")(); f.advance(1);
  assert.equal(f.angle(),angle);
});

test("pause and interruption extinguish the speech glow immediately", () => {
  const f = fixture();
  f.visual.setState("speaking"); f.advance();
  f.visual.setState("paused");
  assert.equal(f.energy(), 0);
  assert.equal(f.frames.size, 0);
  f.visual.setState("speaking"); f.advance();
  f.visual.setState("listening");
  assert.equal(f.energy(), 0);
  f.advance(); assert.equal(f.angle(), "rotate(0.000)");
});

test("reduced motion stays static and hidden tabs suspend work without changing state", () => {
  const f = fixture();
  f.motion.matches = true; f.listeners.get("motion:change")();
  f.visual.setState("listening"); f.advance();
  assert.equal(f.angle(), "rotate(0.000)");
  assert.equal(f.frames.size, 0);
  f.visual.setState("speaking");
  assert.equal(f.energy(), 0.65);
  assert.equal(f.frames.size, 0);
  f.motion.matches = false; f.listeners.get("motion:change")();
  assert.equal(f.frames.size, 1);
  f.document.hidden = true; f.listeners.get("visibilitychange")();
  assert.equal(f.frames.size, 0);
  f.document.hidden = false; f.listeners.get("visibilitychange")();
  assert.equal(f.frames.size, 1);
  f.visual.destroy();
  assert.equal(f.frames.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.energy(), 0);
});

test("typing brightens the outline immediately without pretending to speak",()=>{
  const f=fixture();f.visual.inputPulse("typing");assert.equal(f.level("input"),1);assert.equal(f.energy(),0);
  f.advance(10);assert.equal(f.angle(),"rotate(0.000)");assert.equal(f.energy(),0);f.visual.inputPause("typing");f.advance(120);
  assert.equal(f.level("input"),0);assert.equal(f.frames.size,0);
});
test("rapid keys sustain light rather than repeatedly switching it on and off",()=>{
  const f=fixture();for(let n=0;n<40;n++){f.visual.inputPulse("typing");f.advance(3);assert.ok(f.level("input")>=.65);}
  f.visual.clearInput("typing");f.advance(2);assert.equal(f.level("input"),0);
});
test("finishing transcription stays still and three speech zones remain distinct",()=>{
  const f=fixture();f.visual.setState("finishing");f.advance();assert.equal(f.angle(),"rotate(0.000)");
  f.visual.setState("speaking");const angle=f.angle();f.visual.beginSpeech({text:"Articulation. Hello."});f.advance(6);
  const zones=[0,1,2].map(n=>f.level(`zone-${n}`));assert.equal(new Set(zones).size,3);assert.equal(f.angle(),angle);
  f.visual.setState("paused");assert.deepEqual([0,1,2].map(n=>f.level(`zone-${n}`)),[0,0,0]);
});
test("old typing cleanup cannot erase live speech input and reduced motion stays static",()=>{
  const f=fixture();f.visual.setState("listening");f.visual.inputPulse("speech");f.visual.clearInput("typing");assert.equal(f.level("input"),1);
  f.motion.matches=true;f.listeners.get("motion:change")();f.visual.inputPulse("speech");assert.equal(f.frames.size,0);assert.equal(f.level("input"),.35);
  f.visual.inputPause("speech");assert.equal(f.level("input"),0);f.visual.destroy();assert.equal(f.frames.size,0);
});
test("clearing hidden input removes stale bright zones on return",()=>{
 const f=fixture();f.visual.inputPulse("typing");f.document.hidden=true;f.listeners.get("visibilitychange")();
 f.visual.clearInput();f.document.hidden=false;f.listeners.get("visibilitychange")();f.advance();
 assert.equal(f.level("input"),0);assert.deepEqual([0,1,2].map(n=>f.level("zone-"+n)),[0,0,0]);assert.equal(f.frames.size,0);
});
test("input cleanup keeps zone energy normalized rather than using rotation degrees",()=>{
 for(const state of ["listening","finishing","thinking","speaking"]) {
  const f=fixture();f.visual.setState(state);f.visual.inputPulse("typing");f.visual.clearInput();
  for(let n=0;n<3;n++)assert.equal(f.level("zone-"+n),["thinking","speaking"].includes(state) ? .45 : 0);
  f.advance();for(let n=0;n<3;n++)assert.ok(f.level("zone-"+n)>=0&&f.level("zone-"+n)<=1);
 }
});
test("confirmed playback keeps estimated articulation after its text timing has expired",()=>{
 const f=fixture();f.visual.setState("speaking");f.visual.beginSpeech({text:"Hello."});f.advance(330);
 const samples=[];for(let n=0;n<35;n++){f.advance(2);samples.push(f.level("articulation"));}
 assert.ok(Math.max(...samples)-Math.min(...samples)>.15);
 assert.ok(new Set([0,1,2].map(n=>f.level("zone-"+n))).size>1);
 f.visual.setState("paused");f.advance(100);assert.equal(f.energy(),0);
 f.visual.setState("idle");assert.equal(f.frames.size,0);
});
test("continuous microphone samples stay reactive without transcript events and silence settles",()=>{
 const f=fixture();f.visual.setState("listening");
 for(let n=0;n<180;n++){f.visual.inputAudio(.7);f.advance(3);}
 assert.ok(f.level("input")>.5);
 for(let n=0;n<60;n++){f.visual.inputAudio(0);f.advance(1);}
 assert.ok(f.level("input")<.02);
 f.visual.setState("idle");f.visual.inputAudio(1);assert.equal(f.level("input"),0);
});
test("microphone feedback is bounded and reduced motion remains non-flashing",()=>{
 const f=fixture();f.visual.setState("listening");f.visual.inputAudio(99);f.advance(3);assert.ok(f.level("input")<=1);
 f.visual.inputAudio(NaN);f.advance(3);assert.ok(Number.isFinite(f.level("input")));
 f.motion.matches=true;f.listeners.get("motion:change")();f.visual.inputAudio(1);assert.equal(f.level("input"),.35);
 assert.equal(f.frames.size,0);f.visual.inputAudio(0);assert.equal(f.level("input"),.35);f.visual.clearInput();assert.equal(f.level("input"),0);
});
