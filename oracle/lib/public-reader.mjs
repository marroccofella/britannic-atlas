// Public GETs only. A page's hostname is not evidence of its accuracy.
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { promisify } from 'node:util';
import { gunzip, inflate, brotliDecompress } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { publicAddress } from './government-crawler.mjs';
import { rejectionPage } from './source-content.mjs';

const control=(s,spaces=false)=>[...s].some(c=>c.charCodeAt(0)<(spaces?33:32)||c.charCodeAt(0)===127);

export function readablePage(value) {
  try {
    if(typeof value!=='string'||value.length>2000||control(value,true)||value.includes('\\'))return null;
    const u=new URL(value),host=u.hostname;
    if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')||net.isIP(host)||host.includes(':')||host.endsWith('.')||/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host))return null;
    // A Wayback capture wraps the original page and inherits its query. The
    // original's own allowlist decides; the wrapper adds nothing of its own.
    if(host==='web.archive.org'){
      const capture=/^\/web\/(\d{1,14})(id_|if_|im_)?\/(https?:\/\/.+)$/.exec(u.pathname+u.search);
      if(capture){const inner=readablePage(capture[3].replace(/^http:/,'https:'));return inner?`https://web.archive.org/web/${capture[1]}${capture[2]||''}/${inner}`:null;}
    }
    const path=decodeURIComponent(u.pathname);
    if(control(path)||path.includes('\\')||/%(?:00|2f|5c|25)/i.test(u.pathname)||/\/(?:login|logout|sign-?in|register|checkout|payment|account|admin)(?:\/|$)/i.test(path))return null;
    if(/\.(?:zip|exe|js|css|png|jpe?g|svg|gif|mp[34]|docx?|xlsx?)$/i.test(path))return null;
    // Public identifiers and pagination are preserved, never silently removed.
    // Signed/authenticated URLs require the user's browser rather than this reader.
    const query=[...u.searchParams];
    const publisherParameter=(key,val)=>{
      if(host==='api.open-meteo.com'&&path==='/v1/forecast'){
        const values={current:'temperature_2m',temperature_unit:'celsius',timeformat:'unixtime',timezone:'GMT',forecast_days:'1'};
        if(key==='latitude'||key==='longitude')return query.filter(([k])=>k===key).length===1&&/^-?\d{1,3}(?:\.\d{1,6})?(?:,-?\d{1,3}(?:\.\d{1,6})?){0,7}$/.test(val)&&val.split(',').every(v=>Math.abs(Number(v))<=(key==='latitude'?90:180));
        return Object.hasOwn(values,key)&&query.filter(([k])=>k===key).length===1&&val===values[key];
      }
      if(key==='file' && /^(?:www\.)?tynwald\.org\.im$/.test(host) && /^\/(?:index\.php\/)?spfile$/.test(path))
        return query.filter(([name])=>name==='file').length===1 && /^\/business\/[A-Za-z0-9_ /().-]+\.pdf$/i.test(val) && !val.split('/').some(part=>part==='..'||part==='.') && !val.includes('%');
      if(key==='download' && /^(?:www\.)?legislation\.gov\.im$/.test(host) && path.startsWith('/cms/legislation/'))return /^\d{1,8}:[A-Za-z0-9_-]{1,180}$/.test(val);
      if(/^(?:www\.)?gov\.im$/.test(host))return key==='altTemplate'&&val==='ViewCategorisedNews'||key==='iomg-device'&&['Desktop','Mobile'].includes(val);
      // The Internet Archive's capture index: the original URL, JSON output,
      // successful captures only, a small bounded page of timestamps.
      if(host==='web.archive.org'&&path==='/cdx/search/cdx'){
        if(key==='url')return query.filter(([k])=>k==='url').length===1&&/^https?:\/\/[^\s<>"'\\]{1,1500}$/.test(val);
        if(key==='limit')return /^-?\d{1,2}$/.test(val);
        // Two filters: successful captures, and captures large enough to be a
        // real page rather than the 269-byte firewall page the archive was
        // served for months while gov.im refused it.
        if(key==='filter')return val==='statuscode:200'||val==='length:[0-9]{4,}';
        return {output:'json',fl:'timestamp'}[key]===val;
      }
      return false;
    };
    if(query.length>12||query.some(([key,val])=>(! /^(?:id|page|p|q|query|s|lang|language|year|category|article|document|doc|format|view|offset|limit|ids)$/i.test(key)&&!publisherParameter(key,val))||val.length>(host==='web.archive.org'?1500:250)||control(val)||/[<>]/.test(val)))return null;
    u.hash='';return u.href;
  }catch{return null;}
}

const fail=(code,message,extra={})=>Object.assign(new Error(message),{code,...extra});
export function retryDelay(value,now=Date.now()) {
  if(typeof value!=='string'||!value.trim())return null;
  if(/^\d+$/.test(value.trim()))return Math.min(Number(value)*1000,8640000000000000-now);
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):null;
}

