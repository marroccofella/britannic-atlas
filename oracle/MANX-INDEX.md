# MANX vector knowledge base

## Public-document proof added — 9 September 2026

The bounded consultation snapshot has now added **31 unique public Government documents and 1,753 passages/vectors**. The live index totals **216 documents and 1,939 passages/vectors**. All five semantic and hybrid retrieval probes passed at rank one; whole-Government coverage is still unknown and main-site discovery remains blocked. Eleven PDF pages have no extractable text and are reported, not counted as fully read. See [the ingestion proof](MANX-INGESTION-PROOF-20260909.md) for scope, provenance, exclusions and verification. The delivery figures below are retained as the earlier baseline.

## Coverage at delivery — 9 September 2026

This is a working local semantic index, not a complete Government mirror.

| Material | Indexed | What that means |
|---|---:|---|
| Existing sourced MANX ledger claims | 185 | Existing evidence/status retained; not newly verified by this work |
| Searchable passages / vectors | 186 / 186 | Real 384-dimensional embeddings plus SQLite full-text search |
| Newly downloaded Government documents | 0 | Automated access failed before discovery |
| Blocked discovery seeds | 2 | Government home page and sitemap; neither was fetched as content |
| Undiscovered Government pages | Unknown | The site size and percentage covered cannot be established |

The attempted `https://www.gov.im/robots.txt` returned an HTTP 200 rejection page, not usable crawl rules. The crawler recorded `robots_access_blocked_or_not_text` and stopped the origin. The queued home page and `https://www.gov.im/sitemap.xml` are therefore blocked, not proof that those pages are missing. It did not bypass the firewall, change identity, use a proxy, authenticate, or index the rejection HTML.

Oracle was restarted locally and its health endpoint confirmed that the index is attached. The 23 conversations and 139 saved turns were retained. A consistent pre-change database backup is stored privately under `.ensemble_reviews/`.

The user chose: **build the index and report blocked coverage**. No further crawl or monitoring is scheduled. Source access/reuse permissions have not been independently established. An authorised readable export can be imported later.

## What is connected

Oracle's existing belief ledger stays authoritative for claim status, sources, retractions and trust. A separate `oracle/data/manx-sources.db` contains documents, token-bounded passages, native sqlite-vec vectors, a full-text index, crawl policies and a persistent URL queue. Existing chat history remains in its original store; private conversations, reviews and model answers are not bulk-indexed as Government evidence.

The answer route retrieves from both semantic and keyword search, limits passages per document, checks jurisdiction and age, then combines the results with the existing ledger under a bounded context budget. Meaning-based matches can bridge wording such as hotel refurbishment versus tourist accommodation assistance. Similarity is a relevance signal, not a truth score.

Downloaded HTML/PDF passages carry their exact source URL, title, section/page, retrieval timestamp, publication date where available, and a content hash. Used excerpts are saved with the answer episode so later index updates do not rewrite the evidence behind a saved answer. Source passages are untrusted data, never instructions. They cannot become independently verified facts simply by being indexed or receiving peer agreement.

The pinned on-device model is `Xenova/all-MiniLM-L6-v2`, revision `751bff37182d3f1213fa05d7196b954e230abad9`, quantized, mean-pooled, normalized, 384 dimensions. Embedding text stays on this computer. Relevant retrieved excerpts still go to the configured answer provider when Oracle generates an answer, as existing ledger context does.

## Local commands

From the project directory, after `npm install`:

```text
npm run oracle:index -- setup
npm run oracle:index -- ledger
npm run oracle:index -- status
npm run oracle:index -- search "grants to restore a run-down hotel"
npm run oracle:index -- crawl --limit 500
```

- `setup` explicitly downloads the pinned model. Subsequent embedding/search loads that revision offline, without silent downloads.
- `ledger` reads the running Oracle ledger read-only, indexes only sourced IM claims in supported evidence states, and deactivates removed/retracted claims on refresh. Since 13 September 2026 the running Oracle does this itself: every claim write schedules an incremental re-embed and startup catches up on anything written while it was not running, so this command is only needed to build a separate index (`--db`) or to rebuild from scratch. `/api/health` → `retrieval.ledger.missing` shows whether anything is waiting.
- `crawl` resumes pending public URLs. It uses one request at a time, at least two seconds apart, respects robots and indexing directives, and caps page size, redirects, per-document chunks and the discovered URL queue.
- Only after access conditions have changed, use `crawl --retry-blocked --limit 500`. This retries failed/disallowed URLs; it is not a bypass.
- `--db <path>` selects a separate index. `ledger --ledger <path>` selects a source ledger.
- `/api/health` exposes index counts, the last query mode, `retrieval.ledger` freshness (indexable, indexed, missing, stale) and `retrieval.sync` (state, last run, reason, counts, error). If the local model cannot load, retrieval falls back to keywords and the sync reports `model_unavailable`; a failed vector index falls back to the existing ledger. The answer's Focus panel and the saved episode both record which mode served it.

The vector index is derived/rebuildable. Do not delete the main `oracle.db`, chat records, or source snapshots when rebuilding it. A different embedding model or dimension must use a separate index; mixed vector spaces are rejected.

## Authorised export import

