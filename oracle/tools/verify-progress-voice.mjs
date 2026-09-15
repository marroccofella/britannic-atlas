import assert from 'node:assert/strict';
// Exercise the real UI speech queue with a synthetic speech device. No microphone,
// provider audio service, model calls or user conversations are involved.
export async function installSpeechProbe(page){
 await page.addInitScript(()=>{
  const probe={spoken:[],started:[],cancelled:0,failNext:false,hold:false,timer:null,current:null};
  const synth={speaking:false,pending:false,paused:false,getVoices:()=>[],
   speak(u){probe.spoken.push(u.text);probe.current=u;synth.speaking=true;
    queueMicrotask(()=>{if(probe.current!==u)return;if(probe.failNext){probe.failNext=false;synth.speaking=false;u.onerror?.();return;}probe.started.push(u.text);u.onstart?.();if(!probe.hold)probe.timer=setTimeout(()=>probe.finish(),50);});
   },cancel(){probe.cancelled++;clearTimeout(probe.timer);probe.current=null;synth.speaking=false;synth.pending=false;synth.paused=false;},
   pause(){synth.paused=true;probe.current?.onpause?.();},resume(){synth.paused=false;probe.current?.onresume?.();}};
  probe.finish=()=>{clearTimeout(probe.timer);const u=probe.current;probe.current=null;synth.speaking=false;u?.onend?.();};
  globalThis.speechProbe=probe;Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
 });
}
export async function progressVoiceChecks(page){
 const input=page.locator('#askText'),setting=page.locator('#spokenProgress');
 const setEnabled=enabled=>setting.evaluate((el,value)=>{el.checked=value;el.dispatchEvent(new Event('change'));},enabled);
 const event=(name,data)=>'event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n';
 const finishBody=event('token',{text:'Synthetic audible answer.'})+event('sentence',{text:'Synthetic audible answer.'})+event('meta',{answered:true,status:'local',used:[],nextSteps:[]})+event('done',{});
 async function heldRequest(question){
  let release;const held=new Promise(r=>{release=r;});let requests=0;
  await page.route('**/api/ask',async route=>{requests++;await held;await route.fulfill({status:200,contentType:'text/event-stream',body:finishBody});});
  const start=await page.evaluate(()=>globalThis.speechProbe.spoken.length);await input.fill(question);await page.locator('#askForm').evaluate(el=>el.requestSubmit());
  return {start,requests:()=>requests,release,async close(){release();await page.waitForFunction(n=>globalThis.speechProbe.spoken.slice(n).includes('Synthetic audible answer.'),start);await page.evaluate(()=>globalThis.speechProbe.finish());await page.unroute('**/api/ask');}};
 }
 const waitSpoken=start=>page.waitForFunction(n=>globalThis.speechProbe.started.slice(n).some(t=>t.startsWith('Preparing your request')),start,{timeout:8000});
 assert.equal(await setting.isChecked(),true,'Voice feedback defaults on');
 await page.evaluate(()=>{globalThis.speechProbe.hold=true;});
 const first=await heldRequest('Synthetic spoken progress request');
 try{await waitSpoken(first.start);const cancels=await page.evaluate(()=>globalThis.speechProbe.cancelled);first.release();await page.waitForFunction(()=>globalThis.speechProbe.started.includes('Synthetic audible answer.'));assert.ok(await page.evaluate(n=>globalThis.speechProbe.cancelled>n,cancels),'Answer speech preempts progress');}finally{await first.close();}
 const muted=await heldRequest('Synthetic progress mute request');
 try{await waitSpoken(muted.start);await setEnabled(false);assert.equal(await page.evaluate(()=>speechSynthesis.speaking),false);assert.equal(muted.requests(),1,'Muting audio does not re-dispatch the task');assert.equal(await page.evaluate(()=>localStorage.getItem('oracle.spokenProgress')),'off');}finally{await muted.close();}
 await page.reload();assert.equal(await setting.isChecked(),false,'Explicit mute survives reload');await setEnabled(true);
 await page.evaluate(()=>{globalThis.speechProbe.hold=true;globalThis.speechProbe.failNext=true;});
 const blocked=await heldRequest('Synthetic voice recovery request');
 try{await page.locator('#retryVoice').waitFor({state:'visible',timeout:8000});assert.match(await page.locator('#liveStatus').textContent(),/Voice playback failed/);await page.locator('#retryVoice').click();await page.waitForFunction(()=>globalThis.speechProbe.started.some(t=>t.startsWith('Voice feedback is on.')));assert.equal(blocked.requests(),1,'Voice recovery preserves the active request');await page.evaluate(()=>globalThis.speechProbe.finish());}finally{await blocked.close();}
 await page.evaluate(()=>{globalThis.speechProbe.hold=false;});
 return {defaultSpokenProgress:true,progressReachedSpeechStart:true,answerPreemptsProgress:true,progressMuteDoesNotMuteAnswer:true,mutePersists:true,voiceRecoveryPreservesRequest:true,syntheticSpeechDevice:true};
}
