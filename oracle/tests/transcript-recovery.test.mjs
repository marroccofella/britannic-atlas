import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runLiveTools} from '../lib/live-tools.mjs';
import {GovernmentCrawler} from '../lib/government-crawler.mjs';
import {VectorStore} from '../lib/vector-store.mjs';

test('unavailable town weather tries a bounded public alternative and retains the failure',async()=>{
 const question='Temperatures in Douglas and Ramsey';let searches=0,reads=0;
 const result=await runLiveTools({question,allowRecovery:true,get:async url=>{reads++;if(url.includes('open-meteo'))throw Error('Synthetic outage');return {url,body:'<h1>Town temperatures</h1><p>Current temperatures: Douglas 14 Celsius, Ramsey 15 Celsius. Synthetic source fixture.</p>',headers:{'content-type':'text/html'}};},runModel:async()=>{searches++;return {structured:{urls:['https://publicweather.org/towns']},costUsd:0};}});
 assert.equal(searches,1);assert.equal(reads,2);assert.equal(result.calls[0].status,'unavailable');assert.equal(result.claims.length,1);
});
test('re-reading unchanged official content repairs absent chunk checksums',async t=>{
 const store=new VectorStore(':memory:',{modelId:'fixture',dimensions:3});t.after(()=>store.close());
 const crawler=new GovernmentCrawler(store,{embedder:{countTokens:s=>s.split(' ').length,embed:async rows=>rows.map(()=>[1,0,0])}});
 const response={url:'https://www.gov.im/harbours',headers:{'content-type':'text/html'},body:Buffer.from('<h1>Manx harbour</h1><p>Public harbour information for sailors arriving on the Isle of Man. Opening hours and tide conditions.</p>')};
 await crawler.ingest(response);store.db.exec('UPDATE chunks SET body_hash=NULL');await crawler.ingest(response);assert.equal(store.integrity().ok,true);
});
