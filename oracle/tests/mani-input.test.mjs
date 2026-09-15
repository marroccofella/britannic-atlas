import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { bindManiInput } from "../public/mani-input.mjs";
test("both editable inputs pulse on actual edits, clear after inactivity and detach cleanly",()=>{
  const fields=[new EventTarget(),new EventTarget()],calls=[],timers=new Map();let id=0;
  const visual={inputPulse:k=>calls.push(`pulse:${k}`),clearInput:k=>calls.push(`clear:${k}`)};
  const binding=bindManiInput(fields,visual,{setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
  fields[0].dispatchEvent(new Event("focus"));assert.equal(calls.length,0);
  fields.forEach(f=>f.dispatchEvent(new Event("input")));assert.deepEqual(calls,["pulse:typing","pulse:typing"]);assert.equal(timers.size,1);
  [...timers.values()][0]();assert.equal(calls.at(-1),"clear:typing");assert.equal(timers.size,0);
  fields[0].dispatchEvent(new Event("input"));fields[0].dispatchEvent(new Event("blur"));assert.equal(timers.size,0);
  binding.destroy();const count=calls.length;fields[0].dispatchEvent(new Event("input"));assert.equal(calls.length,count);
});
test("export embeds the live feedback controller and all five preview states",()=>{
  const read=name=>readFileSync(new URL(`../public/${name}`,import.meta.url),"utf8");
  const svg=read("mani.svg"),driver=read("mani-visual.mjs").replace(/export function /g,"function ");
  assert.ok(svg.includes(driver));assert.ok(svg.includes(read("mani-feedback.css")));
  for(const mode of ["listening","thinking","speaking","typing","idle"])assert.ok(svg.includes(`data-mode="${mode}"`));
  assert.equal((svg.match(/class="mani-zone mani-zone-/g)||[]).length,3);
  assert.ok(svg.includes("no microphone recording or audio playback"));
});

test("live and exported feedback reuse the traced legs inside the same rotor, with no detached connector",()=>{
  for(const file of ["index.html","mani.svg"]) {
    const markup=readFileSync(new URL(`../public/${file}`,import.meta.url),"utf8");
    assert.match(markup,/<g class="mani-rotor">\s*<use class="mani-outline" href="#mani-trace" filter="url\(#maniTraceGlow\)"\/>\s*<g id="mani-trace">/);
    assert.equal((markup.match(/id="mani-trace"/g)||[]).length,1);
    assert.equal((markup.match(/id="maniTraceGlow"/g)||[]).length,1);
    assert.doesNotMatch(markup,/<path class="mani-outline"/);
    assert.match(markup,/<feMorphology in="SourceAlpha"/);
  }
  const feedback=readFileSync(new URL("../public/mani-feedback.css",import.meta.url),"utf8");
  assert.match(feedback,/\.mani-outline\s*\{\s*opacity: clamp\(0, calc\(var\(--mani-input, 0\)/);
});

test("preview motion labels follow system changes and demos resume after back navigation",()=>{
  const exporter=readFileSync(new URL("../tools/export-mani.mjs",import.meta.url),"utf8");
  const script=exporter.split("const preview=String.raw`")[1].split("\n`;")[0];
  const events=new Map(),timers=new Map(),root={dataset:{}},label={},toggle=new EventTarget(),location={hash:"#typing"};let id=0,clears=0;
  const motion=new EventTarget();motion.matches=false;
  const visual={get reducedMotion(){return motion.matches;},setMotionPreference(){},clearInput(){clears++;},setState(){},inputPulse(){},inputPause(){}};
  const document={documentElement:root,querySelector:s=>s==="#motionLabel"?label:toggle,querySelectorAll:()=>[]};
  runInNewContext(script,{document,createManiVisual:()=>visual,matchMedia:()=>motion,location,localStorage:{getItem:()=>"auto"},
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),window:{addEventListener:(name,fn)=>events.set(name,fn)}});
  assert.match(label.textContent,/Full animation/);motion.matches=true;motion.dispatchEvent(new Event("change"));
  assert.match(label.textContent,/Motion reduced/);
  assert.ok(timers.size>0);events.get("pagehide")();assert.equal(timers.size,0);
  events.get("pageshow")({persisted:true});assert.ok(timers.size>0);
  location.hash="#idle";events.get("hashchange")();assert.equal(timers.size,0);
  events.get("keydown")({key:"a"});assert.equal(timers.size,1,"manual input must expire even without animation frames");
  const before=clears;[...timers.values()][0]();assert.equal(clears,before+1);
});
test("standalone preview changes cannot disable the live app animation preference",()=>{
 const exporter=readFileSync(new URL("../tools/export-mani.mjs",import.meta.url),"utf8");
 const script=exporter.split("const preview=String.raw`")[1].split("\n`;")[0];
 const keys=[],toggle=new EventTarget(),motion=new EventTarget();motion.matches=false;
 const visual={reducedMotion:false,setMotionPreference(){},clearInput(){},setState(){}};
 runInNewContext(script,{document:{documentElement:{dataset:{}},querySelector:s=>s==="#motionLabel"?{}:toggle,querySelectorAll:()=>[]},createManiVisual:()=>visual,matchMedia:()=>motion,location:{hash:"#idle"},
 localStorage:{getItem:key=>{keys.push(key);return "auto";},setItem:key=>keys.push(key)},clearTimeout(){},window:{addEventListener(){}}});
 toggle.dispatchEvent(new Event("click"));assert.deepEqual(keys,["oracle.preview.motion","oracle.preview.motion"]);
});
