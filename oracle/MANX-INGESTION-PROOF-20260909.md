# MANX public-document ingestion proof — 9 September 2026

The live local vector database now contains **31 downloaded public Government documents**, in addition to its 185 existing sourced ledger entries: **1,939 searchable passages and real 384-dimensional vectors** in total.

This proves a bounded public collection can be downloaded, extracted, embedded offline, persisted and retrieved through Mani. It does **not** prove a complete scrape of Government websites or verify the legal currency of the documents.

## Measured scope

The snapshot freezes the ten consultation pages linked directly from the saved [Government consultation homepage](https://consult.gov.im/), plus their same-host supporting publications. Crawl rules were read; requests were sequential and respected the five-second crawl delay. No accounts, active form submissions or main-site spider were used.

| Stage | Result |
|---|---:|
| Selected consultation landing pages downloaded | 10 / 10 |
| Selected supporting PDF URLs downloaded | 24 / 24 |
| Byte-identical PDF aliases deduplicated | 3 |
| Unique PDFs indexed | 21 |
| Total unique documents indexed | 31 |
| PDF pages in preserved originals | 576 |
| Pages with extracted text | 565 |
| Blank or unreadable text-layer pages | 11 across 9 PDFs |
| New token-bounded passages / vectors | 1,753 / 1,753 |
| Additional discovered attachments excluded | 6 |

The six excluded attachments comprise three other-host files and three respondent-derived results PDFs deferred for content/privacy review. The nine partially extracted PDFs are explicitly labelled; no OCR or visual assertion that the eleven empty pages are genuinely blank was made. All extracted words were accounted for in the chunking check, which is not a claim that extraction preserves every table or image.

## Retrieval proof

After closing and reopening the database, all five paraphrased questions retrieved the expected publication family at rank one in both semantic-only and hybrid search:

| Question topic | Semantic rank | Hybrid rank |
|---|---:|---:|
| Traveller identity checks on ferry sailings | 1 | 1 |
| Angling restrictions to protect Atlantic salmon | 1 | 1 |
| Charging framework for registering data assets | 1 | 1 |
| Childcare arrangements in the parent survey | 1 | 1 |
| Phased rollout in the draft Capacity Act code | 1 | 1 |

All five also passed through Mani's actual retrieval integration against the live index. Embedding and retrieval ran with network fetch disabled, and made zero answer-model calls. A separate product-question check confirmed that “What is MOMM?” bypasses Government retrieval and model use.

## Provenance and limitations

Raw bytes, original URL, fetch receipt, timestamp and SHA-256 hash are retained. Extracted sections/pages and indexed chunks link back to the original. Each new passage is labelled as a consultation publication, proposal or historical policy—not proof of current law. This is a private research index; no blanket redistribution licence is claimed.

Main `www.gov.im` discovery and `legislation.gov.im` crawl rules remain blocked. The archives homepage was accessible but yielded no usable sections with the current extractor. Whole-Government page count and coverage percentage remain **unknown**. No WAF bypass, proxy, identity rotation or unauthorised export was used.

The original ledger document rows were preserved. The main chat database was opened read-only by the ingestion process. An initial preservation check also included a concurrently streaming answer and therefore failed when that answer legitimately changed; that report is retained. The rerun checks only previously completed turns and passes. The vector index was backed up before promotion.

Private machine-readable evidence is in `oracle/data/manx-public-consultations-20260909/proof.json`; the adjacent manifests, raw files and extracted records provide the complete scoped audit trail. This local data is not published to Atlas or GitHub.
