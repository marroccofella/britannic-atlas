import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import {readablePage,createPublicReader,secureLookup,retryDelay} from '../lib/public-reader.mjs';
import {accessRows} from '../public/source-access.mjs';
const page=(status=200,headers={},body='<title>Public guidance</title><p>Read this public article.</p>')=>({status,headers:{'content-type':'text/html',...headers},body:Buffer.from(body)});
const noWait=async()=>{};

test('reader permits public sites and public query identifiers without admitting private or signed links',()=>{
  for(const url of ['https://en.wikipedia.org/wiki/Isle_of_Man','https://www.unesco.org/en/articles','https://consult.gov.im/policy.pdf','https://www.tynwald.org.im/business?document=public-123','https://www.gov.im/guidance?page=2'])assert.equal(readablePage(url),url);
  for(const url of ['file:///etc/passwd','https://127.0.0.1/','https://[::1]/','https://localhost/','https://router.local/','https://user:secret@www.gov.im/','https://www.gov.im:444/','https://www.gov.im/%252flogout','https://www.gov.im/?token=private','https://www.gov.im/?key=private','https://www.gov.im/logout','http://www.gov.im/','https://untrusted.invalid/'])assert.equal(readablePage(url),null,url);
});

test('DNS checks are performed by the connection lookup and reject mixed public/private answers',async()=>{
  const spy=mock.method(dns,'lookup',(_host,_options,cb)=>cb(null,[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]));
  try{await assert.rejects(new Promise((resolve,reject)=>secureLookup('public.example.org',{all:true},(error,result)=>error?reject(error):resolve(result))),/Private network/);}finally{spy.mock.restore();}
});

test('normal redirect chains are followed and unsafe/looping redirects stop before a request',async()=>{
  const calls=[];const read=createPublicReader({wait:noWait,get:async url=>{calls.push(url);const n=Number(new URL(url).pathname.slice(1)||0);return n<4?page(302,{location:'/'+(n+1)}):page();}});
  assert.equal((await read('https://www.gov.im/0')).url,'https://www.gov.im/4');assert.equal(calls.length,5);
  for(const target of ['https://127.0.0.1/private','https://www.gov.im/login','https://www.gov.im/?token=secret']){
    let count=0;const guarded=createPublicReader({wait:noWait,get:async()=>{count++;return page(302,{location:target});}});
    await assert.rejects(guarded('https://www.gov.im/'),/redirected/);assert.equal(count,1);
  }
  let count=0;const loop=createPublicReader({wait:noWait,get:async()=>{count++;return page(302,{location:'/'});}});
  await assert.rejects(loop('https://www.gov.im/'),/loop/);assert.equal(count,1);
});

test('one transient retry can recover; refusal and challenge pages are never retried',async()=>{
  let count=0;const read=createPublicReader({wait:noWait,get:async()=>++count===1?page(503,{'retry-after':'1'}):page()});
  assert.equal((await read('https://www.gov.im/')).status,200);assert.equal(count,2);
  // A refusal is retried exactly once, with the browser profile, then the
  // Internet Archive is asked instead of the refusing site. Nothing hammers.
  for(const blocked of [page(403),page(200,{},'<title>Request Rejected</title>')]){
    const hits={};const refuse=createPublicReader({wait:noWait,get:async(url)=>{const host=new URL(url).hostname;hits[host]=(hits[host]||0)+1;return blocked;}});
    await assert.rejects(refuse('https://www.gov.im/'),/refused/);assert.equal(hits['www.gov.im'],2);assert.ok(hits['web.archive.org']<=2,'the archive lookup and at most one index request');
    let n=0;const plain=createPublicReader({wait:noWait,browserFallback:false,archiveFallback:false,get:async()=>{n++;return blocked;}});
    await assert.rejects(plain('https://www.gov.im/'),/refused/);assert.equal(n,1,'with fallbacks off a refusal is never retried');
  }
});

test('rate limiting honours Retry-After across separate calls without hammering the site',async()=>{
  let count=0;const now=Date.parse('2026-09-12T12:00:00Z');const read=createPublicReader({wait:noWait,now:()=>now,archiveFallback:false,get:async(url)=>{if(new URL(url).hostname==='www.gov.im')count++;return page(429,{'retry-after':'120'});}});
  for(let i=0;i<2;i++)await assert.rejects(read('https://www.gov.im/'),error=>error.code==='rate_limited'&&error.retryAt==='2026-09-12T12:02:00.000Z');
  assert.equal(count,1,'a rate-limited site is not asked again, with or without a browser profile');assert.equal(retryDelay('Sat, 12 Sep 2026 12:02:00 GMT',now),120000);
});

test('aborted calls do no network work or waits',async()=>{
  const c=new AbortController();c.abort();const read=createPublicReader({get:()=>{throw Error('must not fetch');},wait:()=>{throw Error('must not wait');}});
  await assert.rejects(read('https://www.gov.im/',{signal:c.signal}),{name:'AbortError'});
});

test('source recovery display treats failure URLs as links rather than verified evidence',()=>{
  const rows=accessRows([{status:'unavailable',url:'https://www.gov.im/guide',reason:'Blocked',retryAt:'2026-09-12T12:02:00Z'},{status:'complete',url:'https://www.gov.im/guide.pdf',notice:'Read 1 of 20 pages.'},{status:'unavailable',url:'javascript:alert(1)'},{status:'unavailable',url:'https://user:pass@www.gov.im/'},{status:'unavailable',url:'https://www.gov.im/?token=secret'}]);
  assert.equal(rows.length,2);assert.equal(rows[0].status,'unavailable');assert.ok(rows[0].retryAt);assert.match(rows[1].reason,/1 of 20/);
});
