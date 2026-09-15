// Explicit local administration. No scheduled crawling, model calls or login handling.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { VectorStore,contentHash } from "../lib/vector-store.mjs";
import { localEmbedder } from "../lib/embeddings.mjs";
import { indexLedger } from "../lib/manx-retrieval.mjs";
import { GovernmentCrawler,governmentUrl } from "../lib/government-crawler.mjs";
import { extractHtml,extractPdf,sourceChunks } from "../lib/source-content.mjs";
import { trust } from "../lib/kb.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const args=process.argv.slice(2),command=args.shift()||"status";
const option=name=>{const at=args.indexOf(name);return at>=0?args[at+1]:null;};
const dbFile=path.resolve(option("--db")||path.join(root,"oracle/data/manx-sources.db"));
const store=new VectorStore(dbFile);
const abort=new AbortController();process.once("SIGINT",()=>abort.abort());
try {
  if(command==="setup") {
    const model=await localEmbedder({download:true});
    const vectors=await model.embed(["Manx government services"]);
    console.log(JSON.stringify({ready:true,model:model.id,dimensions:vectors[0].length,local:true}));
  } else if(command==="ledger") {
    // Read-only access avoids taking the running Oracle's writer lease.
    const db=new DatabaseSync(path.resolve(option("--ledger")||path.join(root,"oracle/data/oracle.db")),{readOnly:true});
    try {
      const kb={db,getClaim(id){const row=db.prepare("SELECT * FROM claims WHERE id=?").get(id);return row?{...row,sources:JSON.parse(row.sources||"[]"),trust:trust(row)}:null;}};
      console.log(JSON.stringify(await indexLedger(store,kb,await localEmbedder(),{signal:abort.signal,onProgress:p=>console.log(JSON.stringify(p))})));
    } finally {db.close();}
  } else if(command==="crawl") {
    // Check public robots before loading the embedding model. A blocked site is
    // never queried via alternative agents, proxies or authenticated sessions.
    const crawler=new GovernmentCrawler(store,{signal:abort.signal});
    const policy=await crawler.policy("https://www.gov.im");
    if(policy.allowed)crawler.embedder=await localEmbedder();
    const report=await crawler.crawl({limit:Number(option("--limit")||500),retryBlocked:args.includes("--retry-blocked")});
    console.log(JSON.stringify(report,null,2));
  } else if(command==="import") {
    // An explicit manifest must accompany an authorised export. Local filenames
    // cannot claim Government provenance merely because their content mentions it.
    const manifestFile=path.resolve(option("--manifest")||"");
    const manifest=JSON.parse(fs.readFileSync(manifestFile,"utf8"));
    if(manifest.authorised!==true||!Array.isArray(manifest.documents)||manifest.documents.length>50000)throw new Error("An authorised document manifest is required.");
    const model=await localEmbedder(),base=path.dirname(manifestFile);let indexed=0;
    for(const item of manifest.documents) {
      abort.signal.throwIfAborted();const url=governmentUrl(item.url);
      if(!url)throw new Error("Document source must be a public gov.im URL.");
      const file=fs.realpathSync(path.resolve(base,item.file));
      const relative=path.relative(fs.realpathSync(base),file);
      if(relative.startsWith("..")||path.isAbsolute(relative))throw new Error("Export document escapes manifest directory.");
      if(fs.statSync(file).size>6*1024*1024)throw new Error("Document size limit.");
      const bytes=fs.readFileSync(file),pdf=path.extname(file).toLowerCase()===".pdf";
      const extracted=pdf?await extractPdf(bytes):extractHtml(bytes.toString("utf8"));
      if(extracted.noindex)continue;
      const title=String(item.title||extracted.title||url).slice(0,300);
      const chunks=sourceChunks(extracted.sections,text=>model.countTokens(text)),vectors=[];
      for(let i=0;i<chunks.length;i+=8)vectors.push(...await model.embed(chunks.slice(i,i+8).map(c=>c.body)));
      if(!chunks.length)continue;
      const fetchedAt=new Date(item.retrievedAt).toISOString();
      if(Date.parse(fetchedAt)>Date.now())throw new Error("Document retrieval date cannot be in the future.");
      store.put({id:"doc_"+contentHash(url).slice(0,24),url,title,kind:"official_document",contentHash:contentHash(JSON.stringify(extracted.sections)),fetchedAt,publishedAt:item.publishedAt,mediaType:pdf?"application/pdf":"text/html"},chunks,vectors);indexed++;
    }
    console.log(JSON.stringify({indexed}));
  } else if(command==="search") {
    const dbOption=args.indexOf("--db");
    const query=args.filter((_,i)=>dbOption<0||(i!==dbOption&&i!==dbOption+1)).join(" ");
    if(!query)throw new Error("Provide a search query.");
    const [embedding]=await (await localEmbedder()).embed([query]);
    console.log(JSON.stringify(store.search(query,embedding),null,2));
  } else if(command==="status")console.log(JSON.stringify(store.stats(),null,2));
  else throw new Error("Use setup, ledger, crawl, import, search or status.");
} finally {store.close();}
