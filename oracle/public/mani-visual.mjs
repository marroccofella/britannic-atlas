// Articulation follows browser word boundaries, with text timing when a voice
// omits them. Web Speech does not expose audio samples or phoneme measurements.
// Rotation means computation only; listening moves the individual legs.
const SPEED = {thinking:78};
const clamp = (value,low,high) => Math.min(high,Math.max(low,value));
export function speechPlan(text, rate=1) {
  // Plans are bounded to 16k characters. Normal playback is sentence-chunked;
  // exceptionally longer utterances retain only the quiet base glow past this
  // horizon, and out-of-range boundary events are ignored until the next chunk.
  const pace=clamp(Number(rate)||1,.5,2);
  let at=0;
  return [...String(text || "").slice(0,16000).matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*[^\p{L}\p{N}]*/gu)].map(match=>{
    const word=match[0].replace(/[^\p{L}\p{N}'’-]+$/gu,"");
    const syllables=clamp((word.match(/[aeiouy]+/gi)||[word]).length,1,7);
    const duration=clamp(.10+syllables*.11+word.length*.007,.16,.85)/pace;
    const pause=/[.!?]/.test(match[0].slice(word.length)) ? .24/pace : /[,;:]/.test(match[0].slice(word.length)) ? .12/pace : .045/pace;
    const item={index:match.index,end:match.index+word.length,word,syllables,start:at,duration};
    at+=duration+pause; return item;
  });
}
export function createManiVisual(button, platform = globalThis) {
  const rotor=button.querySelector(".mani-rotor");
  const legs=[...(button.querySelectorAll?.(".mani-leg") || [])];
  const systemMotion=platform.matchMedia("(prefers-reduced-motion: reduce)");
  // The system preference is the default, not a verdict. Many Windows machines
  // ship with animations off, which silently removed the only visual sign that
  // Oracle was working, so the user can override it either way.
  let motionPreference="auto";
  const motion={ get matches() { return motionPreference==="on" ? false : motionPreference==="off" ? true : systemMotion.matches; } };
  const clock=()=>platform.performance?.now?.() ?? Date.now();
  let state="idle",angle=0,speed=0,energy=0,articulation=0,impulse=0;
  let inputLevel=0,inputUntil=0,inputKind="",lastFlash=-Infinity,phraseTail=0;
  let audioTarget=0,audioUntil=-Infinity;
  const zones=[0,0,0], rocks=[0,0,0];
  let frame=null,previous=null,destroyed=false,speech=null,pausedAt=null;
  function paint() {
    rotor.setAttribute("transform",`rotate(${angle.toFixed(3)})`);
    legs.forEach((leg,index)=>leg.setAttribute("transform",`rotate(${rocks[index].toFixed(3)})`));
    button.style.setProperty("--mani-energy",energy.toFixed(3));
    button.style.setProperty("--mani-articulation",articulation.toFixed(3));
    button.style.setProperty("--mani-input",inputLevel.toFixed(3));
    zones.forEach((value,index)=>button.style.setProperty(`--mani-zone-${index}`,value.toFixed(3)));
    button.dataset.maniMotion=motion.matches ? "reduced" : "full";
    button.dataset.maniInput=inputKind;
  }
  function cancel() { if(frame!==null) platform.cancelAnimationFrame(frame); frame=null;previous=null; }
  function wake() {
    if(destroyed || motion.matches || platform.document.hidden || frame!==null) return;
    if(SPEED[state] || state==="speaking" || state==="listening" || inputLevel>.001) frame=platform.requestAnimationFrame(tick);
  }
  function tick(now) {
    frame=null;
    if(destroyed || motion.matches || platform.document.hidden) return;
    const dt=previous===null ? 0 : clamp((now-previous)/1000,0,.05); previous=now;
    const rotationSpeed=SPEED[state] || 0;
    if(rotationSpeed) { speed+=(rotationSpeed-speed)*(1-Math.exp(-dt*13));angle=(angle+speed*dt)%360; }
    else speed=0;
    impulse*=Math.exp(-dt*8);
    if(inputKind==="speech" && clock()<=audioUntil) {
      inputLevel+=(audioTarget-inputLevel)*(1-Math.exp(-dt*(audioTarget>inputLevel ? 32 : 10)));
    } else if(clock()>inputUntil) inputLevel*=Math.exp(-dt*7);
    if(inputLevel<.001) { inputLevel=0;inputKind=""; }
    let envelope=0,attack=0,rhythm=0;
    if(state==="speaking") {
      if(speech?.plan.length) {
        const position=(clock()-speech.started)/1000;
        const word=speech.plan.find(item=>position>=item.start && position<item.start+item.duration);
        if(word) {
          const phase=(position-word.start)/word.duration;
          envelope=Math.pow(Math.sin(Math.PI*phase),.6)*(.48+.52*Math.pow(Math.sin(Math.PI*phase*word.syllables),2));
          attack=Math.exp(-phase*7);
          rhythm=Math.pow(Math.sin(Math.PI*phase*word.syllables),2);
        } else if(position>speech.plan.at(-1).start+speech.plan.at(-1).duration+.18) {
          // Playback is still confirmed active. Remote voices can omit boundaries
          // or outlast the estimate: keep gentle estimated, not audio-measured, motion.
          envelope=.28+.22*Math.sin(position*5.1);
          attack=.25+.22*Math.sin(position*4.3+1.2);
          rhythm=.3+.25*Math.sin(position*6.1+2.1);
        }
      } else { envelope=.35+.2*Math.sin(now/170);attack=envelope;rhythm=envelope; }
    }
    const target=state==="speaking" ? clamp(.08+envelope*.82+impulse,0,1) : 0;
    energy+=(target-energy)*(1-Math.exp(-dt*(target>energy ? 30 : 12)));
    articulation=state==="speaking" ? clamp(envelope+impulse,0,1) : 0;
    phraseTail=state==="speaking" ? Math.max(envelope,phraseTail*Math.exp(-dt*3)) : 0;
    // Independent word-onset, estimated syllable, and phrase-tail channels.
    // These are event/text timing, never measured audio amplitude or phonemes.
    const speechZones=[clamp(attack+impulse,0,1),rhythm,phraseTail];
    zones.forEach((_,index)=>{
      const work=SPEED[state] ? .2+.45*Math.pow(.5+.5*Math.sin(now/380-index*2.094),3) : 0;
      zones[index]=clamp(Math.max(work,inputLevel*.9,state==="speaking" ? .12+speechZones[index]*.88 : 0),0,1);
      // A three-step dance around the fixed hub: loudness sets excursion,
      // bounded below ten degrees so the emblem remains recognisable.
      const beat=now/190-index*2.094;
      rocks[index]=state==="listening" ? inputLevel*(8*Math.sin(beat)+2*Math.sin(beat*2)) : 0;
    });
    paint();wake();
  }
  function setState(next) {
    if(destroyed || next===state) return;
    if(next==="paused" && state==="speaking") pausedAt=clock();
    if(next==="speaking" && pausedAt!==null && speech) speech.started+=clock()-pausedAt;
    if(next!=="paused") pausedAt=null;
    state=next;button.dataset.maniState=state;
    rocks.fill(0);
    if(!SPEED[state]) speed=0;
    if(state!=="speaking") { energy=0;articulation=0;impulse=0; }
    else if(motion.matches) energy=.65;
    if(state!=="listening") { inputLevel=0;inputKind="";inputUntil=0;audioTarget=0;audioUntil=-Infinity; }
    phraseTail=0; zones.fill(motion.matches && (SPEED[state] || state==="speaking") ? .45 : 0);
    if(state!=="speaking" && state!=="paused") speech=null;
    cancel();paint();wake();
  }
  function onVisibility() { cancel();if(!platform.document.hidden) { paint();wake(); } }
  function onMotion() { rocks.fill(0);speed=0;energy=state==="speaking" ? (motion.matches ? .65 : .48) : 0;articulation=0;impulse=0;inputLevel=0;inputKind="";phraseTail=0;zones.fill(motion.matches && (SPEED[state] || state==="speaking") ? .45 : 0);cancel();paint();wake(); }
  systemMotion.addEventListener("change",onMotion);
  platform.document.addEventListener("visibilitychange",onVisibility);
  button.dataset.maniState=state;paint();
  return {
    setState,
    /** "auto" follows the system, "on" always animates, "off" never does. */
    setMotionPreference(next) {
      const value=next==="on" || next==="off" ? next : "auto";
      if(value===motionPreference) return;
      motionPreference=value;
      onMotion();
    },
    get reducedMotion() { return motion.matches; },
    inputPulse(kind="typing") {
      if(destroyed || platform.document.hidden) return;
      if(kind==="speech" && state!=="listening") return;
      if(kind==="speech" && clock()<=audioUntil) return; // Live microphone samples outrank delayed transcripts.
      inputKind=kind==="speech" ? "speech" : "typing";
      const now=clock();inputUntil=now+220;
      // Limit full-brightness attacks to 2.5/second; rapid input sustains light.
      if(motion.matches) inputLevel=.35;
      else if(now-lastFlash>=400) { inputLevel=1;lastFlash=now; }
      else inputLevel=Math.max(inputLevel,.65);
      paint();wake();
    },
    inputAudio(value) {
      if(destroyed || platform.document.hidden || state!=="listening") return;
      const level=Number(value);audioTarget=Number.isFinite(level) ? clamp(level,0,1) : 0;
      audioUntil=clock()+160;inputUntil=0;inputKind="speech";
      // Reduced motion shows a steady listening cue, never amplitude flashes.
      if(motion.matches) { inputLevel=.35;paint(); } else wake();
    },
    inputPause(kind) { if(kind && inputKind!==kind) return; inputUntil=0; if(motion.matches) { inputLevel=0;inputKind="";paint(); } else wake(); },
    clearInput(kind) { if(kind && inputKind!==kind) return; audioTarget=0;audioUntil=-Infinity;inputLevel=0;inputKind="";inputUntil=0;zones.fill(SPEED[state] || state==="speaking" ? .45 : 0);paint();wake(); },
    beginSpeech({text,rate=1}={}) { if(destroyed || state!=="speaking") return; speech={plan:speechPlan(text,rate),started:clock(),lastIndex:-1};pausedAt=null;wake(); },
    speechBoundary(event={}) {
      if(destroyed || state!=="speaking" || motion.matches || event===null) return;
      if(event.name && event.name!=="word") return;
      if(speech && event.charIndex!=null) {
        const index=Number(event.charIndex);
        if(!Number.isInteger(index) || index<0 || index<speech.lastIndex) return;
        const word=speech.plan.find(item=>index>=item.index && index<item.end);
        if(!word) return;
        speech.lastIndex=index;speech.started=clock()-word.start*1000;
      }
      impulse=.48;wake();
    },
    destroy() { destroyed=true;cancel();rocks.fill(0);speed=0;energy=0;articulation=0;inputLevel=0;inputKind="";zones.fill(0);speech=null;paint();systemMotion.removeEventListener("change",onMotion);platform.document.removeEventListener("visibilitychange",onVisibility); },
  };
}
