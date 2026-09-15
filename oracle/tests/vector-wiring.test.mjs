// The vector index was built on 9 September 2026 and then left to drift: it
// was only ever refreshed by a manual command, so 40 of 223 indexable claims
// had no vector four days later, and nothing reported the lag. Retrieval must
// follow the ledger on its own, say which mode actually served an answer, and
// keep the entailment gate lexical.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KnowledgeBase } from "../lib/kb.mjs";
import { VectorStore, contentHash } from "../lib/vector-store.mjs";
import { ManxRetrieval, ledgerFreshness } from "../lib/manx-retrieval.mjs";
import { answer } from "../lib/brain.mjs";
import { META_MARKER } from "../lib/segmenter.mjs";
import { localEmbedder, DEFAULT_MODEL_CACHE, EMBEDDING_MODEL, EMBEDDING_REVISION } from "../lib/embeddings.mjs";

const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;
// A stub embedder whose vectors encode a hand-chosen "meaning" so semantic
// neighbours can be arranged without a model.
function stubEmbedder(meaning = () => [1, 0, 0]) {
  return { countTokens: words, calls: 0, async embed(texts) { this.calls += texts.length; return texts.map(meaning); } };
}
const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
function manxClaim(kb, text, extra = {}) {
  return kb.upsertClaim({ text, topic: "Isle of Man fixture", jurisdiction: "IM", kind: "learned", sources: [{ url: "https://www.gov.im/fixture/" + text.length }], support: 1, ...extra }).claim;
}
function harness(t, { embedder = stubEmbedder(), getEmbedder } = {}) {
  const kb = new KnowledgeBase(":memory:");
  const store = new VectorStore(":memory:", { modelId: "test", dimensions: 3 });
  const retrieval = new ManxRetrieval(kb, null, { store, getEmbedder: getEmbedder || (async () => embedder), debounceMs: 5 });
  t.after(() => { retrieval.close(); kb.close(); });
  return { kb, store, retrieval, embedder };
}

test("the ledger announces every claim write and a failing listener never breaks the write", () => {
  const kb = new KnowledgeBase(":memory:");
  const seen = [];
  kb.onClaimChange(() => { throw new Error("listener bug"); });
  const off = kb.onClaimChange((e) => seen.push(e.change));
  const { claim } = kb.upsertClaim({ text: "A fixture claim about Manx ferries with a source.", topic: "ferries", jurisdiction: "IM", kind: "learned", sources: [{ url: "https://www.gov.im/ferries" }] });
  kb.upsertClaim({ text: claim.text, sources: [{ url: "https://www.gov.im/ferries-2" }] });
  kb.upsertClaim({ text: "A seed fixture claim about Manx harbours.", topic: "harbours", kind: "seed", sources: [{ url: "https://www.gov.im/harbours" }] });
  kb.replaceSources(kb.upsertClaim({ text: "A seed fixture claim about Manx harbours." }).claim.id, [{ url: "https://www.gov.im/harbours-new" }]);
  kb.contradictClaim(claim.id, "fixture contradiction", "test");
  assert.deepEqual(seen, ["create", "merge", "create", "merge", "sources", "contradict"]);
  off();
  kb.upsertClaim({ text: "A third fixture claim that nobody is listening to any more.", jurisdiction: "IM" });
  assert.equal(seen.length, 6, "unsubscribe stops notifications");
  kb.close();
});

test("a claim written to the ledger is embedded without anyone running the index command, and a retraction removes it", async (t) => {
  const { kb, store, retrieval, embedder } = harness(t);
  const first = await retrieval.watch();
  assert.equal(first.state, "current");
  assert.deepEqual(retrieval.stats().ledger, { indexable: 0, indexed: 0, missing: 0, stale: 0 });

  const claim = manxClaim(kb, "Fixture: pets travelling to the Island with their owners must follow the animal health rules.");
  assert.equal(retrieval.stats().ledger.missing, 1, "health shows the lag the moment the write lands");
  await settle(); await retrieval.pending;
  assert.equal(retrieval.sync.state, "current");
  assert.equal(retrieval.sync.lastReason, "ledger_write");
  assert.deepEqual(retrieval.stats().ledger, { indexable: 1, indexed: 1, missing: 0, stale: 0 });
  assert.equal(store.current("claim_" + claim.id)?.active, 1);
  assert.equal(embedder.calls, 1, "only the new claim was embedded");

  // Unchanged claims are not re-embedded on the next pass.
  manxClaim(kb, "Fixture: a second claim about harbour dues payable at Douglas.");
  await settle(); await retrieval.pending;
  assert.equal(embedder.calls, 2);
  assert.equal(retrieval.sync.unchanged, 1);

  kb.upsertClaim({ text: claim.text, status: "retracted", support: 0 });
  await settle(); await retrieval.pending;
  assert.equal(store.current("claim_" + claim.id)?.active, 0, "a retracted claim is deactivated in the index");
  assert.deepEqual(retrieval.stats().ledger, { indexable: 1, indexed: 1, missing: 0, stale: 0 });
  assert.deepEqual((await retrieval.focus("pets travelling with owners")).claims.map((c) => c.id).filter((id) => id === claim.id), []);
});

