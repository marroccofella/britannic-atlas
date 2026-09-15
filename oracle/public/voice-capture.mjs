// Browser recognition is a fallible transport, not a conversation boundary.
// No audio is recorded here. Ambient wake transcripts never reach onDraft/onSubmit.
const join = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
export function wakeRequest(text) {
  const match = /^\s*hey[\s,]+(?:mannin|mannín|manin|manon|mani|manny|money)\b[\s,.:;!?-]*(.*)$/iu.exec(String(text || ''));
  return match ? match[1].trim() : null;
}
export function incompleteSpeech(text) { return /\b(?:if|the|a|an|and|or|to|for|of|with|about|because|that|which|whether)[.!?,\s]*$/i.test(text); }
export function createVoiceCapture({ Recognition, platform=globalThis, onState=()=>{}, onDraft=()=>{}, onSubmit=()=>{}, onStatus=()=>{}, onActive=()=>{}, onInput=()=>{}, onWake=()=>{}, onFatal=()=>{}, onMeter=()=>{} }) {
  let mode='off', recognizer=null, started=false, closing=false, serial=0, failures=0;
  let prefix='', final='', interim='', confidence=null, forceConfirm=false;
  const timers=new Map();
  const now=()=>platform.performance?.now?.() ?? Date.now();
  function clear(name) { platform.clearTimeout(timers.get(name));timers.delete(name); }
  function later(name, fn, ms) { clear(name);timers.set(name,platform.setTimeout(()=>{timers.delete(name);fn();},ms)); }
  function clearTimers() { for(const name of [...timers.keys()])clear(name); }
  function release(abort=true) {
    const old=recognizer;recognizer=null;started=false;onActive(null);onMeter(false);
    clear('startup');clear('stop');
    if(abort)try{old?.abort();}catch{/* already ended */}
  }
  function cancel() { serial++;mode='off';closing=false;clearTimers();release();onState('idle'); }
  function finish() {
    if(mode==='off')return;
    const text=join(prefix,final,interim), conf=confidence;
    const needsConfirmation=forceConfirm || Boolean(interim) || incompleteSpeech(text);
    cancel();
    if(text)onSubmit({text,confidence:conf,needsConfirmation});
    else onStatus('No words received. Click Mannin to try again, or type your question.');
  }
  function settle() {
    if(mode!=='capture' || closing)return;
    // Browser-final words can be only the first clause. Allow a natural pause.
    later('quiet',finish,interim || incompleteSpeech(join(prefix,final)) ? 4500 : 2400);
  }
  function recoverInterim() {
    forceConfirm=true;onState('finishing');
    onStatus('The microphone disconnected. Keeping the unfinished words for you to check.');
    later('quiet',finish,2400);
  }
  function start(next='capture') {
    cancel();
    if(!Recognition || platform.document?.hidden)return;
    mode=next==='wake'?'wake':'capture';prefix='';final='';interim='';confidence=null;forceConfirm=false;failures=0;
    if(mode==='capture')later('limit',()=>{forceConfirm=true;finish();},90000);
    open();
  }
  function fatal(message) { cancel();onStatus(message);onFatal(message); }
  function retry(reason, elapsed=0) {
    if(mode==='off' || closing)return;
    if(elapsed>=5000)failures=0;
    if(++failures>3){forceConfirm=true;if(join(prefix,final,interim)){finish();onStatus('Recognition kept disconnecting. Your words were kept for you to check.');onFatal('Recognition disconnected. Click to retry.');}else fatal('Recognition kept disconnecting. Click Mannin to retry, or type below.');return;}
    onState(mode==='wake'?'wake':'listening');
    onStatus(mode==='wake'?'Wake microphone reconnecting…':`Reconnecting the microphone — your words are safe. ${reason}`);
    later('retry',open,Math.min(500*2**(failures-1),4000));
  }
  function open() {
    if(mode==='off' || recognizer || platform.document?.hidden)return;
    const token=serial, opened=now();let r;
    try{r=new Recognition();}catch{fatal('I couldn’t open the microphone. Click Mannin to retry, or type your question.');return;}
    recognizer=r;started=false;onActive(r);onState(mode==='wake'?'wake':'starting');
    r.lang='en-GB';r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
    let captureIndex=0, wakeIndex=-1, wakeTail='', seenWake=0, pendingHey=false;
    const current=()=>token===serial && recognizer===r && mode!=='off';
    r.onstart=()=>{
      if(!current()){try{r.abort();}catch{/* This recognizer was already cancelled. */}return;}
      started=true;clear('startup');
      onState(mode==='wake'?'wake':'listening');onMeter(mode==='capture');
      onStatus(mode==='wake'?'Wake microphone on · say “Hey Mannin” or “Hey money”.':'Listening. Take your time; tap Mannin to send when you’re finished.');
    };
    r.onspeechstart=()=>{if(current() && started && mode==='capture' && !closing){clear('quiet');onInput('start');}};
    r.onspeechend=()=>{if(current() && started && mode==='capture' && !closing){onInput('pause');if(join(prefix,final,interim))settle();}};
    r.onresult=event=>{
      if(!current() || !started)return;
      const results=[...event.results];
      if(mode==='wake'){
        for(let i=seenWake;i<results.length;i++){
          if(!results[i].isFinal)break;
          seenWake=i+1;
          const text=String(results[i][0]?.transcript||'');
          const tail=wakeRequest(pendingHey ? 'Hey '+text : text);
          pendingHey=/^\s*hey[\s,.!?]*$/i.test(text);
          if(tail===null)continue;
          mode='capture';captureIndex=i;wakeIndex=i;wakeTail=tail;onWake();onState('listening');onMeter(true);
          later('limit',()=>{forceConfirm=true;finish();},90000);
          onStatus('I’m here. What would you like to know?');break;
        }
        if(mode==='wake')return;
      }
      let nextFinal='',nextInterim='';const scores=[];
      for(let i=captureIndex;i<results.length;i++){
        const row=results[i], text=i===wakeIndex?wakeTail:String(row[0]?.transcript||'');
        if(row.isFinal){nextFinal=join(nextFinal,text);const score=Number(row[0]?.confidence);if(text && Number.isFinite(score) && score>0)scores.push(score);}
        else nextInterim=join(nextInterim,text);
      }
      final=nextFinal;interim=nextInterim;
      if(scores.length)confidence=Math.min(confidence??1,...scores);
      if(join(prefix,final,interim).length>2000){prefix=join(prefix,final,interim).slice(0,2000);final='';interim='';forceConfirm=true;finish();return;}
      onDraft({final:join(prefix,final),interim});onInput('words');
      if(closing){if(!interim)finish();}
      else if(join(prefix,final,interim))settle();
    };
    r.onerror=e=>{
      if(!current())return;
      const code=e.error;
      if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(code)){
        const draft=join(prefix,final,interim);cancel();
        onFatal('Microphone unavailable.');
        onStatus(code==='not-allowed' || code==='service-not-allowed'?'Microphone access is blocked. Allow it in your browser, then click to retry.':'Speech recognition is unavailable. Check your microphone and browser, or type below.');
        if(draft)onDraft({final:draft,interim:''});return;
      }
      release();
      if(closing){finish();return;}
      prefix=join(prefix,final);final='';
      if(interim){recoverInterim();return;}
      retry(code==='no-speech'?'Still waiting for your question.':'',now()-opened);
    };
    r.onend=()=>{
      if(!current())return;
      release(false);
      if(closing){finish();return;}
      prefix=join(prefix,final);final='';
      if(interim){recoverInterim();return;}
      retry('',now()-opened);
    };
    later('startup',()=>{if(current()){release();retry('The browser did not open the microphone.');}},8000);
    try{r.start();}catch{release();fatal('I couldn’t open the microphone. Click Mannin to retry, or type your question.');}
  }
  function stop({awaitFinal=false,discard=false}={}) {
    if(!discard && awaitFinal && mode==='capture' && !started && join(prefix,final,interim)){finish();return;}
    if(discard || !awaitFinal || mode==='wake' || !started){cancel();return;}
    closing=true;clear('quiet');clear('retry');onMeter(false);onState('finishing');
    later('stop',finish,1500);
    try{recognizer?.stop();}catch{finish();}
  }
  return {start,stop,cancel,get mode(){return mode;},get active(){return recognizer;}};
}