Put the export and a JSON manifest in one directory. Each file must stay inside that directory, including after resolving symlinks. The manifest must declare authorisation and the real original Government URL and retrieval date:

```json
{
  "authorised": true,
  "documents": [
    {
      "file": "document.html",
      "url": "https://www.gov.im/path/to/the-original-page/",
      "title": "Original page title",
      "retrievedAt": "2026-09-09T12:00:00Z"
    }
  ]
}
```

That is a format example, not a real source citation. Then run:

```text
npm run oracle:index -- import --manifest "<export-directory>/manifest.json"
```

PDF extraction needs Python with `pypdf`; set `ORACLE_PDF_PYTHON` to that interpreter. It does not run PDF actions, scripts, renderers or OCR. An encrypted or image-only PDF is reported as unreadable; PDFs with some empty pages are partial. Text extraction may not preserve complex table layout, so technical tables require review before reliance.

## Boundaries and remaining gaps

- Only discovered public HTTPS gov.im pages/subdomains are in crawler scope. Culture Vannin, Learn Manx, Tynwald, HMRC and other sources need separately authorised connectors/ingestion; their existing sourced ledger claims are still retrievable.
- PDF and HTML are supported; Office files, archives, images, interactive forms, search/query traps, pages over 6 MB, long documents, and authenticated services are not silently treated as covered.
- Crawl batches are bounded and resumable; there is no promise to enumerate the entire site. Unlinked pages and external sites remain unknown.
- Source excerpts older than 365 days are excluded by default, tightened to two days for current/news questions. Retrieval time does not prove the source's figures are current. Existing ledger claims retain their own volatility/trust policy.
- The embedding tokenizer enforces 224-token passages with up to 32-token overlap. The answer-context budget is an estimate for the answer model, not a guarantee of its exact token count.
- Large indexes use native SQLite nearest-neighbour search, not an approximate-neighbour server. This is appropriate for a local corpus; large-scale performance and semantic relevance still need evaluation on a sizeable accessible Government corpus.
- The answer prompt now forbids guessed rates, authorities and workarounds for high-stakes gaps. Meta-conversation questions and several incomplete follow-ups no longer become research targets. This is not a claim that every dialogue, transcription or confidence defect in the supplied transcript is fixed.
- No paid research was automatically dispatched to fill blocked crawl gaps. Crawling and embeddings do not themselves incur answer-model charges.

## Verification and dependencies

The regression suite covers native vector persistence, model-space mismatch, replacement/deactivation, source freshness, false lexical matches, off-site/private-network rejection, robots/redirect handling, 200-status WAF rejection, extraction/noindex, token windows, fallback, retraction, answer-context integration, and saved source excerpts. A real cached-model test disables network fetches and verifies a paraphrased hotel-grant match. These checks are not a substitute for factual evaluation on documents that remain inaccessible.

Original vector-implementation checks: **374 tests passed, zero skipped, Oracle lint clean**. This includes real PDF extraction using the configured Python interpreter, offline embeddings, and a regression where 90 stale neighbours previously hid a fresh result. No paid answer/research call was used for these checks. The live health check is not a claim of browser-level answer-quality acceptance.

Both full and focused MOMM review attempts returned no completed external reviews (Claude and Copilot timed out; quorum 0/2). There were no findings or suggestions to accept or reject. Independent review is **deferred, not passed**; Oracle remains a supervised internal alpha. See the private `.ensemble_reviews/ledger.html` and `manx-vector-coverage.json` reports.

The new dependency tree exposed an installer ZIP advisory and an image-library advisory. The high-severity ZIP issue is patched through the `adm-zip 0.6.0` override; Transformers' image dependency is overridden to patched `sharp 0.35.4`. A moderate destination-symlink advisory remains in adm-zip with no published patched release at implementation time. That component belongs to the ONNX installation path; the crawler/importer never accepts or extracts ZIP files. Keep installation directories trusted. Existing unrelated project audit findings were not force-upgraded.

Upstream advisories: [ZIP allocation issue](https://github.com/advisories/GHSA-xcpc-8h2w-3j85), [remaining ZIP symlink issue](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9), [image-library issue](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).


## Ongoing verification (13 September 2026)

Use `npm run oracle:verify` for the current full gate and read `work/mani-verification-latest.json` for its dated result. It requires PDF extraction and cached-model tests to run, and also checks the website and isolated browser journeys; missing prerequisites or skipped tests cannot produce a passing full report. Earlier counts and review outcomes above are historical, not the current run.

Ledger freshness compares the current text, topic and source provenance with each active indexed document. Changed source URLs and inactive eligible documents are refreshed. A withdrawal arriving during embedding cannot reactivate that claim, and shutdown during model loading cannot write to a closed store. The five-minute model retry window applies to populated-index queries as well as scheduled indexing; a cached failure does not keep extending the window. Similarity improves retrieval only: explicit citations and the existing answer-content checks still determine evidence use.

See [the full testing audit](../docs/mani-full-testing-audit-20260913.md) for reproducible failures, browser coverage and acceptance limits. This update received two completed MOMM reviews; reproduced findings were corrected and the full local gate passed afterward. The audit records every review disposition and the remaining acceptance limits.