export function secureLookup(host,options,callback) {
  dns.lookup(host,{all:true},(error,addresses)=>{
    if(error)return callback(error);
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return callback(fail('private_destination','Private network destinations are not public websites.'));
    if(options.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);
  });
}


/**
 * Request header profiles. The reader identifies itself by default. Several
 * official Manx hosts (legislation.gov.im, iomfsa.im, courts.im, judgments.im)
 * answer anything that is not a browser with a "Request Rejected" page while
 * serving the same public page to a browser; the browser profile is that
 * ordinary browser request: the same public GET, the same origin spacing and
 * size limits, nothing signed or hidden.
 */
export const READER_PROFILES=Object.freeze({
  reader:{'User-Agent':'ManninPublicReader/1.1','Accept':'text/html,application/xhtml+xml,text/plain,application/pdf,application/json,application/rss+xml,text/xml','Accept-Encoding':'gzip, deflate, br'},
  browser:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8','Accept-Language':'en-GB,en;q=0.9','Accept-Encoding':'gzip, deflate, br'},
});
/** The Internet Archive's latest-snapshot redirect; "id_" returns the page as originally served. */
export const ARCHIVE_ORIGIN='https://web.archive.org';
export function archiveLookupUrl(url){return ARCHIVE_ORIGIN+'/web/2id_/'+url;}
/** One specific capture, as originally served. */
export function archiveCaptureUrl(timestamp,url){return ARCHIVE_ORIGIN+'/web/'+timestamp+'id_/'+url;}
/** The capture index for a URL: successful captures only, newest last. */
export function archiveIndexUrl(url){return ARCHIVE_ORIGIN+'/cdx/search/cdx?url='+encodeURIComponent(url)+'&output=json&filter=statuscode:200&filter='+encodeURIComponent('length:[0-9]{4,}')+'&limit=-6&fl=timestamp';}
/** Origin spacing: official Manx hosts have blocked this machine after bursts, so they are read slowly. */
export function originPacingMs(url){
  const host=new URL(url).hostname;
  if(/(^|\.)manxradio\.com$/.test(host))return 8000;
  if(/(^|\.)gov\.im$/.test(host))return 5000;
  if(host==='web.archive.org')return 1000;
  return 500;
}
/** The snapshot time and original URL encoded in a Wayback capture URL, or null. */
export function archiveSnapshot(value){
  const m=/^https:\/\/web\.archive\.org\/web\/(\d{14})(?:id_|if_|im_)?\/(https?:\/\/.+)$/.exec(String(value||''));
  if(!m)return null;const [,ts,original]=m;
  return {snapshotAt:`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}.000Z`,original};
}
const isArchiveUrl=value=>{try{return new URL(value).hostname==='web.archive.org';}catch{return false;}};
/** The same page, allowing for scheme and a trailing slash: a capture must be of the page that was asked for. */
export function sameResource(a,b){
  const norm=value=>{const page=readablePage(String(value||'').replace(/^http:/,'https:'));return page?page.replace(/\/$/,''):null;};
  const x=norm(a),y=norm(b);return Boolean(x&&y&&x===y);
}

