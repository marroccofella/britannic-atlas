import { load } from "cheerio";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function rejectionPage(text) {
  return /^\s*Request Rejected\s*$/i.test(String(text)) || /checking your browser before accessing[\s\S]{0,600}(?:process is automatic|redirect)/i.test(String(text).slice(0,5000)) || /<title[^>]*>\s*(?:request rejected|access denied|just a moment|attention required)/i.test(text) ||
    /the requested URL was rejected|please (?:enable javascript and cookies|verify you are human)|(?:complete|solve) (?:the |this |a )?captcha challenge|captcha challenge (?:is )?required/i.test(String(text).slice(0,20000));
}
export function extractHtml(html) {
  if (rejectionPage(html)) throw new Error("access_blocked");
  const $ = load(html);
  const directives = $('meta[name="robots"],meta[name="MANXKnowledgeBot"]').map((_,e)=>$(e).attr("content")||"").get().join(",").toLowerCase();
  const title = ($("title").first().text() || $("h1").first().text()).trim().slice(0,300);
  const links = /\b(nofollow|none)\b/.test(directives) ? [] : $("a[href]").map((_,e)=>$(e).attr("href")).get().slice(0,30000);
  if (directives.includes("noindex") || directives.includes("none")) return {title,links,sections:[],noindex:true};
  $("script,style,noscript,nav,header,footer,aside,form,button,[hidden],[aria-hidden='true']").remove();
  const main = $("main").first().length ? $("main").first() : $("[role='main']").first().length ? $("[role='main']").first() : $("article").first().length ? $("article").first() : $("body");
  const sections = [];
  let section = title;
  main.find("h1,h2,h3,h4,p,li,tr,pre").each((_,el)=>{
    const node=$(el);
    if (node.parents("p,li,tr,pre").length) return;
    const text = el.tagName === "tr" ? node.find("th,td").map((_,cell)=>$(cell).text().trim()).get().join(" | ") : node.text().replace(/\s+/g," ").trim();
    const sourceStatus=/^(?:Closed|Opened|Results updated|Feedback updated)\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}[.!]?$/i.test(text);
    if (sourceStatus) sections.push({section:title,body:text,page:null,sourceStatus:true});
    else if (/^h[1-4]$/.test(el.tagName)) section=text.slice(0,300);
    else if (text.length>20) sections.push({section,body:text,page:null});
  });
  if (!sections.length) {
    const body=main.text().replace(/\s+/g," ").trim();
    if (body.length>80) sections.push({section:title,body,page:null});
  }
  const publishedAt = $('meta[property="article:published_time"],meta[name="date"]').first().attr("content") || null;
  return {title,links,sections,publishedAt};
}
// Token count comes from the embedding model, while the quoted words remain original.
export function sourceChunks(sections, countTokens) {
  const result = [];
  for (const section of sections) {
    const words=String(section.body||"").trim().split(/\s+/).filter(Boolean);
    let start=0;
    while (start<words.length) {
      let low=start+1,high=Math.min(words.length,start+224),end=start;
      while (low<=high) {
        const mid=Math.floor((low+high)/2);
        if (countTokens(words.slice(start,mid).join(" "))<=224) {end=mid;low=mid+1;} else high=mid-1;
      }
      if (end===start) { start++;continue; } // Binary blobs/huge tokens are not prose.
      const body=words.slice(start,end).join(" ");
      result.push({body,section:section.section||"",page:section.page||null,tokens:countTokens(body)});
      if (result.length>=4000) throw new Error("document_chunk_limit");
      if (end===words.length) break;
      let overlap=end;
      while(overlap>start+1 && countTokens(words.slice(overlap-1,end).join(" "))<=32) overlap--;
      start=Math.max(start+1,overlap);
    }
  }
  return result;
}
export function extractPdf(bytes, { python=process.env.ORACLE_PDF_PYTHON || "python", signal }={}) {
  signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const child=spawn(python,[fileURLToPath(new URL("../tools/extract-source-pdf.py",import.meta.url))],{stdio:["pipe","pipe","pipe"],windowsHide:true});
    let output="",error="",settled=false;
    const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(err)reject(err);else resolve(value);};
    const abort=()=>{child.kill();finish(signal.reason||new Error('PDF extraction cancelled'));};
    const timer=setTimeout(()=>{child.kill();finish(new Error("PDF extraction timed out"));},30000);
    signal?.addEventListener('abort',abort,{once:true});
    child.on("error",e=>finish(e));child.stdin.on("error",()=>{});
    child.stdout.on("data",b=>{output+=b;if(output.length>8000000){child.kill();finish(new Error("PDF extracted text limit"));}});
    child.stderr.on("data",b=>{error=(error+b).slice(-500);});
    child.on("close",code=>{if(code!==0)return finish(new Error("PDF extraction failed: "+error));try{finish(null,JSON.parse(output));}catch{finish(new Error("Invalid PDF extraction output"));}});
    child.stdin.end(bytes);
  });
}
