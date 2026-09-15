import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {createPublicReader,retryDelay,requestPublicPage} from '../lib/public-reader.mjs';
import {runLiveTools,WEATHER_URL,NEWS_URL} from '../lib/live-tools.mjs';

test('502 and 504 respect a server retry deadline across separate requests',async()=>{
  for(const status of [502,504]){
    let calls=0;const at=Date.parse('2026-09-12T12:00:00Z');
    const read=createPublicReader({now:()=>at,wait:async()=>{},get:async()=>{calls++;return {status,headers:{'retry-after':'120'},body:Buffer.from('Unavailable')};}});
    await assert.rejects(read('https://www.gov.im/'),e=>e.retryAt==='2026-09-12T12:02:00.000Z');
    await assert.rejects(read('https://www.gov.im/'),/wait/);assert.equal(calls,1);
  }
});

test('long server retry instructions are not shortened to one day',()=>{
  assert.equal(retryDelay('172800',0),172800000);
});

test('raw transport refuses credential-bearing URLs before opening a connection',async()=>{
  let calls=0;const spy=mock.method(https,'get',()=>{calls++;throw Error('Unexpected transport call');});
  try{await assert.rejects(requestPublicPage('https://user:secret@www.gov.im/'),/public HTTPS/);assert.equal(calls,0);}finally{spy.mock.restore();}
});

test('weather and news failures include their exact recovery page',async()=>{
  for(const [name,url] of [['get_weather',WEATHER_URL],['get_news',NEWS_URL]]){
    const r=await runLiveTools({request:{name},get:async()=>{throw Error('Source unavailable');}});
    assert.equal(r.calls[0].url,url);assert.match(r.calls[0].recovery,/browser/i);
  }
  const r=await runLiveTools({request:{name:'get_forecast'},forecastReader:async()=>({ok:false,reason:'Source unavailable'})});
  assert.equal(r.calls[0].url,'https://www.gov.im/weather/');
});
