import {load} from 'cheerio';
import robotsParser from 'robots-parser';
import {publicRead,readablePage} from './public-reader.mjs';
import {safeForExternalPeerReview} from './external-policy.mjs';

const labels={claude:'Model web search',bing:'Bing search',duckduckgo:'DuckDuckGo search'};
const compact=s=>String(s||'').replace(/\s+/g,' ').trim();
export function searchCandidate(value){
 try{const u=new URL(value);for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||/^(?:gclid|fbclid|msclkid)$/i.test(key))u.searchParams.delete(key);return readablePage(u.href);}catch{return null;}
}
const policies=new Map();
async function checkSearchPolicy(endpoint,get,signal){
 const url=endpoint.origin+'/robots.txt',cached=get===publicRead?policies.get(url):null;
 let body=cached&&Date.now()-cached.at<3600000?cached.body:null;
 if(body==null){const response=await get(url,{signal});if(response.status!==200)throw Object.assign(Error('Search access policy is unavailable.'),{code:'robots_unavailable'});body=String(response.body);if(body.length>200000||!/^\s*user-agent\s*:/im.test(body))throw Object.assign(Error('Search access policy is unreadable.'),{code:'robots_unavailable'});if(get===publicRead)policies.set(url,{body,at:Date.now()});}
 if(robotsParser(url,body).isAllowed(endpoint.href,'ManninPublicReader/1.1')!==true)throw Object.assign(Error('The search endpoint disallows automated access.'),{code:'robots_disallowed'});
}
export function searchQuery(question){const q=compact(question);return q.length<=240?q:q.slice(0,118)+' '+q.slice(-118);}
export function parseSearchResults(provider,response){
 if(response.status!==200)throw Error('Search route returned HTTP '+response.status+'.');
 const body=Buffer.isBuffer(response.body)?response.body.toString():String(response.body||'');
 if(/anomaly\.js|anomaly\.com|anomaly-modal|g-recaptcha|h-captcha|verify (?:that )?you are human|unusual traffic/i.test(body))throw Error('The search route requires a human access check.');
 const $=load(body,{xmlMode:provider==='bing'}),urls=[];
 if(provider==='bing'){
  if(!$('rss channel').length)throw Error('The search route did not return a result feed.');
  $('item link').slice(0,12).each((_,el)=>urls.push($(el).text().trim()));
 }else if(provider==='duckduckgo'){
  $('a.result__a').slice(0,12).each((_,el)=>{
   try{let url=new URL($(el).attr('href'),'https://duckduckgo.com');if(url.hostname==='duckduckgo.com'&&url.pathname==='/l/')url=new URL(url.searchParams.get('uddg'));urls.push(url.href);}catch{/* Ignore malformed result links. */}
  });
 }else throw Error('Unknown public search route.');
 return {urls};
}
// Fixed routes, bounded public topic, discovery only. Each route owns its abort
// signal; late output after a deadline cannot alter the returned receipt.
export async function parallelDiscovery({question,modelSearch,get=publicRead,signal,emit=()=>{},excluded=[],publicTimeoutMs=12000,modelTimeoutMs=45000}={}){
 signal?.throwIfAborted();
 const links=String(question||'').match(/https?:\/\/[^\s<>"']+/g)||[];
 if(!safeForExternalPeerReview(question)||!links.every(u=>readablePage(u.replace(/[).,;!?]+$/,''))))throw Error('Please use a public subject without personal or confidential details for a web search.');
 const query=searchQuery(question),run=async(provider,fn,timeout)=>{
  const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal,start=Date.now();
  let timer,onAbort;
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(combined.reason||Error('Search stopped.'));combined.addEventListener('abort',onAbort,{once:true});});
  timer=setTimeout(()=>controller.abort(Error('This search route exceeded its time limit.')),Math.max(1,timeout));
  emit('tool',{name:'search_'+provider,status:'working',message:labels[provider]+' is looking for public sources…'});
  try{
   const result=await Promise.race([Promise.resolve().then(()=>fn(combined)),stopped]);combined.throwIfAborted();
   const candidates=Array.isArray(result?.urls)?result.urls:[],urls=[...new Set(candidates.map(searchCandidate).filter(Boolean))].filter(u=>!excluded.map(searchCandidate).includes(u)).slice(0,6);
   const receipt={...result,provider,status:urls.length?'complete':'unavailable',durationMs:Date.now()-start,urls,candidateCount:candidates.length,acceptedCount:urls.length,rejectedCount:candidates.filter(u=>!searchCandidate(u)).length,...(!urls.length?{reason:'No usable public source candidates were returned.'}:{})};
   emit('tool',{name:'search_'+provider,status:receipt.status,message:urls.length?labels[provider]+' returned '+urls.length+' source candidates; their pages still need to be read.':labels[provider]+' returned no usable candidates.'});return receipt;
  }catch(error){signal?.throwIfAborted();emit('tool',{name:'search_'+provider,status:'unavailable',message:labels[provider]+' could not complete. Other routes can still return results.'});return {...error.diagnostics,provider,status:'unavailable',durationMs:Date.now()-start,urls:[],code:controller.signal.aborted?'search_route_timeout':error.code||'search_route_unavailable',reason:controller.signal.aborted?'This search route exceeded its time limit.':'This search route could not return usable public candidates.'};}
  finally{clearTimeout(timer);combined.removeEventListener('abort',onAbort);}
 };
 const routes=await Promise.all([
  run('claude',modelSearch,Math.min(45000,modelTimeoutMs)),
  ...['bing','duckduckgo'].map(provider=>run(provider,async routeSignal=>{
   const endpoint=provider==='bing'?new URL('https://www.bing.com/search?format=rss'):new URL('https://html.duckduckgo.com/html/');endpoint.searchParams.set('q',query);
   await checkSearchPolicy(endpoint,get,routeSignal);
   const parsed=parseSearchResults(provider,await get(endpoint.href,{signal:routeSignal}));return {...parsed,searchExecution:'observed',searchOutcome:'succeeded'};
  },Math.min(12000,publicTimeoutMs)))
 ]);
 signal?.throwIfAborted();
 const seen=new Map();for(let i=0;i<6;i++)for(const route of routes){const url=route.urls[i];if(!url)continue;if(!seen.has(url))seen.set(url,{url,providers:[]});seen.get(url).providers.push(route.provider);}
 const candidates=[...seen.values()];
 return {urls:candidates.slice(0,6).map(c=>c.url),candidates,routes:routes.map(({urls,...receipt})=>({...receipt,urls})),provider:'parallel',searchExecution:routes.some(r=>r.searchExecution==='observed')?'observed':'unconfirmed',searchOutcome:routes.every(r=>r.status==='complete')?'succeeded':routes.some(r=>r.status==='complete')?'partial':'failed',candidateCount:candidates.length,acceptedCount:Math.min(6,candidates.length),rejectedCount:routes.reduce((n,r)=>n+(r.rejectedCount||0),0),costComplete:!routes.some(r=>r.provider==='claude'&&r.status==='unavailable')};
}
