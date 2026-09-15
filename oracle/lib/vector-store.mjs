// A separate, local source corpus. It never changes belief/verification scores.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as sqliteVec from "sqlite-vec";
import { EMBEDDING_ID, EMBEDDING_DIMENSIONS } from "./embeddings.mjs";
import { ftsQuery, tokens } from "./kb.mjs";

export const contentHash = text => createHash("sha256").update(String(text)).digest("hex");
export class VectorStore {
  constructor(file, { modelId = EMBEDDING_ID, dimensions = EMBEDDING_DIMENSIONS } = {}) {
    if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) throw new Error("Invalid vector dimensions.");
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file, { allowExtension: true });
    try {
      sqliteVec.load(this.db); this.db.enableLoadExtension(false);
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
      this.db.exec([
        "CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
        "CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,url TEXT NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('official_document','ledger_claim')),claim_id TEXT,content_hash TEXT NOT NULL,fetched_at TEXT NOT NULL,published_at TEXT,media_type TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);",
        "CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY,document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,ordinal INTEGER NOT NULL,page INTEGER,section TEXT NOT NULL,body TEXT NOT NULL,tokens INTEGER NOT NULL,UNIQUE(document_id,ordinal));",
        "CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(body,section,content='chunks',content_rowid='id');",
        "CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN INSERT INTO chunks_fts(rowid,body,section) VALUES(new.id,new.body,new.section); END;",
        "CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN INSERT INTO chunks_fts(chunks_fts,rowid,body,section) VALUES('delete',old.id,old.body,old.section); END;",
        "CREATE TABLE IF NOT EXISTS frontier(url TEXT PRIMARY KEY,origin TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,http_status INTEGER,error TEXT,checked_at TEXT);",
        "CREATE INDEX IF NOT EXISTS frontier_state_origin ON frontier(state,origin);",
        "CREATE TABLE IF NOT EXISTS crawl_policies(origin TEXT PRIMARY KEY,state TEXT NOT NULL,detail TEXT,checked_at TEXT NOT NULL);",
        "CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(chunk_id INTEGER PRIMARY KEY,embedding float[" + dimensions + "] distance_metric=cosine);",
      ].join("\n"));
      if(!this.db.prepare('PRAGMA table_info(chunks)').all().some(c=>c.name==='body_hash'))this.db.exec('ALTER TABLE chunks ADD COLUMN body_hash TEXT');
      const existing = this.db.prepare("SELECT value FROM settings WHERE key='embedding'").get();
      const contract = JSON.stringify({ modelId, dimensions });
      if (existing && existing.value !== contract) throw new Error("Embedding model mismatch. Build a separate index; never mix vector spaces.");
      this.db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('embedding',?)").run(contract);
      this.dimensions = dimensions; this.modelId = modelId;
      this.db.exec("PRAGMA optimize;");
    } catch (error) { this.db.close(); throw error; }
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  vector(values) {
    if (!Array.isArray(values) && !(values instanceof Float32Array)) throw new Error("Invalid embedding.");
    if (values.length !== this.dimensions || Array.from(values).some(v => !Number.isFinite(v)) || !Array.from(values).some(v => v !== 0)) throw new Error("Invalid embedding dimensions or values.");
    return new Uint8Array(new Float32Array(values).buffer);
  }
  current(id) { return this.db.prepare("SELECT * FROM documents WHERE id=?").get(id); }
  put(document, chunks, vectors) {
    if (!["official_document", "ledger_claim"].includes(document.kind) || !document.id || !document.url || !document.contentHash || !document.fetchedAt) throw new Error("Source provenance is required.");
    const source = new URL(document.url);
    if (!["http:","https:"].includes(source.protocol) || source.username || source.password || !Number.isFinite(Date.parse(document.fetchedAt))) throw new Error("Invalid source provenance.");
    if (document.kind === "official_document" && (source.protocol !== "https:" || !(source.hostname === "gov.im" || source.hostname.endsWith(".gov.im")))) throw new Error("Official document must originate at gov.im.");
    if (!chunks.length || chunks.length > 4000 || vectors.length !== chunks.length) throw new Error("Invalid chunk batch.");
    const blobs = vectors.map(v => this.vector(v));
    for (const c of chunks) if (!c.body || c.body.length > 16000 || !Number.isInteger(c.tokens) || c.tokens < 1 || c.tokens > 224) throw new Error("Invalid source chunk.");
    this.transaction(() => {
      const old = this.db.prepare("SELECT id FROM chunks WHERE document_id=?").all(document.id);
      for (const row of old) this.db.prepare("DELETE FROM chunk_vectors WHERE chunk_id=?").run(row.id);
      this.db.prepare("DELETE FROM chunks WHERE document_id=?").run(document.id);
      this.db.prepare("INSERT INTO documents(id,url,title,kind,claim_id,content_hash,fetched_at,published_at,media_type,active) VALUES(?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET url=excluded.url,title=excluded.title,kind=excluded.kind,claim_id=excluded.claim_id,content_hash=excluded.content_hash,fetched_at=excluded.fetched_at,published_at=excluded.published_at,media_type=excluded.media_type,active=1")
        .run(document.id, document.url, document.title, document.kind, document.claimId || null, document.contentHash, document.fetchedAt, document.publishedAt || null, document.mediaType || "text/plain");
      chunks.forEach((c, i) => {
        const row = this.db.prepare("INSERT INTO chunks(document_id,ordinal,page,section,body,tokens,body_hash) VALUES(?,?,?,?,?,?,?)").run(document.id, i, c.page || null, c.section || document.title, c.body, c.tokens, contentHash(c.body));
        this.db.prepare("INSERT INTO chunk_vectors(chunk_id,embedding) VALUES(?,?)").run(BigInt(row.lastInsertRowid), blobs[i]);
      });
    });
  }
  documentHealthy(id) {
    const rows=this.db.prepare('SELECT c.id,c.body,c.body_hash,v.chunk_id FROM chunks c LEFT JOIN chunk_vectors v ON v.chunk_id=c.id WHERE c.document_id=?').all(id);
    return rows.length>0&&rows.every(c=>c.chunk_id!=null&&c.body_hash===contentHash(c.body));
  }
  integrity() {
    const sqlite=this.db.prepare('PRAGMA quick_check').all().every(row=>Object.values(row)[0]==='ok');
    const foreignKeys=this.db.prepare('PRAGMA foreign_key_check').all().length;
    const missingVectors=this.db.prepare('SELECT count(*) n FROM chunks c LEFT JOIN chunk_vectors v ON v.chunk_id=c.id WHERE v.chunk_id IS NULL').get().n;
    const orphanVectors=this.db.prepare('SELECT count(*) n FROM chunk_vectors v LEFT JOIN chunks c ON c.id=v.chunk_id WHERE c.id IS NULL').get().n;
    const rows=this.db.prepare('SELECT body,body_hash FROM chunks').all();
    const unsealed=rows.filter(r=>!r.body_hash).length,changed=rows.filter(r=>r.body_hash&&r.body_hash!==contentHash(r.body)).length;
    let fts=true;try{this.db.exec("INSERT INTO chunks_fts(chunks_fts,rank) VALUES('integrity-check',1)");}catch{fts=false;}
    return {ok:sqlite&&fts&&!foreignKeys&&!missingVectors&&!orphanVectors&&!changed&&!unsealed,sqlite,fts,foreignKeys,missingVectors,orphanVectors,changed,unsealed};
  }
  deactivate(id) { this.db.prepare("UPDATE documents SET active=0 WHERE id=?").run(id); }
  markChecked(id, at) { this.db.prepare("UPDATE documents SET fetched_at=?,active=1 WHERE id=?").run(at,id); }
  search(query, embedding, { limit = 12, maxAgeDays = 365 } = {}) {
    limit = Math.max(1,Math.min(30,Math.floor(limit)));
    const candidates = new Map(), cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
    const add = (id, score, semantic = null) => { const old = candidates.get(id) || { id,score:0,semantic:null }; old.score += score; if (semantic !== null) old.semantic = semantic; candidates.set(id,old); };
    const q = ftsQuery(query);
    if (q) this.db.prepare("SELECT c.id,bm25(chunks_fts) AS rank FROM chunks_fts JOIN chunks c ON c.id=chunks_fts.rowid JOIN documents d ON d.id=c.document_id WHERE chunks_fts MATCH ? AND d.active=1 AND (d.kind='ledger_claim' OR d.fetched_at>=?) ORDER BY rank LIMIT 80").all(q,cutoff).forEach((row,i)=>add(row.id,1/(40+i)));
    if (embedding) {
      this.db.prepare("SELECT chunk_id,distance FROM chunk_vectors WHERE embedding MATCH ? AND k=80 AND chunk_id IN (SELECT c.id FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.active=1 AND (d.kind='ledger_claim' OR d.fetched_at>=?))").all(this.vector(embedding),cutoff).forEach((row,i)=>{
        if (1-row.distance >= .32) add(row.chunk_id,1/(40+i),1-row.distance);
      });
    }
    const read = this.db.prepare("SELECT c.*,d.url,d.title,d.kind,d.claim_id,d.content_hash,d.fetched_at,d.published_at,d.active FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.id=?");
    const subject = String(query).replace(/^Answer this specifically for (?:the )?Isle of Man:\s*/i,"");
    const queryTerms = [...new Set(tokens(subject).filter(t=>!["isle","man","manx"].includes(t)))];
    const counts = new Map(), result = [];
    for (const hit of [...candidates.values()].sort((a,b)=>b.score-a.score)) {
      const c=read.get(hit.id);
      if (!c || (c.body_hash!==contentHash(c.body)) || !c.active || (c.kind === "official_document" && c.fetched_at < cutoff)) continue;
      // A lone generic word such as "rules" must not turn coinage guidance into
      // evidence for optical-fibre installation. Semantic matches may use synonyms.
      const terms = new Set(tokens(c.body+" "+c.section));
      if (hit.semantic === null && queryTerms.filter(t=>terms.has(t)).length < Math.min(2,queryTerms.length)) continue;
      if ((counts.get(c.document_id)||0)>=2) continue;
      counts.set(c.document_id,(counts.get(c.document_id)||0)+1);
      result.push({...c,...hit});
      if (result.length>=limit) break;
    }
    return result;
  }
  enqueue(url, maxUrls = 50000) {
    if (this.db.prepare("SELECT count(*) AS n FROM frontier").get().n >= maxUrls) return false;
    return this.db.prepare("INSERT OR IGNORE INTO frontier(url,origin) VALUES(?,?)").run(url,new URL(url).origin).changes > 0;
  }
  stats() {
    return {
      engine:"sqlite-vec + FTS5", model:this.modelId,
      documents:this.db.prepare("SELECT kind,count(*) AS count FROM documents WHERE active=1 GROUP BY kind").all(),
      chunks:this.db.prepare("SELECT count(*) AS count FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.active=1").get().count,
      vectors:this.db.prepare("SELECT count(*) AS count FROM chunk_vectors").get().count,
      crawl:this.db.prepare("SELECT state,count(*) AS count FROM frontier GROUP BY state").all(),
      policies:this.db.prepare("SELECT * FROM crawl_policies ORDER BY origin").all(),
    };
  }
}
