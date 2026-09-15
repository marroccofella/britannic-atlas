// Export the exact app artwork, styling and controller; no separate animation engine.
import { readFileSync, writeFileSync } from "node:fs";
const publicDir=new URL("../public/",import.meta.url);
const read=name=>readFileSync(new URL(name,publicDir),"utf8");
const html=read("index.html"),traced=read("mani-triskelion.svg"),css=read("style.css");
const drawing=traced.match(/<g transform=[\s\S]*<\/g>/)?.[0];
const artwork=html.match(/<svg class="mani-art"[\s\S]*?<\/svg>/)?.[0];
if(!drawing || !artwork) throw new Error("Mani source artwork was not found.");
const scene=artwork.slice(artwork.indexOf(">")+1,artwork.lastIndexOf("</svg>"))
  .replace(/<image id="mani-source" href="\/mani-triskelion.svg"[^>]*\/>/,'<g id="mani-source">'+drawing+'</g>');
const baseStyle=css.slice(css.indexOf(".mani-art"),css.indexOf(".heard"));
const driver=read("mani-visual.mjs").replace(/export function /g,"function ");
const controls=[["listening","Listening",-625,548,410],["thinking","Thinking",-205,548,410],["speaking","Speaking",215,548,410],["typing","Typing",-625,712,620],["idle","Idle",5,712,620]];
const links=controls.map(([id,label,x,y,width])=>`<a href="#${id}" data-mode="${id}" aria-label="Preview ${label.toLowerCase()}"><rect x="${x}" y="${y}" width="${width}" height="144" rx="24"/><text x="${x+width/2}" y="${y+88}">${label}</text></a>`).join("\n");
const preview=String.raw`
const root=document.documentElement,visual=createManiVisual(root);
let timers=[],manualInputTimer=null;
const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
function updateMotionLabel() {
  document.querySelector("#motionLabel").textContent=visual.reducedMotion ? "Motion reduced · enable animation" : "Full animation · reduce motion";
}
function motion(value) { visual.setMotionPreference(value);updateMotionLabel(); }
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change",updateMotionLabel);
try { motion(localStorage.getItem("oracle.preview.motion")||"auto"); } catch { motion("auto"); }
document.querySelector("#motionToggle").addEventListener("click",event=>{
  event.preventDefault();const choice=visual.reducedMotion ? "on" : "off";motion(choice);
  try { localStorage.setItem("oracle.preview.motion",choice); } catch { /* local storage is optional */ }
});
function activate() {
  clearTimeout(manualInputTimer);manualInputTimer=null;
  timers.forEach(clearTimeout);timers=[];visual.clearInput();
  const candidate=location.hash.slice(1),mode=["listening","thinking","speaking","typing"].includes(candidate)?candidate:"idle";
  root.dataset.previewMode=mode;
  for(const link of document.querySelectorAll("[data-mode]")) link.setAttribute("aria-current",String(link.dataset.mode===mode));
  visual.setState(mode==="typing" ? "idle" : mode);
  function cycle() {
    if(mode==="speaking") {
      const text="Hello. I am Mannin, the oracle for the Isle of Man. These lights follow the words, their rhythm, and the pauses.";
      visual.beginSpeech({text,rate:1});
      const plan=speechPlan(text),last=plan.at(-1);
      later(cycle,(last.start+last.duration+.8)*1000);
    } else if(mode==="typing" || mode==="listening") {
      const kind=mode==="typing" ? "typing" : "speech";
      for(const delay of [0,160,340,600,900,1420,1840]) later(()=>visual.inputPulse(kind),delay);
      later(()=>visual.inputPause(kind),2050);
      later(cycle,3300);
    }
  }
  cycle();
}
window.addEventListener("hashchange",activate);
window.addEventListener("keydown",event=>{
  if(!event.ctrlKey && !event.metaKey && !event.altKey && (event.key.length===1 || event.key==="Backspace")) {
    visual.inputPulse("typing");clearTimeout(manualInputTimer);
    manualInputTimer=setTimeout(()=>{manualInputTimer=null;visual.clearInput("typing");},700);
  }
});
window.addEventListener("pagehide",()=>{timers.forEach(clearTimeout);clearTimeout(manualInputTimer);manualInputTimer=null;visual.clearInput();});
window.addEventListener("pageshow",event=>{if(event.persisted) {updateMotionLabel();activate();}});
activate();
`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-640 -700 1280 1760" aria-labelledby="title desc">
<title id="title">Mannin — interactive animation preview</title>
<desc id="desc">Simulated input and speech only: no microphone recording or audio playback. Only thinking rotates the Three Legs. Listening rocks each leg independently; typing illuminates the trace. The circular halo appears only while speaking, using estimated word, syllable and phrase timing. Open Mannin for the working voice interface.</desc>
<style>
svg { background:#080a0a; color:#00ff99; width:100%; height:100%; }
${baseStyle}
${read("mani-feedback.css")}
text { fill:#7dffc4; font:38px ui-monospace,monospace; text-anchor:middle; }
.heading { font-size:46px; } .caption { fill:#8dac9b; font-size:29px; }
a rect { fill:#0b1912;stroke:#25553e;stroke-width:2; }
a:hover rect,a:focus rect,a[aria-current="true"] rect { stroke:#00ff99;fill:#12452e; }
#motionLabel { font-size:30px; } [data-mani-motion="reduced"] #motionLabel { fill:#ffc860; }
</style>
<text class="heading" y="-622">Mannin · animation preview</text>
<text class="caption" y="-568">Simulated input and speech · type a key to test</text>
<g class="scene" transform="scale(.82)">${scene}</g>
${links}
<a id="motionToggle" href="#motion-on" aria-label="Toggle preview animation"><text id="motionLabel" y="918">Motion preference</text></a>
<a href="/" aria-label="Open Mannin for microphone and spoken answers"><text y="997">Open Mannin for voice ↗</text></a>
<script><![CDATA[
(()=>{
${driver}
${preview}
})();
]]></script>
</svg>\n`;
writeFileSync(new URL("mani.svg",publicDir),svg);
console.log(`Exported self-contained Mannin SVG (${svg.length.toLocaleString()} bytes).`);
