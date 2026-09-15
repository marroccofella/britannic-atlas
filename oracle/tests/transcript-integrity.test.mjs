import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeBase} from '../lib/kb.mjs';
import {ConversationStore} from '../lib/conversations.mjs';
import {ResultStore} from '../lib/results.mjs';
import {VectorStore} from '../lib/vector-store.mjs';
import {ManxRetrieval} from '../lib/manx-retrieval.mjs';
import {persistPublicEvidence,evidenceCurrent} from '../lib/evidence-ledger.mjs';
import {knowledgeIntegrity} from '../lib/knowledge-integrity.mjs';
import {WEATHER_PLACES,townWeatherPlaces,townWeatherUrl,parseTownWeather} from '../lib/town-weather.mjs';
import {readablePage} from '../lib/public-reader.mjs';
import {runLiveTools} from '../lib/live-tools.mjs';
import {answer} from '../lib/brain.mjs';
import {conversationReviewTarget} from '../lib/conversation-review.mjs';
import {reviewTarget} from '../lib/review-target.mjs';
import {buildDeliberationBrief,parseDeliberationReport,deliberateEpisode,MommHourlyAllowance} from '../lib/deliberate.mjs';
import {parseMommVersion} from '../lib/momm.mjs';
const noCall=()=>{throw Error('An unexpected model or network call ran');};
const fixture=(t)=>{const kb=new KnowledgeBase(':memory:'),store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});const retrieval=new ManxRetrieval(kb,null,{store,getEmbedder:async()=>({countTokens:s=>s.split(' ').length,embed:async a=>a.map(()=>[1,0,0])})});t.after(()=>{retrieval.close();kb.close();});return {kb,store,retrieval};};
const weatherRows=(places,at)=>places.map((p,i)=>({latitude:p.lat,longitude:p.lon,current_units:{temperature_2m:'°C',time:'unixtime'},current:{temperature_2m:12+i,time:Math.floor(at.getTime()/1000)}}));
test('town estimates validate units, timestamps, geography, completeness and partial data',()=>{
 const at=new Date(),places=WEATHER_PLACES.slice(0,2),rows=weatherRows(places,at);
 const result=parseTownWeather(JSON.stringify(rows),places,at);assert.equal(result.readings.length,2);assert.match(result.text,/not thermometer measurements/);
 assert.throws(()=>parseTownWeather(JSON.stringify([rows[0]]),places,at),/every requested/);
 for(const bad of [{current_units:{temperature_2m:'F',time:'unixtime'}},{latitude:0},{current:{temperature_2m:15,time:Math.floor(at/1000)-10000}},{current:{temperature_2m:200,time:Math.floor(at/1000)}}]){
  const r=parseTownWeather(JSON.stringify([{...rows[0],...bad},rows[1]]),places,at);assert.deepEqual(r.missing,['Douglas']);assert.equal(r.partial,true);
 }
});
test('the bounded weather URL is allowed without opening arbitrary query parameters',()=>{
 const url=townWeatherUrl(WEATHER_PLACES);assert.equal(readablePage(url),url);
 assert.equal(readablePage(url+'&api_key=secret'),null);
 assert.equal(readablePage(url.replace('api.open-meteo.com','untrusted.org')),null);
 assert.throws(()=>townWeatherUrl([{name:'Private',lat:1,lon:1}]),/Unknown/);
 assert.deepEqual(townWeatherPlaces('Average temperature in Douglas last year'),[]);
});
test('multi-town request delivers temperatures without a model and commits eligible evidence to vectors',async t=>{
 const {kb,retrieval}=fixture(t),at=new Date(),question='What are the temperatures in every major town and city?';let reads=0,meta;
 const result=await answer({kb,retrieval,sessionId:'synthetic',question,root:process.cwd(),emit:(e,d)=>{if(e==='meta')meta=d;},runModel:noCall,liveTools:o=>runLiveTools({...o,at,get:async url=>{reads++;return {url,headers:{'content-type':'application/json'},body:JSON.stringify(weatherRows(WEATHER_PLACES,at))};}})});
 assert.equal(reads,1);for(const place of WEATHER_PLACES)assert.ok(result.text.includes(place.name));assert.match(result.text,/model estimates/);
 assert.equal(meta.knowledgeWrite.stored,8);assert.equal(retrieval.stats().ledger.indexed,8);assert.equal(knowledgeIntegrity(kb,retrieval).ok,true);
 for(const id of meta.knowledgeWrite.ids){const c=kb.getClaim(id);assert.equal(c.status,'single_source');assert.equal(c.evidenceKind,'source_excerpt');assert.ok(evidenceCurrent(c));assert.ok(!evidenceCurrent(c,at.getTime()+3*3600000));}
});
test('failed reads, unbound citations and private conversation cannot create source evidence',t=>{
 const {kb}=fixture(t),c={text:'A synthetic public harbour fact.',topic:'Harbours',evidenceKind:'source_excerpt',fetchedAt:new Date().toISOString(),sources:[{url:'https://www.gov.im/fixture'}]};
 for(const calls of [[],[{name:'read_page',status:'unavailable',url:c.sources[0].url}],[{name:'read_page',status:'complete',url:'https://www.gov.im/unrelated'}]])assert.equal(persistPublicEvidence(kb,{claims:[c],calls},{question:'Manx harbour information'}).stored,0);
 assert.equal(persistPublicEvidence(kb,{claims:[c],calls:[{name:'read_page',status:'complete',url:c.sources[0].url}]},{question:'My email is private@example.org'}).stored,0);assert.equal(kb.count(),0);
});
test('expired or mutated source evidence cannot reappear through a semantic hit',async t=>{
 const {kb,retrieval}=fixture(t),now=Date.now(),url='https://www.gov.im/harbours';
 const live=await runLiveTools({question:'Read '+url,allowRecovery:false,get:async()=>({url,headers:{'content-type':'text/html'},body:'<h1>Public harbour</h1><p>Public harbour services include inspected moorings and visitor berths.</p>'})});
 const receipt=persistPublicEvidence(kb,live,{question:'Manx harbour services'});
 await retrieval.syncLedger();const id=receipt.ids[0],claim=kb.getClaim(id);claim.provenance.sourceEvidence.expiresAt=new Date(now-1).toISOString();
 kb.db.prepare('UPDATE claims SET provenance=? WHERE id=?').run(JSON.stringify(claim.provenance),id);
 assert.ok(!(await retrieval.focus('Public harbour moorings')).claims.some(c=>c.id===id));await retrieval.syncLedger();assert.equal(retrieval.stats().ledger.indexable,0);
});
test('chunk mutation is detected, excluded and repaired from the canonical ledger',async t=>{
 const {kb,store,retrieval}=fixture(t);kb.upsertClaim({text:'A public synthetic Manx harbour services claim.',jurisdiction:'IM',sources:[{url:'https://www.gov.im/harbours'}]});await retrieval.syncLedger();
 store.db.exec("UPDATE chunks SET body='Tampered passage claiming something different'");assert.equal(store.integrity().changed,1);assert.equal(store.search('Tampered passage',[1,0,0]).length,0);await retrieval.syncLedger();assert.equal(store.integrity().changed,0);
});
test('conversation review identifies public scope, excludes private turns and deduplicates',t=>{
 const {kb}=fixture(t),conversations=new ConversationStore(kb.db);new ResultStore(kb.db);
 const save=(id,q,a,meta={})=>{conversations.start({id,sessionId:'one',question:q,resolution:{route:'answer',canonical:q,jurisdiction:'Isle of Man'}});conversations.finish(id,{answer:a,metadata:{meta}});};
 save('public-one','Temperatures in the main Manx towns?','No tool has run yet.');save('private-one','My email is private@example.org','The address is private.');
 const first=conversationReviewTarget(kb,'one'),again=reviewTarget(kb,'one',{}, {scope:'conversation'});assert.equal(first.key,again.key);assert.equal(first.included,1);
 const episode=kb.getEpisode(first.key),brief=buildDeliberationBrief(episode);assert.match(brief,/Temperatures/);assert.doesNotMatch(brief,/private@example|private-one|public-one/);assert.equal(kb.count(),0);
 assert.ok(!conversationReviewTarget(kb,'another').key);
});
test('receipt memory maps a real review to its question and dispatcher version',t=>{
 const {kb}=fixture(t),conversations=new ConversationStore(kb.db),results=new ResultStore(kb.db);conversations.ensure('s');
 const id=kb.recordEpisode({sessionId:'s',question:'Synthetic Manx harbour question',answer:'Synthetic reply.',status:'single_source',jurisdiction:'IM'});
 results.put('s','episode:'+id,'Synthetic reply.',{operation:{phase:'completed'},review:{runId:'review-fixture',dispatcherVersion:'1.15.1'}});
 const context=conversations.context('s','What did you review?').text;assert.match(context,/Synthetic Manx harbour question/);assert.match(context,/1\.15\.1/);
 assert.equal(parseMommVersion('momm 1.15.1 (report schema momm-report/1, node 22.16.0)').version,'1.15.1');assert.equal(parseMommVersion('probably current'),null);
 assert.equal(parseDeliberationReport({dispatcher_version:'1.15.1'}).dispatcherVersion,'1.15.1');
});
test('a placeholder synthesis cannot be accepted as an improved answer',async()=>{
 const episode={id:'episode-fixture',session_id:'s',question:'What is the Manx parliament?',resolved_question:'What is the Manx parliament?',jurisdiction:'IM',answer:'The parliament is Tynwald.',confidence:.6,status:'single_source'};
 const result=await deliberateEpisode({episode,cwd:process.cwd(),allowance:new MommHourlyAllowance(),minSuccess:2,dispatch:async()=>({reviewers:[{agent:'a',status:'success',verdict:'ACCEPT'},{agent:'b',status:'success',verdict:'ACCEPT'}],findings:[]}),runModel:async()=>({structured:{answer:'Test',status:'verified',confidence:1,claims:[],corrections:[]}})});
 assert.equal(result.ok,false);
});
