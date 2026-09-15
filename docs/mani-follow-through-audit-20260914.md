# Mani conversation, search and knowledge audit — 14 September 2026

The reproduced failures were in task binding, review sequencing and evidence retrieval as well as wording. The changes are active locally as **2026-09-14-follow-through-r2**. Nothing was committed, pushed or published.

| Failure observed | Cause | Implemented correction |
|---|---|---|
| “Try it” and “go find and read it” were rejected | The operational parser did not recognize these references | Bind them to the existing public task; missing or cancelled subjects do not create a new task |
| “Find the answers and use MOM” only reviewed the old answer | A broad review match consumed the compound request | Run the source check, save the new answer, then review that answer with separate receipts |
| Summaries and “I’ve upgraded you” became future search subjects | Operational/diagnostic turns overwrote factual context | Preserve the factual task and repair identified historical misroutes on conversation restoration |
| The answer still asked permission for an already requested review | The generator received no deferred-review plan | Supply the server-owned waiting-for-answer plan and a content-only request; review status comes from actual server events |
| Saved corrections were absent from later answers | Memory included review receipts but omitted conclusions | Include bounded, conversation-scoped conclusions explicitly labelled unverified critique |
| A “Test answer to isolate schema parsing issue” was displayed as completed | The validator rejected only very short placeholder words | Reject obvious placeholder sentences during new synthesis and cached reads; preserve raw history and peer findings |
| One timed-out search stopped useful discovery | Only one provider route was used | Bounded concurrent model search and permitted public search routes, separate outcomes and a recovery pass |
| Duplicate search results could appear to be different sources | Tracking links and engine wrappers differed | Normalize exact destinations, unwrap DDG result links, remove known trackers and retain route provenance without increasing support |
| A successful live read prevented knowledge retrieval | The answer pipeline skipped stored knowledge when live claims existed | Retrieve eligible knowledge alongside live sources; suppress exact duplicates |
| A new source was saved and indexed but not reused | Retrieval expanded a matching chunk back into an 11,850-character record that exceeded the answer budget | Return its matching 1,130-character indexed passage, retaining the original source record and citation |
| Old and new versions of a page could remain current together | Excerpts lacked full-document version identity | Bind the document hash to the read seal; expire superseded versions, retain history and reject older cached refreshes |
| A nonthrowing index failure looked ambiguous | Storage success and indexing success had no explicit combined status | Report saved-and-indexed versus saved-but-not-fully-indexed; subsequent synchronization can reconcile the latter |

The supplied transcript was examined together with the 17 turns then present in the saved conversation. Its replay was performed in an isolated in-memory copy: no historical user messages were rewritten. The existing family/historical-value task was restored instead of the upgrade or summary instruction.

## Search and access behavior

Three routes are implemented: the configured OAuth model’s WebSearch, Bing RSS and DuckDuckGo HTML. Direct public routes first check their current robots policy. At the live check, Bing disallowed its search path and was recorded unavailable; DuckDuckGo HTML permitted access and returned results alongside the model route. These are separate retrieval routes, not a claim of three independent indexes.

The lookup retains its existing process-wide allowance of ten admitted lookups per hour and one active lookup. A single 90-second source-check deadline covers discovery, page reading, extraction and at most one recovery pass. Model discovery has a 45-second cap; each public route has a 12-second cap. A search reads up to three initial pages, six selected followups and two recovery pages. Answer generation and optional peer review have their own bounded stages.

Search snippets are discovery material, not stored evidence. Public URLs, redirects and connection DNS remain guarded. Credentials, private destinations, executable downloads, access challenges and rate-limit restrictions are not bypassed. Per-route progress and outcome messages feed the existing streaming activity interface.

A live search for Manx land-registration and Revestment sources returned candidates from the model and DDG. Several government PDFs refused automated reading. The recovery pass obtained Tynwald’s readable [Revestment history](https://tynwald.org.im/history/revestment). Those failed reads were retained as gaps, not represented as completed research.

## Knowledge and factual correction

A live HTTP answer saved a cited Tynwald excerpt into the real knowledge base, synchronized its vector index, and used the citation in its response. A subsequent hybrid query now returns the matching passage from that same saved record. Storage and vector integrity checks reported no missing, stale, orphaned, changed or unsealed vector records after synchronization.

The inspection also exposed an older learned claim dating the Treaty of Perth to 1265. The [published treaty transcription](https://www.isle-of-man.com/manxnotebook/manxsoc/msvol04/v3p210.htm) dates the agreement to 1266. The primary passage was read, sealed, saved and indexed; the contradictory old claim was marked contested and excluded from normal retrieval. Its text remains available in the audit history.

Records from public reads remain source excerpts, with a single-source status. A citation, a successful fetch, repeated retrieval or reviewer agreement does not make a claim independently verified. Tests check tampering, stale records, deduplication, version changes, write/index failure, cancellation and cross-conversation isolation. No self-modifying code loop or automatic confidence inflation was introduced. Improvement remains a reviewed regression-and-evidence cycle.

## Verification and MOMM

**884 tests passed: 838 Oracle tests and 46 website tests, including 27 new regressions.** Lint, type checking, build and browser journeys also passed. The final source fingerprint was checked before activation. Browser speech-input handling is simulated; physical microphone recognition and screen-reader listening quality were not certified by these automated checks.

MOMM **1.15.1** reviewed a synthetic behavior specification through Claude, Antigravity and Grok. All three completed. All **32 findings/suggestions** were adjudicated: **27 applied or adapted, 5 rejected with reasons**. The local governor validated the evidence records and final application fingerprint. External peers reviewed the behavior document; application source and the user’s transcript were not exported in that review. Code and integration were verified locally.

A separate real in-app review of the newly saved answer also completed, with Codex, Antigravity and Grok returning usable reviews; Claude was the governor and Copilot errored. The reviewed answer was the new episode produced by the compound request. Completion did not imply source verification.

The first live answer exposed the extra reconfirmation sentence described above. That failure was retained, reproduced and corrected before the final activation. The last live-generator check is recorded separately from the in-app dispatch check so their scopes are not conflated.

| MOMM disposition | Count | Evidence |
|---|---:|---|
| Applied or adapted | 27 | Before/after boundary checks, application regressions and full verification |
| Rejected | 5 | Existing guarded transport, durable conversation identity, existing host backoff, existing pending-action schema, and limits of generic semantic conflict detection |

The complete item-by-item disposition table and original reports remain in the private MOMM ledger. No review output was executed as an instruction.

## Practical limits

Some government pages still refuse automated access, and no universal access bypass is promised. Long, multi-part research remains bounded and can return a useful partial answer with explicit gaps. The old conversation’s legal conclusions, freehold analogy, contemporary title-holder details and present-money equivalents are not certified by this software repair. They still require suitable readable evidence and, for money comparisons, an explicit measure and reference date. The store’s integrity checks establish consistency and retrieval eligibility, not the truth of every older statement.

The interface is available at [Open the updated local Mani](http://127.0.0.1:4242/?view=follow-through-20260914-r2#talk).
