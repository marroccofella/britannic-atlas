import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runLiveTools} from '../lib/live-tools.mjs';
test('recovery never sends a rejected credential-bearing URL to a search provider',async()=>{
  let calls=0;const url='https://www.gov.im/report.pdf?token=SYNTHETIC_PRIVATE_TOKEN';
  const result=await runLiveTools({question:'Read '+url,request:{name:'read_page',url},allowRecovery:true,get:async()=>{throw Error('Must not fetch');},runModel:async()=>{calls++;return {structured:{urls:[]}};}});
  assert.equal(calls,0);assert.equal(result.claims.length,0);
});
test('short substantive HTML paragraphs remain readable as aggregate text',async()=>{
  const url='https://www.gov.im/synthetic/';
  const result=await runLiveTools({question:'Read the legislation update',request:{name:'read_page',url},get:async()=>({url,headers:{'content-type':'text/html'},body:'<main><p>Royal Assent was announced today.</p><p>Commencement requires an order.</p><p>Register opening is still pending.</p></main>'})});
  assert.equal(result.claims.length,1);assert.match(result.claims[0].text,/Royal Assent/);assert.match(result.claims[0].text,/opening/);
});
