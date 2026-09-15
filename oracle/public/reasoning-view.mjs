import {normaliseReasoningCheck,reasoningReadback} from './reasoning-check.mjs';
export function renderReasoningCheck(turn,value,{readAloud=()=>{}}={}){
 turn.querySelector('.reasoningCheck')?.remove();const check=normaliseReasoningCheck(value);if(!check)return;
 const doc=turn.ownerDocument,details=doc.createElement('details');details.className='reasoningCheck';
 const add=(tag,text,parent=details)=>{const node=doc.createElement(tag);node.textContent=text;parent.appendChild(node);return node;};
 add('summary','Reasoning check · assumptions, gaps and next steps');add('p','This assessment is saved with the conversation. It does not verify facts or run actions. These are checks Mani applies, not a questionnaire you must complete.');
 add('p',check.objective);const read=add('button','Read reasoning check aloud');read.type='button';read.addEventListener('click',()=>readAloud(reasoningReadback(check)));
 add('p','Selected checks: '+check.methods.map(m=>m.name).join('; ')+'. These labels describe the approach, not completed verification.');
 const checks=add('dl','');for(const item of check.checks){add('dt',item.question,checks);add('dd',item.note,checks);}
 const section=(title,items)=>{if(!items.length)return;add('h4',title);const ul=add('ul','');for(const text of items)add('li',text,ul);};
 section('Source checks',check.sourceChecks.map(s=>s.note));section('Assumptions to check',check.assumptions);section('Possible weaknesses',check.weaknesses.map(w=>w.issue+' — Proposed test: '+w.test));section('Proposed improvements',check.opportunities.map(o=>o.change+' — Success test: '+o.successTest+(o.tradeOff?' — Trade-off: '+o.tradeOff:'')));section('Counterexamples to test',check.counterexamples);
 if(check.nextStep)add('p','Proposed next step: '+check.nextStep);
 if(check.sources.length){add('h4','Cited source links');const seen=new Set();for(const source of check.sources){if(seen.has(source.url))continue;seen.add(source.url);const p=add('p',''),link=add('a',source.title||source.url,p);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';}}
 turn.appendChild(details);return details;
}
