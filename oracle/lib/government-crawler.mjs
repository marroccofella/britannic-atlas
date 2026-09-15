// Public GET-only crawler. No browser impersonation, credentials, forms or WAF bypass.
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import robotsParser from "robots-parser";
import { load } from "cheerio";
import { setTimeout as sleep } from "node:timers/promises";
import { rejectionPage, extractHtml, extractPdf, sourceChunks } from "./source-content.mjs";
import { contentHash } from "./vector-store.mjs";
export const CRAWLER_AGENT="MANXKnowledgeBot/0.1";
export function governmentUrl(value, base="https://www.gov.im/") {
  try {
    const u=new URL(value,base),host=u.hostname.toLowerCase();
    if (u.protocol!=="https:" || u.username || u.password || u.port || !(host==="gov.im"||host.endsWith(".gov.im")) || net.isIP(host)) return null;
    if (/%(?:00|2f|5c)/i.test(u.pathname) || /\\/.test(u.pathname) || /\/(?:login|logout|sign-?in|register|checkout|payment|search)(?:\/|$)/i.test(u.pathname)) return null;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|js|zip|exe|docx?|xlsx?|mp[34]|avi|woff2?)$/i.test(u.pathname)) return null;
    if ([...u.searchParams].some(([key,value])=>!["page","p"].includes(key)||!/^\d{1,5}$/.test(value))) return null;
    u.hash="";u.searchParams.sort();return u.href;
  } catch {return null;}
}
export function publicAddress(address) {
  if (net.isIP(address)===4) {
    const [a,b]=address.split(".").map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&[0,168].includes(b))||(a===100&&b>=64&&b<=127)||(a===198&&[18,19].includes(b)));
  }
  // Public IPv6 global unicast only; IPv4-mapped, local, link-local and multicast fail closed.
  return net.isIP(address)===6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
}
export function publicGet(value,{maxBytes=6*1024*1024,timeoutMs=20000,signal}={}) {
  const url=governmentUrl(value);
  if (!url) return Promise.reject(new Error("out_of_scope"));
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{
      signal,headers:{"User-Agent":CRAWLER_AGENT,"Accept":"text/html,application/xhtml+xml,application/xml,text/plain,application/pdf","Accept-Encoding":"identity"},
      lookup:(host,options,callback)=>dns.lookup(host,{all:true},(error,addresses)=>{
        if(error)return callback(error);
        if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return callback(new Error("private_network_blocked"));
        if(options.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);
      }),
    },response=>{
      const chunks=[];let size=0;
      response.on("data",chunk=>{size+=chunk.length;if(size>maxBytes){request.destroy(new Error("response_size_limit"));}else chunks.push(chunk);});
      response.on("end",()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks),url}));
      response.on("error",reject);
    });
    const timer=setTimeout(()=>request.destroy(new Error("fetch_timeout")),timeoutMs);
    request.on("close",()=>clearTimeout(timer));request.on("error",reject);
  });
}
export class GovernmentCrawler {
  constructor(store,{embedder=null,get=publicGet,delay=sleep,signal}={}) {
    this.store=store;this.embedder=embedder;this.get=get;this.delay=delay;this.signal=signal;this.policies=new Map();this.lastRequest=0;
  }
  async request(url,delayMs=2000) {
    this.signal?.throwIfAborted();
    await this.delay(Math.max(0,this.lastRequest+delayMs-Date.now()),undefined,{signal:this.signal});
    this.lastRequest=Date.now();
    return this.get(url,{signal:this.signal});
  }
  async policy(origin) {
    if(this.policies.has(origin))return this.policies.get(origin);
    let policy;
    try {
      const response=await this.request(origin+"/robots.txt");
      const text=response.body.toString("utf8");
      if(rejectionPage(text))throw new Error("robots_access_blocked_or_not_text");
      if(response.status===404||response.status===410) policy={allowed:true,parser:robotsParser(origin+"/robots.txt",""),delay:2000,sitemaps:[]};
      else if(response.status===200) {
        if(/<html|<!doctype html/i.test(text))throw new Error("robots_access_blocked_or_not_text");
        const parser=robotsParser(origin+"/robots.txt",text);
        const seconds=Number(parser.getCrawlDelay(CRAWLER_AGENT))||0;
        if(seconds>60)throw new Error("crawl_delay_exceeds_run_limit");
        policy={allowed:true,parser,delay:Math.max(2000,seconds*1000),sitemaps:parser.getSitemaps()};
      } else throw new Error("robots_http_"+response.status);
    } catch(error) {policy={allowed:false,reason:error.message};}
    this.policies.set(origin,policy);
    this.store.db.prepare("INSERT INTO crawl_policies(origin,state,detail,checked_at) VALUES(?,?,?,?) ON CONFLICT(origin) DO UPDATE SET state=excluded.state,detail=excluded.detail,checked_at=excluded.checked_at")
      .run(origin,policy.allowed?"read":"blocked",policy.reason||"robots.txt checked",new Date().toISOString());
    if(policy.allowed) for(const sitemap of policy.sitemaps) {const u=governmentUrl(sitemap);if(u)this.store.enqueue(u);}
    return policy;
  }
  async fetchPage(start) {
    let url=start;
    for(let redirects=0;redirects<=5;redirects++) {
      const policy=await this.policy(new URL(url).origin);
      if(!policy.allowed)throw new Error(policy.reason);
      if(policy.parser.isAllowed(url,CRAWLER_AGENT)===false)throw new Error("robots_disallowed");
      const response=await this.request(url,policy.delay);
      if([301,302,303,307,308].includes(response.status)) {
        url=governmentUrl(response.headers.location,url);
        if(!url)throw new Error("redirect_out_of_scope");
        continue;
      }
      if([401,403,429,503].includes(response.status)||rejectionPage(response.body.toString("utf8"))) {
        // A refused document is not a robots policy for every public document.
        // Rate limiting or service overload still stops this origin for the run.
        if([429,503].includes(response.status)){
          this.policies.set(new URL(url).origin,{allowed:false,reason:"site_access_blocked"});
          this.store.db.prepare("UPDATE crawl_policies SET state='blocked',detail=?,checked_at=? WHERE origin=?").run("site_access_blocked_http_"+response.status,new Date().toISOString(),new URL(url).origin);
        }
        throw new Error("site_access_blocked_http_"+response.status);
      }
      if(response.status!==200)throw new Error("http_"+response.status);
      return {...response,url};
    }
    throw new Error("redirect_limit");
  }
  async ingest(response) {
    const type=String(response.headers["content-type"]||"").split(";")[0].toLowerCase();
    const text=response.body.toString("utf8"),url=response.url;
    if(/xml/.test(type)||/<(?:sitemapindex|urlset)\b/.test(text.slice(0,500))) {
      const $=load(text,{xml:true});
      if(!$("sitemapindex,urlset").length)throw new Error("unsupported_xml");
      $("loc").each((_,el)=>{const link=governmentUrl($(el).text().trim(),url);if(link)this.store.enqueue(link);});
      return "sitemap";
    }
    const isPdf=type==="application/pdf"&&response.body.subarray(0,5).toString()==="%PDF-";
    if(!isPdf && !["text/html","application/xhtml+xml","text/plain"].includes(type))throw new Error("unsupported_media_type");
    let extracted;
    if(isPdf) extracted={...await extractPdf(response.body),title:decodeURIComponent(new URL(url).pathname.split("/").at(-1)),links:[]};
    else extracted=extractHtml(text);
    if(!/\b(nofollow|none)\b/i.test(String(response.headers["x-robots-tag"]||""))) for(const raw of extracted.links) {const link=governmentUrl(raw,url);if(link)this.store.enqueue(link);}
    const id="doc_"+contentHash(url).slice(0,24);
    if(extracted.noindex||/noindex|none/i.test(String(response.headers["x-robots-tag"]||""))) {this.store.deactivate(id);return "noindex";}
    if(!extracted.sections.length)throw new Error("no_extractable_content");
    const hash=contentHash(JSON.stringify(extracted.sections));
    if(this.store.current(id)?.content_hash===hash&&this.store.documentHealthy(id)) {this.store.markChecked(id,new Date().toISOString());return "unchanged";}
    if(!this.embedder)throw new Error("embedding_model_not_ready");
    const chunks=sourceChunks(extracted.sections,text=>this.embedder.countTokens(text)),vectors=[];
    if(!chunks.length)throw new Error("no_indexable_chunks");
    for(let i=0;i<chunks.length;i+=8) {this.signal?.throwIfAborted();vectors.push(...await this.embedder.embed(chunks.slice(i,i+8).map(c=>c.body)));}
    this.store.put({id,url,title:extracted.title||url,kind:"official_document",contentHash:hash,fetchedAt:new Date().toISOString(),publishedAt:extracted.publishedAt,mediaType:type},chunks,vectors);
    return extracted.emptyPages?.length?"partial_pdf":"indexed";
  }
  async crawl({limit=500,retryBlocked=false}={}) {
    if(!Number.isInteger(limit)||limit<1||limit>50000)throw new Error("Invalid crawl batch limit.");
    if(retryBlocked)this.store.db.prepare("UPDATE frontier SET state='pending' WHERE state IN ('blocked','error')").run();
    for(const seed of ["https://www.gov.im/","https://www.gov.im/sitemap.xml"])this.store.enqueue(seed);
    let processed=0;
    while(processed<limit) {
      this.signal?.throwIfAborted();
      const row=this.store.db.prepare("SELECT * FROM frontier WHERE state='pending' ORDER BY rowid LIMIT 1").get();
      if(!row)break;
      let state,error=null;
      try {const response=await this.fetchPage(row.url);state=await this.ingest(response);}
      catch(err) {error=String(err.message).slice(0,300);state=/block|disallowed|robots|out_of_scope/.test(error)?"blocked":"error";}
      this.store.db.prepare("UPDATE frontier SET state=?,attempts=attempts+1,error=?,checked_at=? WHERE url=?").run(state,error,new Date().toISOString(),row.url);
      processed++;
      if(!this.policies.get(row.origin)?.allowed) {
        this.store.db.prepare("UPDATE frontier SET state='blocked',error=?,checked_at=? WHERE origin=? AND state='pending'").run(error||"origin_blocked",new Date().toISOString(),row.origin);
      }
    }
    return {processed,...this.store.stats(),completeness:"Discovered public URLs only; blocked, unsupported and undiscovered content is not indexed."};
  }
}
