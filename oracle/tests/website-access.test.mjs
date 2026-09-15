import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLiveTools } from '../lib/live-tools.mjs';
import { GovernmentCrawler } from '../lib/government-crawler.mjs';
import { rejectionPage } from '../lib/source-content.mjs';

const html='<title>Public guidance</title><main><p>This public guidance explains the responsibilities of people using this service.</p></main>';
const response=(url,status=200,body=html,headers={})=>({url,status,body:Buffer.from(body),headers:{'content-type':'text/html',...headers}});
const store=()=>({db:{prepare:()=>({run:()=>{}})},enqueue:()=>{}});

test('selected public pages outside the preferred domains and public query links can be read',async()=>{
  for(const url of ['https://www.bbc.com/news','https://www.gov.im/guidance/?id=12&page=2']){
    const result=await runLiveTools({request:{name:'read_page',url},get:async()=>({...response(url),body:html})});
    assert.equal(result.claims.length,1,url);
    assert.equal(result.claims[0].sources[0].url,url);
  }
});

test('a readable PDF reaches extraction and records partial text coverage',async()=>{
  const url='https://consult.gov.im/policy/guidance.pdf';let extracted=false;
  const result=await runLiveTools({request:{name:'read_page',url},get:async()=>response(url,200,'%PDF-fixture',{'content-type':'application/pdf'}),
    pdfReader:async bytes=>{assert.ok(Buffer.isBuffer(bytes));extracted=true;return {sections:[{body:'This synthetic PDF describes public consultation guidance and the date of the proposed changes.',page:1}],pages:2,emptyPages:[2]};}});
  assert.equal(extracted,true);assert.equal(result.claims.length,1);
  assert.match(result.calls[0].notice,/1.*2.*pages/);
});

test('ordinary explanatory security text is not a site rejection',()=>{
  assert.equal(rejectionPage('<title>Security terminology</title><main><p>A captcha challenge is one way to distinguish automated requests from ordinary visitors.</p></main>'),false);
  assert.equal(rejectionPage('<title>Request Rejected</title>The requested URL was rejected.'),true);
});

test('ordinary missing robots files do not block an origin',async()=>{
  const c=new GovernmentCrawler(store(),{get:async url=>response(url,404,'<!doctype html><title>Not Found</title>'),delay:async()=>{}});
  assert.equal((await c.policy('https://www.gov.im')).allowed,true);
});

test('a refused individual page does not poison public pages on that site',async()=>{
  const c=new GovernmentCrawler(store(),{delay:async()=>{},get:async url=>url.endsWith('/robots.txt')?response(url,200,'User-agent: *\nAllow: /'):response(url,url.endsWith('/restricted')?403:200)});
  await assert.rejects(c.fetchPage('https://www.gov.im/restricted'));
  assert.equal((await c.fetchPage('https://www.gov.im/public')).status,200);
});

test('failed reading retains the selected page and a usable recovery action without evidence',async()=>{
  const url='https://www.gov.im/guidance/';
  const result=await runLiveTools({request:{name:'read_page',url},get:async()=>{throw Error('The source returned HTTP 403.');}});
  assert.equal(result.claims.length,0);assert.equal(result.calls[0].url,url);
  assert.match(result.calls[0].recovery,/Open.*browser/i);
});