export async function requestPublicPage(url,{signal,profile='reader'}={}) {
  url=readablePage(url);
  if(!url)throw fail('url_not_public','Use a public HTTPS page without credentials or private access parameters.');
  signal?.throwIfAborted();
  const response=await new Promise((resolve,reject)=>{
    const req=https.get(url,{signal,lookup:secureLookup,headers:READER_PROFILES[profile]||READER_PROFILES.reader},res=>{
      const maxBytes=/application\/pdf/i.test(res.headers['content-type']||'')?6*1024*1024:2*1024*1024;
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)req.destroy(fail('size_limit','The document exceeds the reading size limit.'));else chunks.push(chunk);});
      res.on('error',reject);res.on('aborted',()=>reject(fail('ECONNRESET','The website interrupted its response.')));
      res.on('end',()=>resolve({url,status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks),maxBytes,profile}));
    });
    const timer=setTimeout(()=>req.destroy(fail('ETIMEDOUT','The website took too long to respond.')),15000);
    req.on('error',reject);req.on('close',()=>clearTimeout(timer));
  });
  const encoding=String(response.headers['content-encoding']||'identity').trim().toLowerCase();
  const decompress={gzip:gunzip,deflate:inflate,br:brotliDecompress}[encoding];
  if(decompress)response.body=await promisify(decompress)(response.body,{maxOutputLength:response.maxBytes});
  else if(encoding!=='identity')throw fail('unsupported_encoding','The website used an unsupported document encoding.');
  signal?.throwIfAborted();return response;
}

