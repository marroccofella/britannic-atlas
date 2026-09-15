// Local RMS meter only: no recording, audio playback, network or stored samples.
export function createManiMicrophone(visual, platform=globalThis, onMode=()=>{}) {
  let generation=0, active=null, destroyed=false;
  function release(run) {
    if(!run) return;
    if(run.timer!=null) platform.clearTimeout(run.timer);run.timer=null;
    run.cancel?.();run.cancel=null;
    if(run.frame!=null) platform.cancelAnimationFrame(run.frame);
    run.frame=null;
    for(const track of run.stream?.getTracks()||[]) track.stop();
    run.stream=null;
    try { run.source?.disconnect(); } catch { /* already disconnected */ }
    run.source=null;
    try { const closing=run.context?.close(); closing?.catch?.(()=>{}); } catch { /* already closed */ }
    run.context=null;
  }
  function stop() {
    generation++;const old=active;active=null;release(old);
    visual.clearInput("speech");onMode("idle");
  }
  const onVisibility=()=>{if(platform.document?.hidden) stop();};
  platform.document?.addEventListener?.("visibilitychange",onVisibility);
  async function start() {
    stop();
    if(destroyed || platform.document?.hidden) return false;
    const AudioContext=platform.AudioContext||platform.webkitAudioContext;
    if(!AudioContext || !platform.navigator?.mediaDevices?.getUserMedia) { onMode("transcript");return false; }
    const run={generation,frame:null,stream:null,context:null,source:null};active=run;
    const current=()=>active===run && generation===run.generation && !destroyed;
    onMode("requesting");
    try {
      run.stream=await platform.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!current()) { release(run);return false; }
      run.context=new AudioContext();
      const analyser=run.context.createAnalyser();analyser.fftSize=1024;
      run.source=run.context.createMediaStreamSource(run.stream);run.source.connect(analyser);
      await Promise.race([run.context.resume(),new Promise((_,reject)=>{
        run.cancel=()=>reject(Error("Microphone metering cancelled"));
        run.timer=platform.setTimeout(()=>reject(Error("Audio meter startup timed out")),2000);
      })]);
      platform.clearTimeout(run.timer);run.timer=null;run.cancel=null;
      if(!current()) { release(run);return false; }
      if(run.context.state==="suspended" || run.context.state==="closed") throw Error("Audio meter unavailable");
      const samples=new Float32Array(analyser.fftSize);
      const tick=()=>{
        run.frame=null;
        if(!current()) return;
        if(platform.document?.hidden) { stop();return; }
        try {
          analyser.getFloatTimeDomainData(samples);
          let square=0;for(const sample of samples) square+=sample*sample;
          const rms=Math.sqrt(square/samples.length);
          visual.inputAudio(Math.min(1,Math.max(0,(rms-.008)*14)));
          run.frame=platform.requestAnimationFrame(tick);
        } catch { if(current()) { stop();onMode("transcript"); } }
      };
      onMode("microphone");tick();return true;
    } catch {
      release(run);
      if(current()) { active=null;visual.clearInput("speech");onMode("transcript"); }
      return false;
    }
  }
  return {start,stop,destroy(){stop();destroyed=true;platform.document?.removeEventListener?.("visibilitychange",onVisibility);}};
}
