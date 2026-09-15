import {evidenceCurrent} from './evidence-ledger.mjs';
// Hybrid retrieval over the Manx ledger: the lexical FTS5 ranking that every
// answer has always used, fused with a local semantic index so a paraphrase
// ("can I bring my dog") still finds the claim it is about. The index is
// derived from the ledger and follows it automatically: every claim write
// schedules an incremental re-embed, and health reports how far behind it is.
// Similarity is a relevance signal only; status, trust and the entailment
// gate are unchanged and remain lexical.
import { VectorStore, contentHash } from "./vector-store.mjs";
import { localEmbedder } from "./embeddings.mjs";
import { sourceChunks } from "./source-content.mjs";
import { coverageFor, CLAIM_VIEWS, TRUST } from "./kb.mjs";

// Which ledger claims belong in the index: sourced Manx claims in an evidence
// state an answer may cite. Hypotheses, contested and retracted claims stay out.
const INDEXABLE_SQL = "SELECT id FROM claims WHERE jurisdiction='IM' AND status IN ('single_source','corroborated','verified') AND sources IS NOT NULL AND sources <> '[]' ORDER BY id";
// After the local model fails to load, do not retry it on every write.
const MODEL_RETRY_MS = 5 * 60_000;
const indexable=c=>c?.jurisdiction==='IM'&&CLAIM_VIEWS.answer.includes(c.status)&&c.sources?.length&&evidenceCurrent(c);
// Key order must not decide whether a claim is re-embedded: two provenance
// objects with the same fields in a different order hash the same.
const stableJson = (value) => JSON.stringify(value, (_key, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
export const ledgerHash = (c) => contentHash(stableJson([c.text, c.topic, c.sources, c.provenance?.sourceEvidence || null]));

export async function indexLedger(store, kb, embedder, { signal, onProgress = () => {} } = {}) {
  const ids = kb.db.prepare(INDEXABLE_SQL).all();
  const retained = new Set(); let indexed = 0, unchanged = 0;
  for (const row of ids) {
    signal?.throwIfAborted();
    const c = kb.getClaim(row.id);
    if (!indexable(c)) continue;
    const id = "claim_" + c.id; retained.add(id);
    const hash = ledgerHash(c);
    const stored = store.current(id);
    if (stored?.active===1 && stored.content_hash === hash && store.documentHealthy(id)) { unchanged++; continue; }
    const chunks = sourceChunks([{ section: c.topic, body: c.text }], (text) => embedder.countTokens(text)), vectors = [];
    for (let i = 0; i < chunks.length; i += 8) vectors.push(...await embedder.embed(chunks.slice(i, i + 8).map((chunk) => chunk.body)));
    signal?.throwIfAborted();
    const current=kb.getClaim(row.id);
    if(!indexable(current)||ledgerHash(current)!==hash){retained.delete(id);continue;}
    if (!chunks.length) {retained.delete(id);continue;}
    store.put({ id, url: c.sources[0].url, title: c.topic || "Existing MANX ledger claim", kind: "ledger_claim", claimId: c.id, contentHash: hash, fetchedAt: new Date().toISOString(), mediaType: "application/x-manx-ledger-claim" }, chunks, vectors);
    indexed++; if (indexed % 25 === 0) onProgress({ indexed, unchanged });
  }
  // A claim that left the indexable set (retracted, contested, source dropped)
  // is deactivated so a stale vector can never bring it back.
  for (const row of store.db.prepare("SELECT id FROM documents WHERE kind='ledger_claim' AND active=1").all()) if (!retained.has(row.id)) store.deactivate(row.id);
  return { indexed, unchanged, retained: retained.size };
}

/** How far the vector index lags the ledger. Null when the ledger cannot be read (test stubs). */
export function ledgerFreshness(store, kb) {
  if (!kb?.db?.prepare) return null;
  const live = new Map(kb.db.prepare(INDEXABLE_SQL).all().map(r=>kb.getClaim(r.id)).filter(indexable).map(c=>[c.id,ledgerHash(c)]));
  const indexed = store.db.prepare("SELECT claim_id,content_hash FROM documents WHERE kind='ledger_claim' AND active=1").all();
  const current = new Set(indexed.filter(row=>live.get(row.claim_id)===row.content_hash&&store.documentHealthy("claim_"+row.claim_id)).map(row=>row.claim_id)).size;
  return { indexable: live.size, indexed: current, missing: live.size - current, stale: indexed.length - current };
}

export class ManxRetrieval {
  constructor(kb, file, { store = null, getEmbedder = localEmbedder, debounceMs = 1500 } = {}) {
    this.kb = kb; this.store = store || new VectorStore(file); this.getEmbedder = getEmbedder;
    this.mode = "not_yet_queried";
    this.debounceMs = debounceMs;
    this.sync = { state: "idle", lastRunAt: null, lastReason: null, indexed: 0, unchanged: 0, retained: 0, error: null };
    this.pending = null; this.dirty = null; this.timer = null; this.unsubscribe = null; this.controller = null; this.modelFailedAt = 0; this.closed=false; this.modelError=null;
  }
  close() {
    if(this.closed)return;
    this.closed=true;this.dirty=null;this.sync={...this.sync,state:'closed'};
    this.unsubscribe?.(); this.unsubscribe = null;
    clearTimeout(this.timer); this.timer = null;
    clearTimeout(this.expiryTimer); this.expiryTimer = null;
    clearInterval(this.catchUpTimer); this.catchUpTimer = null;
    this.controller?.abort();
    this.store.close();
  }
  stats() {
    try {
      const ledger = ledgerFreshness(this.store, this.kb);
      // A health read that finds the index behind (writes from another
      // process: the terminal verifier or dream runner) schedules the catch-up
      // itself instead of reporting the lag until the next restart.
      if (ledger && (ledger.missing || ledger.stale) && !this.pending && !this.timer && !this.closed && this.sync.state !== "model_unavailable" && this.unsubscribe) this.schedule("freshness");
      return { ...this.store.stats(), queryMode: this.mode, integrity: this.store.integrity(), ledger, sync: { ...this.sync } };
    }
    catch { return { chunks: 0, queryMode: "ledger_fallback_index_unavailable", ledger: null, sync: { ...this.sync } }; }
  }

  /**
   * Make the index follow the ledger: subscribe to claim writes (debounced,
   * coalesced) and run a catch-up pass now. Returns that first pass's status.
   */
  watch({ catchUpMs = 5 * 60_000 } = {}) {
    if(this.closed)return Promise.resolve(this.sync);
    if (!this.unsubscribe && typeof this.kb.onClaimChange === "function") this.unsubscribe = this.kb.onClaimChange(() => this.schedule("ledger_write"));
    // Writers this process cannot hear (the terminal verifier and dream
    // runner, a raw SQL migration) leave the index behind without a single
    // listener firing. A periodic freshness check catches that up.
    if (!this.catchUpTimer && catchUpMs > 0) {
      this.catchUpTimer = setInterval(() => {
        if (this.closed || this.pending) return;
        try { const fresh = ledgerFreshness(this.store, this.kb); if (fresh && (fresh.missing || fresh.stale)) this.schedule("catch_up"); }
        catch { /* the next tick tries again */ }
      }, catchUpMs);
      this.catchUpTimer.unref?.();
    }
    return this.syncLedger("startup");
  }
  schedule(reason) {
    if(this.closed)return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.syncLedger(reason); }, this.debounceMs);
    this.timer.unref?.();
  }
  /** One sync at a time; a write that lands mid-sync queues exactly one more pass. */
  syncLedger(reason = "manual") {
    if(this.closed)return Promise.resolve(this.sync);
    if (this.pending) { this.dirty = reason; return this.pending; }
    const run = (async () => {
      if (this.sync.state === "model_unavailable" && Date.now() - this.modelFailedAt < MODEL_RETRY_MS && reason !== "manual") return this.sync;
      this.sync = { ...this.sync, state: "running", lastReason: reason };
      let embedder;
      this.controller=new AbortController();
      try { embedder = await this.availableEmbedder(reason==='manual');this.controller.signal.throwIfAborted(); }
      catch (error) {
        if(this.closed){this.controller=null;return this.sync;}
        this.controller=null;
        if(error!==this.modelError||!this.modelFailedAt)this.modelFailedAt = Date.now();
        this.sync = { ...this.sync, state: "model_unavailable", error: String(error?.message || error).slice(0, 200), lastRunAt: new Date().toISOString() };
        return this.sync;
      }
      try {
        const result = await indexLedger(this.store, this.kb, embedder, { signal: this.controller.signal });
        this.sync = { state: ledgerFreshness(this.store,this.kb)?.missing ? "behind" : "current", lastRunAt: new Date().toISOString(), lastReason: reason, ...result, error: null };
        this.scheduleExpiry();
      } catch (error) {
        this.sync = { ...this.sync, state: this.closed ? "closed" : this.controller.signal.aborted ? "interrupted" : "failed", error: String(error?.message || error).slice(0, 200), lastRunAt: new Date().toISOString() };
      } finally { this.controller = null; }
      return this.sync;
    })();
    this.pending = run.finally(() => {
      this.pending = null;
      if (!this.closed && this.dirty) { const again = this.dirty; this.dirty = null; this.schedule(again); }
    });
    return this.pending;
  }

  /**
   * A source excerpt leaves the indexable set the moment it expires, but the
   * index only learns that on the next write. Without this, health flipped to
   * "stale" two hours after every weather read with nothing to write.
   */
  scheduleExpiry() {
    clearTimeout(this.expiryTimer); this.expiryTimer = null;
    if (this.closed || !this.kb?.db?.prepare) return;
    try {
      const row = this.kb.db.prepare("SELECT MIN(json_extract(provenance,'$.sourceEvidence.expiresAt')) AS next FROM claims WHERE kind='source_excerpt' AND status<>'retracted' AND json_valid(provenance) AND json_extract(provenance,'$.sourceEvidence.expiresAt') > strftime('%Y-%m-%dT%H:%M:%fZ','now')").get();
      const at = row?.next ? Date.parse(row.next) : NaN;
      if (!Number.isFinite(at)) return;
      this.expiryTimer = setTimeout(() => { this.expiryTimer = null; this.schedule("evidence_expiry"); }, Math.min(2_147_000_000, Math.max(1_000, at - Date.now() + 1_000)));
      this.expiryTimer.unref?.();
    } catch { /* nothing expiring to watch */ }
  }

  async availableEmbedder(force=false){
    if(!force&&this.modelFailedAt&&Date.now()-this.modelFailedAt<MODEL_RETRY_MS)throw this.modelError||new Error('Local model retry is paused');
    try{const model=await this.getEmbedder();this.modelFailedAt=0;this.modelError=null;return model;}
    catch(error){this.modelFailedAt=Date.now();this.modelError=error;throw error;}
  }

  async focus(question, { jurisdiction = "Isle of Man", budgetTokens = 2200, signal } = {}) {
    const base = this.kb.focus(question, { jurisdiction, budgetTokens });
    if (!["Isle of Man", "IM", "Manx"].includes(jurisdiction)) return { ...base, retrievalMode: "ledger_only_out_of_scope" };
    let chunks;try{chunks=this.store.stats().chunks;}catch{this.mode='ledger_fallback_index_unavailable';return {...base,retrievalMode:this.mode};}
    if (!chunks) { this.mode = "ledger_only_index_empty"; return { ...base, retrievalMode: this.mode }; }
    signal?.throwIfAborted(); let vector = null;
    try { const embedder = await this.availableEmbedder(); [vector] = await embedder.embed([String(question).slice(0, 8000)]); this.mode = "hybrid"; }
    catch(error) { signal?.throwIfAborted();if(error!==this.modelError||!this.modelFailedAt)this.modelFailedAt=Date.now();this.modelError=error;this.mode = "keyword_fallback_model_unavailable"; }
    signal?.throwIfAborted();
    const recent = /\b(today|latest|current|now|news)\b/i.test(question);
    let hits;
    try { hits = this.store.search(question, vector, { limit: 24, maxAgeDays: recent ? 2 : 365 }); }
    catch { this.mode = "ledger_fallback_index_unavailable"; return { ...base, retrievalMode: this.mode }; }
    const ranked = new Map();
    base.claims.forEach((c, i) => ranked.set(c.id, { claim: c, score: 1 / (40 + i) }));
    for (const hit of hits) {
      let c;
      if (hit.kind === "ledger_claim") {
        c = this.kb.getClaim(hit.claim_id);
        if (!indexable(c)||hit.content_hash!==ledgerHash(c)||!this.store.documentHealthy(hit.document_id)) continue;
        // The vector hit is a bounded verbatim passage. Re-expanding it to a
        // whole large source can exceed the answer budget and lose the hit.
        const passage=String(hit.body||'').trim(),recordText=String(c.text||'').replace(/\s+/g,' ').trim();
        if(c.kind==='source_excerpt'&&recordText.length>4000&&passage.length>=40&&recordText.includes(passage))c={...c,text:passage,retrievalProjection:'indexed_passage',sourceRecordCharacters:recordText.length};
      } else {
        if(!this.store.documentHealthy(hit.document_id))continue;
        c = { id: "c_" + contentHash(hit.document_id + ":" + hit.content_hash + ":" + hit.ordinal).slice(0, 16), text: hit.body, topic: hit.section || hit.title,
          status: "single_source", confidence: .55, trust: .45, verified_at: null, evidenceKind: "source_excerpt",
          fetchedAt: hit.fetched_at, publishedAt: hit.published_at, contentHash: hit.content_hash,
          sources: [{ url: hit.url + (hit.page ? "#page=" + hit.page : ""), title: hit.title + (hit.page ? " — page " + hit.page : ""), primary: true }] };
      }
      // The same trust weighting the lexical ranking applies, so a semantic
      // hit on a weakly trusted claim does not outrank a verified one.
      const weighted = hit.score * (TRUST.relevanceFloor + TRUST.relevanceSpan * Math.min(1, Number(c.trust) || 0));
      const existing = ranked.get(c.id);
      ranked.set(c.id, { claim: existing?.claim?.retrievalProjection==='indexed_passage'?existing.claim:c, score: (existing?.score || 0) + weighted });
    }
    const claims = []; let used = 0;
    for (const item of [...ranked.values()].sort((a, b) => b.score - a.score)) {
      const cost = Math.ceil((item.claim.text.length + item.claim.topic.length + 200) / 4);
      if (used + cost > budgetTokens) continue;
      claims.push(item.claim); used += cost; if (claims.length >= 14) break;
    }
    const coverage = coverageFor(question, claims.slice(0, 4).map((c) => c.text + " " + c.topic));
    return { claims, coverage: coverage.level, coverageRatio: coverage.ratio, budgetUsed: used, candidates: ranked.size, retrievalMode: this.mode };
  }
}
