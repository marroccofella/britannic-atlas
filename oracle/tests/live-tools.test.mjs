import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDialogue,DialogueSessions} from '../lib/dialogue.mjs';
import {answer} from '../lib/brain.mjs';
import {KnowledgeBase} from '../lib/kb.mjs';
import {liveRequest,runLiveTools,parseObservation,parseNews,trustedPage,publicRead,LiveLookupBudget,WEATHER_URL,NEWS_URL} from '../lib/live-tools.mjs';
import {buildDeliberationBrief} from '../lib/deliberate.mjs';

const at=new Date('2026-09-11T16:00:00Z');
const observation=JSON.stringify([{icaoId:'EGNS',obsTime:1789141800,reportTime:'2026-09-11T17:00:00Z',temp:17,dewp:7}]);
const response=(body,type='application/json',url=WEATHER_URL)=>({body,headers:{'content-type':type},url});

test('live routing selects actual tools, respects jurisdiction and excludes climate/engineering',()=>{
  for(const question of ["What's the temperature in the Isle of Man?",'How humid is it?','What is the humidity?'])assert.equal(liveRequest(question)?.name,'get_weather');
  assert.equal(liveRequest('Forecast tomorrow?').name,'get_forecast');
  assert.equal(liveRequest('Latest Manx news?').name,'get_news');
  for(const q of ['Average climate temperature?','What temperature should concrete cure at?','Do not search for the temperature','What was the temperature yesterday?','What causes humidity?','How is temperature measured?'])assert.equal(liveRequest(q),null);
  assert.notEqual(liveRequest('Current temperature in England',{jurisdiction:'England'})?.name,'get_weather');
  assert.equal(resolveDialogue('Do not use MOMM.').route==='review',false);
  assert.notEqual(resolveDialogue('My mum lives in Douglas.').route,'review');
});

test('weather uses observation time not report time and labels estimated humidity',()=>{
  const data=parseObservation(observation,at);assert.equal(data.temperatureC,17);assert.equal(data.humidityPercent,52);assert.equal(data.observedAt,'2026-09-11T15:50:00.000Z');assert.match(data.text,/Estimated relative humidity.*airport observation/);
  for(const data of [[],[{icaoId:'EGNS',obsTime:1,temp:17}],[{icaoId:'EGNS',obsTime:1789149999,temp:17}],[{icaoId:'EGNS',obsTime:1789141800,temp:null}]])assert.throws(()=>parseObservation(JSON.stringify(data),at));
});

test('public-page destinations reject credentials, queries, private/untrusted hosts and files',()=>{
  assert.equal(trustedPage('https://www.gov.im/weather/#forecast'),'https://www.gov.im/weather/');
  for(const url of ['http://www.gov.im/weather/','https://user:pass@www.gov.im/','https://127.0.0.1/','https://gov.im.evil.test/','https://www.gov.im:444/','https://www.gov.im/?token=private','https://www.manxradio.com/searchresults/','https://www.gov.im/archive.zip','https://www.gov.im/%00'])assert.equal(trustedPage(url),null,url);
  assert.equal(trustedPage('https://www.gov.im/public.pdf'),'https://www.gov.im/public.pdf');
});

test('news sorts dated headlines, rejects future/old/foreign articles and deduplicates',()=>{
  const item=(title,date,path)=>`<item><title>${title}</title><pubDate>${date}</pubDate><link>https://www.manxradio.com/news/isle-of-man-news/${path}/</link></item>`;
  const xml='<rss><channel>'+item('Earlier','Fri, 11 Sep 2026 12:00:00 +0100','earlier')+item('Latest','Fri, 11 Sep 2026 16:30:00 +0100','latest')+item('Duplicate','Fri, 11 Sep 2026 16:30:00 +0100','latest')+item('Future','Fri, 11 Sep 2026 20:00:00 +0100','future')+'</channel></rss>';
  assert.deepEqual(parseNews(xml,at).map(i=>i.title),['Latest','Earlier']);
});

test('weather tool has no model cost, emits progress then retains timestamped evidence',async()=>{
  const events=[];let n=0;
  const result=await runLiveTools({question:'Temperature?',at,get:async url=>{n++;assert.equal(url,WEATHER_URL);return response(observation);},runModel:()=>{throw Error('No paid call expected');},emit:(type,data)=>events.push([type,data])});
  assert.equal(n,1);assert.equal(result.costUsd,0);assert.equal(result.claims[0].publishedAt,'2026-09-11T15:50:00.000Z');assert.deepEqual(events.map(e=>e[1].status),['working','complete']);
});

test('actual page text, not a search snippet or model URL, becomes evidence',async()=>{
  const phases=[];
  const result=await runLiveTools({question:'What public grants support hotel renovation?',request:{name:'plan_lookup'},at,
    runModel:async input=>{assert.equal(input.onDelta,undefined);phases.push(input.tools.length?'search':'plan');return {costUsd:.01,structured:input.tools.length?{urls:['https://www.gov.im/business/grants/','https://untrusted.invalid/']}:{name:'search_web',url:''}};},
    get:async url=>{phases.push('read');return response('<main><h1>Public grants</h1><p>Applications for this synthetic grant require an eligibility check with the department.</p></main>','text/html',url);}});
  assert.deepEqual(phases,['plan','search','read']);assert.equal(result.claims.length,1);assert.match(result.claims[0].text,/synthetic grant/);assert.equal(result.costUsd,.02);
});