export function createPublicReader({get=requestPublicPage,wait=delay,now=Date.now,browserFallback=(process.env.ORACLE_READER_BROWSER_UA||'on')!=='off',archiveFallback=(process.env.ORACLE_READER_ARCHIVE||'on')!=='off'}={}) {
  const origins=new Map();
  async function once(url,signal,profile) {
    const origin=new URL(url).origin;
    for(const [key,state] of origins)if(!state.busy&&state.next<=now())origins.delete(key);
    let state=origins.get(origin);
    if(!state){if(origins.size>=128)throw fail('busy','The website reader is busy. Try again shortly.');state={next:0,busy:false};origins.set(origin,state);}
    if(state.busy)throw fail('busy','Another request to this website is still running. Try again shortly.');
    const pause=Math.max(0,state.next-now());
    if(pause>10000)throw fail('rate_limited','This website asked us to wait before reading again.',{retryAt:new Date(state.next).toISOString()});
    state.busy=true;
    try {
      await wait(pause,undefined,{signal});signal?.throwIfAborted();
      state.next=now()+originPacingMs(url);
      const response=await get(url,{signal,profile});
      if([429,502,503,504].includes(response.status))state.next=Math.max(state.next,now()+(retryDelay(response.headers['retry-after'],now())??(response.status===429?60000:1000)));
      return response;
    }finally{state.busy=false;}
  }
  // One read of one URL with one header profile: redirects, transient retries
  // and refusals, exactly as before. Fallbacks are decided by the caller.
  async function attempt(url,profile,signal) {
    const visited=new Set();let retries=0;
    for(let hops=0;hops<=5;hops++) {
      if(visited.has(url))throw fail('redirect_loop','The website redirected in a loop.');
      visited.add(url);let response;
      for(;;){
        signal?.throwIfAborted();
        try {response=await once(url,signal,profile);}
        catch(error){
          if(signal?.aborted||!['ECONNRESET','ETIMEDOUT','EAI_AGAIN'].includes(error.code)||retries++)throw error;
          await wait(1000,undefined,{signal});continue;
        }
        if(response.status===429)throw fail('rate_limited','This website asked us to wait before reading again.',{retryAt:new Date(origins.get(new URL(url).origin).next).toISOString()});
        const text=/application\/pdf/i.test(response.headers['content-type']||'')?'':String(response.body);
        if(rejectionPage(text))throw fail('site_blocked','This website refused automated reading.');
        if([502,503,504].includes(response.status)&&!retries){
          const pause=retryDelay(response.headers['retry-after'],now())??1000;
          if(pause<=2000){retries++;await wait(pause,undefined,{signal});continue;}
        }
        break;
      }
      if([301,302,303,307,308].includes(response.status)) {
        let target;
        try {target=response.headers.location&&readablePage(new URL(response.headers.location,url).href);}catch{target=null;}
        if(!target)throw fail('redirect_not_public','The website redirected to a login, private address or unsupported link.');
        url=target;continue;
      }
      if([401,403].includes(response.status))throw fail('site_blocked',`This website refused automated reading (HTTP ${response.status}).`);
      if(response.status!==200){
        const serverWait=[502,503,504].includes(response.status)&&retryDelay(response.headers['retry-after'],now())!=null;
        throw fail('http_error',`The website returned HTTP ${response.status}.`,serverWait?{retryAt:new Date(origins.get(new URL(url).origin).next).toISOString()}:{});
      }
      return {...response,url,profile};
    }
    throw fail('redirect_limit','The website redirected more than five times.');
  }
  // Which failures an archived copy may stand in for: a refusal, a page that
  // is gone or broken, or a site that cannot be reached. Never a private or
  // unsupported link, which the archive must not be used to launder, and
  // never a site that has merely asked us to wait.
  const ARCHIVABLE=new Set(['site_blocked','http_error','rate_limited','ECONNRESET','ETIMEDOUT','EAI_AGAIN']);
  // The latest capture can be the firewall page the archive itself was served
  // while blocked. Step back through the index to an older real capture.
  async function olderCapture(url,signal){
    const index=await attempt(archiveIndexUrl(url),'browser',signal);
    const text=String(index.body||'');
    if(/Temporarily Offline/i.test(text))throw fail('archive_unavailable','The Internet Archive is temporarily offline.');
    let rows;try{rows=JSON.parse(text);}catch{throw fail('archive_unavailable','The Internet Archive index could not be read.');}
    const stamps=(Array.isArray(rows)?rows.slice(1):[]).map(row=>String(row?.[0]||'')).filter(stamp=>/^\d{14}$/.test(stamp)).sort().reverse();
    let tried=0;
    for(const stamp of stamps){
      if(tried++>=4)break;
      try{const copy=await attempt(archiveCaptureUrl(stamp,url),'browser',signal);const snapshot=archiveSnapshot(copy.url);if(snapshot&&sameResource(snapshot.original,url))return {copy,snapshotAt:snapshot.snapshotAt};}
      catch(e){if(signal?.aborted||!['site_blocked','http_error'].includes(e.code))throw e;}
    }
    return null;
  }
  return async function read(value,{signal,profile='reader',archive=archiveFallback}={}) {
    signal?.throwIfAborted();const url=readablePage(value);
    if(!url)throw fail('url_not_public','This link is outside the public-reader allowlist: use a public HTTPS page without a login, private address or signed access parameters.');
    // A capture is disclosed however it was reached: asked for directly, or a
    // live page that redirected into the archive.
    const disclose=(r,outcome)=>{const snapshot=archiveSnapshot(r.url);return snapshot?{...r,url:isArchiveUrl(url)?r.url:url,archived:{snapshotAt:snapshot.snapshotAt,archiveUrl:r.url,liveOutcome:outcome}}:r;};
    let error;
    try {return disclose(await attempt(url,profile,signal),'redirected');}
    catch(e){if(signal?.aborted)throw e;error=e;}
    if(error.code==='site_blocked'&&browserFallback&&profile==='reader'){
      try {return disclose(await attempt(url,'browser',signal),'redirected');}
      catch(e){if(signal?.aborted)throw e;error=e;}
    }
    if(archive&&ARCHIVABLE.has(error.code)&&!error.retryAt&&!isArchiveUrl(url)){
      try {
        const copy=await attempt(archiveLookupUrl(url),'browser',signal);
        const snapshot=archiveSnapshot(copy.url);
        if(snapshot&&sameResource(snapshot.original,url))return {...copy,url,archived:{snapshotAt:snapshot.snapshotAt,archiveUrl:copy.url,liveOutcome:error.code}};
        error.archive=snapshot?'capture_mismatch':'unrecognised_capture';
      } catch(e){if(signal?.aborted)throw e;error.archive=e.code||'unavailable';}
      // The latest capture can be the firewall page, a capture of another
      // page, or missing altogether; the index knows what else exists.
      if(['site_blocked','http_error','capture_mismatch','unrecognised_capture'].includes(error.archive)){
        try{const older=await olderCapture(url,signal);if(older)return {...older.copy,url,archived:{snapshotAt:older.snapshotAt,archiveUrl:older.copy.url,liveOutcome:error.code}};error.archive='no_real_capture';}
        catch(e2){if(signal?.aborted)throw e2;error.archive=e2.code||'archive_unavailable';}
      }
    }
    throw error;
  };
}

export const publicRead=createPublicReader();
