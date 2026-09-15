import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {KnowledgeBase} from '../../lib/kb.mjs';
import {VectorStore} from '../../lib/vector-store.mjs';
import {ManxRetrieval} from '../../lib/manx-retrieval.mjs';
import {knowledgeMap} from '../../lib/knowledge-map.mjs';
import {resolveDialogue} from '../../lib/dialogue.mjs';
import {assessTests} from '../../tools/verification-results.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
test('full gate discovers nested tests covered by the canonical test command',()=>{
 const runner=fs.readFileSync(new URL('../../tools/verify-mani.mjs',import.meta.url),'utf8');
 const pattern=runner.match(/'([^']*oracle\/tests\/[^']+)'/)[1];
 const fixture='oracle/tests/nested/mani-review.test.mjs';
 assert.ok([...fs.globSync('oracle/tests/**/*.test.mjs',{cwd:root})].map(p=>p.replaceAll('\\','/')).includes(fixture));
 assert.ok([...fs.globSync(pattern,{cwd:root})].map(p=>p.replaceAll('\\','/')).includes(fixture),'full verification omitted this nested regression file');
});
test('answer retrieval does not rehash the entire ledger to check index availability',async t=>{
 const kb=new KnowledgeBase(':memory:'),store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});
 const retrieval=new ManxRetrieval(kb,null,{store,getEmbedder:async()=>({countTokens:s=>s.split(/\s+/).length,embed:async texts=>texts.map(()=>[1,0,0])})});t.after(()=>{retrieval.close();kb.close();});
 for(let i=0;i<200;i++)kb.upsertClaim({text:`Fixture ferry harbour entry ${i} supports public transport.`,topic:'ferries',jurisdiction:'IM',sources:[{url:'https://www.gov.im/fixture/'}],support:2});
 await retrieval.syncLedger();let reads=0;const get=kb.getClaim.bind(kb);kb.getClaim=id=>{reads++;return get(id);};await retrieval.focus('ferry harbour');assert.ok(reads<=50,`answer unnecessarily read ${reads} claims`);
});
test('an unrelated pending action cannot supply the learning jurisdiction',()=>{
 const prior=resolveDialogue('Tell me about Manx ferries.').state;
 const next=resolveDialogue('Learn more about that.',{...prior,lastAnswerSubject:'ferries',lastAnswerJurisdiction:'Isle of Man',pendingAction:{kind:'open_page',jurisdiction:'France',status:'offered'}});
 assert.equal(next.jurisdiction,'Isle of Man');
});
test('repeated learning keeps the subject label instead of nesting a research brief',()=>{
 const first=resolveDialogue('Learn about the TT races.');
 const next=resolveDialogue('Learn more about that.',{...first.state,pendingAction:first.pendingAction});
 assert.equal((next.canonical.match(/established facts/g)||[]).length,1);assert.equal(next.pendingAction.label,first.pendingAction.label);
});
test('an ordinary factual topic remains learnable after its research offer was consumed',()=>{
 const prior=resolveDialogue('Tell me about Manx ferries.').state;
 assert.equal(resolveDialogue('Learn more about that.',{...prior,pendingAction:null}).route,'research');
});
test('limited spoken maps explicitly restrict counts and dates to their sample',t=>{
 const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());
 for(let i=0;i<45;i++)kb.upsertClaim({text:`Fixture ferries timetable ${i}.`,topic:'ferries',jurisdiction:'IM',sources:[{url:'https://www.gov.im/fixture/'}],support:2});
 const speech=knowledgeMap(kb,'ferries').speech;assert.doesNotMatch(speech,/All cite|are listed here/);assert.match(speech,/these 40|this sample/);
});
test('todo tests are identified as unfinished verification rather than an incomplete log',()=>{
 const summary='# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 1\n';const result=assessTests(summary,0);assert.equal(result.status,'failed');assert.equal(result.todo,1);assert.match(result.reason,/todo|unfinished/i);
});

test('generic research labels cannot replace a factual learning subject',()=>{
 const prior=resolveDialogue('Tell me about Manx ferries.').state;
 const next=resolveDialogue('Learn more about that.',{...prior,pendingAction:{kind:'research',subject:'What is the ferry timetable?',label:'the last Isle of Man answer',jurisdiction:'Isle of Man'}});
 assert.match(next.canonical,/ferry timetable/);assert.doesNotMatch(next.canonical,/the last Isle of Man answer/);
});
test('an unavailable index statistics read returns a reported ledger fallback',async t=>{
 const kb=new KnowledgeBase(':memory:'),store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});const retrieval=new ManxRetrieval(kb,null,{store});t.after(()=>{retrieval.close();kb.close();});store.stats=()=>{throw Error('Fixture damaged index');};
 assert.equal((await retrieval.focus('ferries')).retrievalMode,'ledger_fallback_index_unavailable');
});
test('verification fingerprints distinguish boundaries and reject mid-run source changes',async()=>{
 const {fingerprintSources,assessSourceSnapshot}=await import('../../tools/verification-sources.mjs');
 const before=fingerprintSources([['a','bc']]);assert.notEqual(before,fingerprintSources([['ab','c']]));
 assert.equal(assessSourceSnapshot(before,before).status,'passed');assert.equal(assessSourceSnapshot(null,null).status,'failed','unreadable sources cannot form a stable snapshot');
 assert.equal(assessSourceSnapshot(before,fingerprintSources([['a','changed during a test run']])).status,'failed');
});