test('blocked and unsupported pages become named failures with no invented evidence',async()=>{
  const result=await runLiveTools({question:'Read this page',request:{name:'read_page',url:'https://www.gov.im/example/'},get:async()=>response('<title>Request Rejected</title>','text/html')});
  assert.equal(result.claims.length,0);assert.equal(result.calls[0].status,'unavailable');
  const invalid=await runLiveTools({question:'Read a local page',request:{name:'read_page',url:'https://127.0.0.1/'},get:()=>{throw Error('must not fetch');}});assert.match(invalid.calls[0].reason,/allowlist/);
});

test('cancellation prevents later page reads and final speech',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(runLiveTools({question:'Temperature?',signal:controller.signal,get:()=>{throw Error('must not fetch');}}),{name:'AbortError'});
});

test('the real answer pipeline saves live observations as reviewable episodes and source excerpts',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];const question="What's the temperature in the Isle of Man?";
  const result=await answer({kb,sessionId:'live',question,resolution:resolveDialogue(question),emit:(type,data)=>events.push([type,data]),liveTools:opts=>runLiveTools({...opts,at,get:async()=>response(observation)}),runModel:()=>{throw Error('No model expected');}});
  const meta=events.find(e=>e[0]==='meta')[1];assert.match(result.text,/17 degrees/);assert.equal(meta.reviewable,true);assert.equal(meta.nextSteps[0].researchMode,'live_sources');assert.ok(meta.episodeId);assert.equal(kb.getEpisode(meta.episodeId).source_excerpts.length,1);assert.equal(meta.costUsd,0);
  assert.ok(events.findIndex(e=>e[0]==='tool')<events.findIndex(e=>e[0]==='sentence'));
});

test('MOMM sees public runtime capabilities but never treats them as factual source evidence',()=>{
  const brief=buildDeliberationBrief({question:'Can you search?',answer:'I cannot search.',sources:[]});assert.match(brief,/Server-owned runtime facts/);assert.match(brief,/search for public sources on request/);assert.match(brief,/do not themselves verify/);
});

test('fixed news source is publisher RSS, not its blocked remote search route',()=>assert.equal(NEWS_URL,'https://www.manxradio.com/news/isle-of-man-news/feed.xml'));

test('aborted requests cannot extend publisher cooldown or turn cancellation into busy',async()=>{
  const c=new AbortController();c.abort();for(let i=0;i<5;i++)await assert.rejects(publicRead(NEWS_URL,{signal:c.signal}),{name:'AbortError'});
});
test('planning and search share the same allowance before any paid call',async()=>{
  const budget=new LiveLookupBudget({limit:2});let count=0;
  for(let i=0;i<4;i++)await runLiveTools({question:'Public hotel grants?',request:{name:'plan_lookup'},budget,runModel:async()=>{count++;return {structured:{name:'none',url:''},costUsd:0};}});
  assert.equal(count,2);assert.equal(budget.busy,false);
});
test('reading an allowlisted news article does not promote it to primary evidence',async()=>{
  const url='https://www.manxradio.com/news/isle-of-man-news/example/';
  const r=await runLiveTools({question:'Read this article',request:{name:'read_page',url},get:async()=>response('<main><p>This synthetic local newspaper article reports on a public event in Douglas.</p></main>','text/html',url)});
  assert.equal(r.claims[0].sources[0].primary,false);
});
test('MOMM retains the exact public airport query needed for the observation source',()=>{
  assert.ok(buildDeliberationBrief({question:'Current temperature?',answer:'Airport observation',sources:[{url:WEATHER_URL,title:'NOAA Ronaldsway'}]}).includes(WEATHER_URL));
});

test('temperature follow-up keeps its factual subject and authorizes an in-chat lookup',()=>{
  const d=new DialogueSessions();const first=d.resolve('live','What’s the temperature in the Isle of Man?');
  d.markInFlight('live',first);d.complete('live',first.semanticKey);
  for(const q of ['I want you to find out for me.','You can if you search or use MOM.','Search this answer']){
    const next=d.preview('live',q,{source:'speech',recognitionConfidence:.9});
    assert.equal(next.route,'research');assert.match(next.canonical,/temperature/i);assert.equal(next.researchMode,'live_sources');
  }
});

test('a factual answer retains Search even if the model denies researchability',async t=>{
  const kb=new KnowledgeBase(':memory:');t.after(()=>kb.close());const events=[];
  await answer({kb,sessionId:'live',question:'What grants support historic lighthouse conservation?',emit:(type,data)=>events.push([type,data]),runModel:async({onDelta})=>{
    onDelta?.('I need a current source for grant eligibility.\n<<meta>>{"used":[],"researchable":false,"expedition":false}');return {costUsd:0};
  }});
  const meta=events.find(([type])=>type==='meta')[1];assert.equal(meta.nextSteps[0]?.researchMode,'live_sources');assert.equal(meta.reviewable,true);
});