test("writes that land during a sync are coalesced into exactly one further pass", async (t) => {
  let release; const gate = new Promise((resolve) => { release = resolve; });
  let loads = 0;
  const embedder = stubEmbedder();
  const { kb, retrieval } = harness(t, { getEmbedder: async () => { loads++; if (loads === 1) await gate; return embedder; } });
  const running = retrieval.watch();
  manxClaim(kb, "Fixture: one claim written while the first sync waits for the model.");
  manxClaim(kb, "Fixture: another claim written while the first sync waits for the model.");
  await settle();
  assert.equal(loads, 1, "the second sync did not start while the first was running");
  release(); await running;
  await settle(); await retrieval.pending;
  assert.equal(loads, 2, "one follow-up pass, not one per write");
  assert.equal(retrieval.stats().ledger.missing, 0);
});

test("without the local model the index reports itself unavailable, answers fall back to keywords, and the model is not hammered", async (t) => {
  let attempts = 0;
  const { kb, retrieval } = harness(t, { getEmbedder: async () => { attempts++; throw new Error("offline model missing"); } });
  const claim = manxClaim(kb, "Fixture: the House of Keys dissolves ahead of a general election.");
  const sync = await retrieval.watch();
  assert.equal(sync.state, "model_unavailable");
  assert.match(sync.error, /offline model missing/);
  assert.equal(retrieval.stats().sync.state, "model_unavailable");
  assert.equal(retrieval.stats().ledger.missing, 1, "health does not pretend the claim is indexed");
  manxClaim(kb, "Fixture: a further claim written while the model is unavailable.");
  await settle(); await retrieval.pending;
  assert.equal(attempts, 1, "no retry per write inside the back-off window");
  const focused = await retrieval.focus("House of Keys dissolves");
  assert.equal(focused.retrievalMode, "ledger_only_index_empty");
  assert.equal(focused.claims[0]?.id, claim.id, "keyword retrieval still answers");
});

test("semantic hits carry the same trust weighting as keyword hits, and every focus path says which retrieval ran", async (t) => {
  const kb = { focus: () => ({ claims: [], coverage: "none", coverageRatio: 0, budgetUsed: 0 }), getClaim: (id) => ({ c_weak: { id, jurisdiction: "IM", status: "single_source", trust: 0.2, text: "weak fixture", topic: "t", sources: [{url:"https://www.gov.im/weak"}] }, c_strong: { id, jurisdiction: "IM", status: "verified", trust: 0.95, text: "strong fixture", topic: "t", sources: [{url:"https://www.gov.im/strong"}] } })[id] };
  const store = new VectorStore(":memory:", { modelId: "test", dimensions: 3 });
  t.after(() => store.close());
  const put = (id, claimId) => store.put({ id, url: "https://www.gov.im/" + id, title: "Fixture", kind: "ledger_claim", claimId, contentHash: contentHash(JSON.stringify([kb.getClaim(claimId).text,kb.getClaim(claimId).topic,kb.getClaim(claimId).sources,null])), fetchedAt: new Date().toISOString() }, [{ body: "fixture body with no query words", tokens: 6, section: "Fixture" }], [[1, 0, 0]]);
  put("claim_c_weak", "c_weak"); put("claim_c_strong", "c_strong");
  const retrieval = new ManxRetrieval(kb, null, { store, getEmbedder: async () => stubEmbedder() });
  const focused = await retrieval.focus("unrelated wording");
  assert.equal(focused.retrievalMode, "hybrid");
  assert.deepEqual(focused.claims.map((c) => c.id), ["c_strong", "c_weak"], "equal similarity, higher trust first");
  assert.equal((await retrieval.focus("anything", { jurisdiction: "Jersey" })).retrievalMode, "ledger_only_out_of_scope");
  assert.equal(retrieval.stats().ledger, null, "a stub ledger reports no freshness rather than a wrong number");
});

test("the answer event stream and the saved episode record the retrieval mode", async (t) => {
  const kb = new KnowledgeBase(":memory:"); t.after(() => kb.close());
  const retrieval = { focus: async () => ({ claims: [], coverage: "none", coverageRatio: 0, budgetUsed: 0, retrievalMode: "keyword_fallback_model_unavailable" }) };
  const events = {};
  await answer({ kb, retrieval, question: "What is the capital of the Isle of Man?", sessionId: "fixture", emit(type, data) { events[type] = data; },
    runModel: async ({ onDelta }) => { onDelta("Douglas. " + META_MARKER + JSON.stringify({ used: [], confidence: .5, expedition: false })); return { costUsd: 0, model: "fixture" }; } });
  assert.equal(events.focus.retrievalMode, "keyword_fallback_model_unavailable");
  assert.equal(events.meta.retrievalMode, "keyword_fallback_model_unavailable");
  assert.equal(kb.db.prepare("SELECT retrieval_mode FROM episodes WHERE id=?").get(events.meta.episodeId).retrieval_mode, "keyword_fallback_model_unavailable");
  const plain = {};
  await answer({ kb, question: "What is the capital of the Isle of Man?", sessionId: "fixture", emit(type, data) { plain[type] = data; },
    runModel: async ({ onDelta }) => { onDelta("Douglas. " + META_MARKER + JSON.stringify({ used: [], confidence: .5, expedition: false })); return { costUsd: 0, model: "fixture" }; } });
  assert.equal(plain.focus.retrievalMode, "keyword", "no retrieval layer means plain keyword, said plainly");
});

