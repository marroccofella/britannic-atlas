import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {installLifecycle} from '../lib/lifecycle.mjs';
import {sourceCatalog} from '../lib/source-catalog.mjs';
import {runLiveTools,trustedPage} from '../lib/live-tools.mjs';
import {resolveDialogue,resolveSavedOffer} from '../lib/dialogue.mjs';

test('startup diagnostics record failure category and exit without private exception text',t=>{
 const dir=mkdtempSync(join(tmpdir(),'mannin-lifecycle-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const p=new EventEmitter();p.pid=123;p.kill=()=>{throw Error('not alive');};
 installLifecycle(dir,p);p.emit('uncaughtExceptionMonitor',Object.assign(new Error('SECRET private request'),{code:'EADDRINUSE'}));p.emit('exit',1);
 const text=readFileSync(join(dir,'lifecycle.jsonl'),'utf8'),rows=text.trim().split('\n').map(JSON.parse);
 assert.deepEqual(rows.map(r=>r.event),['starting','uncaught_exception','exit']);assert.equal(rows.at(-1).code,1);assert.doesNotMatch(text,/SECRET|private request/);
 installLifecycle(dir,p);assert.doesNotMatch(readFileSync(join(dir,'lifecycle.jsonl'),'utf8'),/previous_exit_unobserved/);
});
test('known-source adapters generalise phrasing without becoming answer templates',async()=>{
 for(const q of ['Does a Manx company pay corporation tax on UK property?','A non-UK company without a permanent establishment: which profits rate?','Will an Isle of Man company sell a Belfast property tax-free in Northern Ireland?']){
  const c=sourceCatalog(q);assert.equal(c.family,'UK company taxation');assert.ok(c.urls.every(trustedPage));
 }
 assert.equal(sourceCatalog('What VAT does my UK company charge?'),null);
 assert.equal(sourceCatalog('What is MOMM?'),null);
 const q='Which grants help renovate a Manx hotel?';assert.equal(sourceCatalog(q).family,'Visitor accommodation support');
 const r=await runLiveTools({question:q,request:{name:'read_sources'},get:async url=>({url,headers:{'content-type':'text/html'},body:'<main><p>Public synthetic guidance. Eligibility must be assessed before work begins.</p></main>'}),runModel:()=>{throw Error('No discovery model needed');}});
 assert.equal(r.calls.length,2);assert.equal(r.costUsd,0);assert.equal(r.claims.length,2);
});
test('a clicked historical source offer restores one consistent subject and scope',()=>{
 const a=resolveDialogue('Does a Manx company pay corporation tax on Northern Ireland property?');
 const b=resolveDialogue('For that same company, assume no UK permanent establishment.',a.state);
 const later=resolveDialogue('New topic: population in Douglas?',b.state);
 const restored=resolveSavedOffer({subject:b.canonical,jurisdiction:b.jurisdiction},later.state,{turnId:'retry',clientTurn:4});
 assert.equal(restored.canonical,b.canonical);assert.equal(restored.state.lastAnswerSubject,b.canonical);
 assert.equal(restored.state.lastSubstantiveTurn.semanticKey,restored.semanticKey);
 assert.doesNotMatch(resolveDialogue('For that same company, what rate applies?',restored.state).canonical,/population/i);
});
