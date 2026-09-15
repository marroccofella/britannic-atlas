// Operational status only. A heartbeat confirms a connection, never new work.
export const ACTIVITY_LABELS=Object.freeze({preparing:'Preparing your request',retrieving:'Looking in the knowledge base',searching:'Searching the web',reading:'Reading a source',thinking:'Preparing the answer',writing:'Writing the answer',checking:'Checking the answer and citations',saving:'Updating the knowledge index',reviewing:'MOMM review',synthesising:'Combining the reviewer responses',research:'Researching your question',visual:'Preparing your visual'});
// eslint-disable-next-line no-control-regex -- remove transport control characters from display text
const bounded=s=>String(s||'').replace(/[\u0000-\u001f]/g,' ').slice(0,170);
const monotonicNow=()=>globalThis.performance?.now?.()??Date.now();
const elapsed=ms=>{const n=Math.floor(Math.max(0,ms)/1000);return n<60?n+'s':Math.floor(n/60)+'m '+n%60+'s';};
export function toolActivity(tool){
 const phases={search_web:'searching',plan_lookup:'preparing',read_page:'reading',read_sources:'reading',get_town_weather:'reading',get_weather:'reading',get_forecast:'reading',get_news:'reading'};
 const phase=phases[tool?.name];if(!phase)return null;
 if(tool.status==='working')return {phase};
 if(tool.status==='unavailable')return {phase:'preparing',detail:'A source check was unavailable. Waiting for the next step.'};
 return tool.status==='complete'?{phase:'preparing',detail:'Source check returned. Preparing the next step.'}:null;
}
export function createActivityStore({clock=monotonicNow}={}){
 const tasks=new Map();
 return {
  start(id,phase='preparing'){if(!id)return;for(const [key,t]of tasks)if(t.terminal)tasks.delete(key);tasks.delete(id);const now=clock();tasks.set(id,{id,phase:ACTIVITY_LABELS[phase]?phase:'preparing',started:now,changed:now,received:now,detail:'',terminal:null,history:[]});},
  update(id,{phase,detail='',heartbeat=false}={}){const t=tasks.get(id);if(!t||t.terminal)return;const now=clock();t.received=now;if(heartbeat)return;if(!ACTIVITY_LABELS[phase])return;const text=bounded(detail);if(t.phase!==phase||t.detail!==text){t.history.push(ACTIVITY_LABELS[t.phase]+(t.detail?' — '+t.detail:''));t.history=t.history.slice(-4);t.changed=now;}t.phase=phase;t.detail=text;},
  finish(id,status='complete'){const t=tasks.get(id);if(!t||t.terminal)return;t.terminal=['complete','failed','stopped','paused'].includes(status)?status:'failed';t.changed=clock();t.received=t.changed;},
  clear(){tasks.clear();},
  snapshot(){const now=clock();for(const [id,t]of tasks)if(t.terminal&&now-t.changed>8000)tasks.delete(id);return [...tasks.values()].map(t=>{const disconnected=!t.terminal&&now-t.received>=20000,waiting=!t.terminal&&now-t.changed>=15000;return {...t,history:[...t.history],elapsed:elapsed((t.terminal?t.changed:now)-t.started),age:now-t.started,disconnected,waiting,title:t.terminal?({complete:'Finished',failed:'Could not finish',stopped:'Stopped',paused:'Live updates paused'})[t.terminal]:disconnected?'Waiting for a connection update':ACTIVITY_LABELS[t.phase],note:t.terminal==='paused'?'Server work may still be running. Reopen the conversation to check.':disconnected?'No recent connection update. Completion is not confirmed.':waiting?'Still waiting for the next result. You can interrupt or ask another question.':t.detail};});}
 };
}
export function createProgressSpeechGate({clock=monotonicNow}={}){
 let spokenAt=-Infinity;const announced=new Map();
 return {reset(){spokenAt=-Infinity;announced.clear();},next(tasks,{enabled=true,busy=false,hidden=false,listening=false}={}){
  // Coalesce changes while the channel is occupied: speak the current stage,
  // never replay an obsolete queue of status messages over the user's answer.
  for(const id of announced.keys())if(!tasks.some(t=>t.id===id&&!t.terminal))announced.delete(id);
  if(!enabled||busy||hidden||listening)return null;
  const now=clock();if(now-spokenAt<6000)return null;
  const candidates=tasks.filter(t=>!t.terminal&&t.age>=1000).map(t=>({t,key:t.title+'|'+t.note,last:announced.get(t.id)}))
   .filter(({key,last})=>!last||last.key!==key||now-last.at>=20000)
   .sort((a,b)=>(a.last?.at??-Infinity)-(b.last?.at??-Infinity)||tasks.indexOf(b.t)-tasks.indexOf(a.t));
  const candidate=candidates[0];if(!candidate)return null;
  const {t,key}=candidate;spokenAt=now;announced.set(t.id,{key,at:now});
  return t.title+'.'+(t.note?' '+t.note:'');
 }};
}
export function mountActivityProgress(root,{announce=()=>{},speak=()=>{},speechOptions=()=>({}),clock=monotonicNow}={}){
 const store=createActivityStore({clock}),gate=createProgressSpeechGate({clock});let timer=null,lastAnnouncement='';const rows=new Map();
 const header=document.createElement('strong');header.className='activityHeading';const list=document.createElement('div');list.className='activityList';const voiceStatus=document.createElement('small');voiceStatus.className='activityVoice';root.append(header,voiceStatus,list);
 function render(){const tasks=store.snapshot(),active=tasks.filter(t=>!t.terminal),options=speechOptions();voiceStatus.textContent=options.enabled?'Progress voice on':'Progress voice off';root.hidden=!tasks.length;header.textContent=active.length>1?'Working on '+active.length+' tasks':active.length?'Happening now':'Latest activity';
  for(const [id,row]of rows)if(!tasks.some(t=>t.id===id)){row.el.remove();rows.delete(id);}
  for(const t of tasks){let row=rows.get(t.id);if(!row){const el=document.createElement('article'),heading=document.createElement('p'),title=document.createElement('span'),time=document.createElement('span'),note=document.createElement('p'),details=document.createElement('details'),summary=document.createElement('summary'),history=document.createElement('ul');el.className='activityRow';heading.className='activityLine';time.className='activityElapsed';time.setAttribute('aria-hidden','true');note.className='activityNote';summary.textContent='Activity details';details.append(summary,history);heading.append(title,time);el.append(heading,note,details);list.append(el);row={el,title,time,note,details,history};rows.set(t.id,row);}row.el.dataset.phase=t.terminal||t.phase;row.title.textContent=t.title;row.time.textContent=t.elapsed;row.note.textContent=t.note;row.note.hidden=!t.note;row.details.hidden=!t.history.length;const history=t.history.join('\n');if(row.history.dataset.snapshot!==history){row.history.replaceChildren(...t.history.map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));row.history.dataset.snapshot=history;}}
  const changed=tasks.filter(t=>rows.get(t.id).announcement!==t.title+'|'+t.note);for(const t of changed)rows.get(t.id).announcement=t.title+'|'+t.note;const announcement=changed.map(t=>t.title+(t.note?'. '+t.note:'')).join(' ');if(announcement&&announcement!==lastAnnouncement){lastAnnouncement=announcement;announce(announcement);}const line=gate.next(tasks,options);if(line)speak(line);
  if(!tasks.length&&timer){clearInterval(timer);timer=null;}
 }
 function update(fn){fn();render();if(store.snapshot().length&&!timer)timer=setInterval(render,1000);}
 return {start:(id,phase)=>update(()=>store.start(id,phase)),update:(id,event)=>update(()=>store.update(id,event)),finish:(id,status)=>update(()=>store.finish(id,status)),heartbeat:(id)=>update(()=>store.update(id,{heartbeat:true})),heartbeatBackground:()=>update(()=>{for(const t of store.snapshot())if(!t.id.startsWith('answer:'))store.update(t.id,{heartbeat:true});}),clear:()=>{store.clear();gate.reset();lastAnnouncement='';render();},render,snapshot:()=>store.snapshot(),destroy(){if(timer)clearInterval(timer);timer=null;store.clear();root.replaceChildren();root.hidden=true;}};
}