test("freshness counts stale vectors for claims that left the indexable set", async (t) => {
  const { kb, store, retrieval } = harness(t);
  const claim = manxClaim(kb, "Fixture: a claim that will be contested after indexing.");
  await retrieval.syncLedger();
  assert.deepEqual(ledgerFreshness(store, kb), { indexable: 1, indexed: 1, missing: 0, stale: 0 });
  kb.upsertClaim({ text: claim.text, status: "retracted", support: 0 });
  assert.deepEqual(ledgerFreshness(store, kb), { indexable: 0, indexed: 0, missing: 0, stale: 1 });
});

test("with the real local model a paraphrase reaches the claim it is about, which keywords alone miss", {
  skip: !fs.existsSync(path.join(DEFAULT_MODEL_CACHE, EMBEDDING_MODEL, EMBEDDING_REVISION, "onnx/model_quantized.onnx")),
}, async (t) => {
  const previousFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error("Network forbidden in offline test"); };
  t.after(() => { globalThis.fetch = previousFetch; });
  const kb = new KnowledgeBase(":memory:");
  const store = new VectorStore(":memory:");
  const retrieval = new ManxRetrieval(kb, null, { store, getEmbedder: localEmbedder, debounceMs: 5 });
  t.after(() => { retrieval.close(); kb.close(); });
  const pets = manxClaim(kb, "Fixture: pets travelling to the Island with their owners must follow the animal health rules before arrival.");
  manxClaim(kb, "Fixture: the House of Keys dissolves ahead of a general election and candidates are nominated.");
  manxClaim(kb, "Fixture: harbour dues are payable at Douglas for visiting vessels.");
  const sync = await retrieval.watch();
  assert.equal(sync.state, "current"); assert.equal(sync.indexed, 3);
  const question = "can I bring my dog";
  assert.deepEqual(kb.focus(question, { jurisdiction: "Isle of Man" }).claims, [], "no keyword overlap at all");
  const focused = await retrieval.focus(question);
  assert.equal(focused.retrievalMode, "hybrid");
  assert.equal(focused.claims[0]?.id, pets.id, "the semantic index bridges the paraphrase");
});

test("a write from another process is caught up when health is read, without waiting for a restart", async (t) => {
  const { kb, retrieval, embedder } = harness(t);
  await retrieval.watch();
  const claim = manxClaim(kb, "Fixture: the terminal verifier confirmed this claim from outside the server process.");
  await settle(); await retrieval.pending;
  assert.deepEqual(retrieval.stats().ledger, { indexable: 1, indexed: 1, missing: 0, stale: 0 });
  // The verifier tool opens the database itself; no listener in this process fires.
  const row = kb.db.prepare("SELECT sources FROM claims WHERE id=?").get(claim.id);
  const sources = JSON.parse(row.sources).map((s) => ({ ...s, verification: { status: "confirmed", checkedAt: "2026-09-15T10:00:00.000Z" } }));
  kb.db.prepare("UPDATE claims SET sources=? WHERE id=?").run(JSON.stringify(sources), claim.id);
  const before = embedder.calls;
  const seen = retrieval.stats().ledger;
  assert.equal(seen.missing, 1, "health reports the lag honestly");
  await settle(); await retrieval.pending;
  assert.equal(retrieval.sync.lastReason, "freshness");
  assert.deepEqual(retrieval.stats().ledger, { indexable: 1, indexed: 1, missing: 0, stale: 0 });
  assert.equal(embedder.calls, before + 1, "only the changed claim was re-embedded");
});

test("closing the retrieval layer while an embedding is outstanding neither throws nor writes to a closed store", async (t) => {
  let release; const gate = new Promise((resolve) => { release = resolve; });
  const embedder = { countTokens: words, async embed(texts) { await gate; return texts.map(() => [1, 0, 0]); } };
  const kb = new KnowledgeBase(":memory:");
  const store = new VectorStore(":memory:", { modelId: "test", dimensions: 3 });
  const retrieval = new ManxRetrieval(kb, null, { store, getEmbedder: async () => embedder, debounceMs: 5 });
  t.after(() => kb.close());
  manxClaim(kb, "Fixture: a claim whose embedding is still in flight when the server shuts down.");
  const sync = retrieval.watch();
  await settle();
  retrieval.close();
  release();
  const outcome = await sync;
  assert.ok(["closed", "interrupted", "current"].includes(outcome.state), outcome.state);
  assert.equal(retrieval.closed, true);
  assert.doesNotThrow(() => retrieval.stats(), "stats after close reports rather than throws");
});
