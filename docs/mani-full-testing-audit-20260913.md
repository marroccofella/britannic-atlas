# Mani full local testing audit — 13 September 2026

The supplied handoff described useful improvements, but its 599 passing tests and one skipped PDF test did not establish complete local verification. This audit reproduced that baseline, added failure cases for retrieval and conversation logic, corrected the failures, and introduced one repeatable full verification command. Everything remains local and uncommitted.

## Result and evidence

**Local verification passed: 624 Oracle tests and 46 website tests, zero failures, cancellations or skips.** Project lint, TypeScript, production build, the PDF runtime and the isolated browser journeys also passed. The two cached embedding-model tests ran locally; no model download or paid answer call was needed.

- [Final machine-readable report](../work/mani-verification-2026-09-13T01-22-54-711Z/report.json)
- [Browser assertions](../work/mani-verification-2026-09-13T01-22-54-711Z/browser/browser.json)
- [Phone conversation screenshot](../work/mani-verification-2026-09-13T01-22-54-711Z/browser/browser-390.png)
- [Desktop conversation screenshot](../work/mani-verification-2026-09-13T01-22-54-711Z/browser/browser-1280.png)
- [Phone explorer screenshot](../work/mani-verification-2026-09-13T01-22-54-711Z/browser/explorer-390.png)
- [Initial reliability failures](../work/mani-reliability-before.log) and [corrected regression run](../work/mani-reliability-after.log)

The live server was confirmed idle, refreshed and checked at `http://127.0.0.1:4242`. Health reports version `2026-09-13-full-verification`, 223 of 223 eligible ledger claims indexed, zero missing, zero stale and no sync error. These numbers describe eligible indexed records, not the number of independently verified facts or total website coverage. Existing conversations and databases were retained.

## Flaws found and corrected

| Problem and cause | Correction | Verification |
|---|---|---|
| An inactive index document could be treated as unchanged because only its hash was compared. | Reuse requires an active document with the current fingerprint. | An eligible claim with a manually deactivated document is indexed again. A retracted claim is not revived. |
| Source-link corrections were invisible to text-only fingerprints; health compared claim IDs and could report a stale index as current. | Fingerprints include text, topic and source provenance; health compares current fingerprints. | Change a source URL without changing the claim text, detect the lag, sync, and verify the new URL. |
| Shutdown while the embedding model loaded could leave a late operation touching a closed store. | Start the cancellation guard before loading; closure is idempotent and prevents queued work from restarting. | Close during a deliberately suspended model load and assert no embedding or later write. |
| A claim withdrawn during embedding could be written back as active. | Recheck eligibility and fingerprint after asynchronous embedding. | Retract during a suspended embedding and verify no active document is restored. |
| A populated index could retry a broken model on every answer despite the advertised five-minute pause. | Share the model retry guard between answers and indexing; cached failures do not move the retry deadline. | Repeated queries produce an explicit keyword fallback without another load attempt or a sliding deadline. |
| “Learn more about that” could attach Manx sources to a foreign subject, or turn personal/product dialogue into public research. | Retain the factual subject's jurisdiction and require an appropriate public subject. | France follow-up and personal-context regression cases. |
| Knowledge maps presented a limited keyword search too absolutely, counted foreign primary sources as Manx, and described ledger dates as evidence dates. | Explain keyword misses and the first-40 limit; say primary sources and ledger record date. | More-than-40 fixtures, unmatched paraphrases, foreign primary sources and date-label checks. |
| A real inline citation disappeared when the model omitted its ID from its metadata. | Retain allowlisted inline citations as well as metadata citations, then apply the existing answer-content checks. | Valid citations survive in answer metadata and the saved episode; invented IDs and unrelated propositions cannot gain a verified badge. |
| Relevant retrieved evidence could go uncited without a clear explanation. | Report retrieved-versus-cited counts and show an “Evidence use” disclosure. Uncited retrieval does not manufacture a citation or upgrade the answer. | Answer-pipeline regression and keyboard-operated browser disclosure with a synthetic uncited answer. |
| A fresh visit logged a console 404 because the UI restored history before the first conversation existed. | The client requests an optional history read that returns an empty result. Strict missing-record requests still return 404. | Fresh-page browser check, optional/strict API assertions, and saved-history reload. |
| An apparently green test command could omit PDF extraction or other required checks. | A full verification runner requires prerequisites and complete passing test summaries; failures, timeouts, cancellations and skips fail the run. | Result-parser tests plus an actual full run with the configured PDF interpreter. |

The new suite also checks concurrent answers retain their own retrieval-mode labels. That test already passed and did not justify a separate implementation change. One initial fixture incorrectly tried to revive a permanently retracted claim; it was corrected to test a still-eligible claim with an inactive document, preserving the existing retraction policy.

## Repeating the check

Run `npm run oracle:verify` from the project root. It runs these stages and writes their individual results:

1. Python `pypdf` availability and pinned local model presence.
2. All Oracle tests, including real PDF extraction and cached offline embeddings.
3. Project lint, TypeScript and a fresh website build.
4. Website tests against that build, including discovery catalogue, evidence labels and connected routes.
5. Browser journeys against a separate temporary local database, with research and MOMM disabled.

The browser checks a real free knowledge-map answer, low-confidence speech admission, source-disclosure keyboard access, accessible button names, saved-history reload, page lifecycle events, and layouts at 390 and 1280 pixels. It also drills into the explorer, follows browser Back/Forward, prepares a question in the same conversation, restores the previous draft, and verifies that browsing dispatches no answer or research request. A synthetic answer isolates the uncited-evidence display; it is not represented as a successful live model answer.

The browser runs with `Permissions-Policy: unload=()`. The app registers no `unload` or `beforeunload` listener in this test and produces no captured page or console errors. This establishes the app's own behavior in the tested browser; it does not identify or modify an extension's injected `content.js` in the user's separate browser session. Lifecycle events are simulated, not proof of every browser's actual back/forward-cache behavior.

Reports and screenshots are retained under `work/mani-verification-<timestamp>/`. `work/mani-verification-latest.json` points to the latest result, including failed runs. The report compares a named set of core code, dialogue, server, verification tools and regression files at the beginning and end. A change or unreadable file fails the run. This is not a fingerprint of the entire repository. Work artifacts and private review logs remain excluded from shared history.

## Acceptance work that remains

| Area | What remains unproven |
|---|---|
| Real assistive use | Physical microphone recognition, accents, interruption under actual playback, installed voices, screen-reader announcements and listening comprehension need a human session on the intended device. Keyboard and naming checks are not a full accessibility certification. |
| Live model answers | The existing recorded provider example is historical. This run made no new paid provider call. Correctly preserving citations does not force the model to cite every relevant retrieved record, and lexical checks are not a complete semantic factuality assessment. |
| Public website access | Deterministic tests cover reader recovery and rejection behavior, not current access to every site. Blocked, authenticated, image-only and unsupported material is not automatically readable. No universal website-access claim is made. |
| External services and scale | Provider quotas/outages, full-corpus factual recall, long-running load and all browsers/devices are not certified by this local gate. |
| External peer review | Completed with two usable reviews, meeting the required quorum. Both requested modifications; all actionable findings were reproduced and corrected, then locally rechecked. Grok timed out without findings. Details and every suggestion disposition are below. |

This update improves reliability and makes incomplete verification visible. Mani remains a supervised internal alpha until the remaining acceptance work is completed.


## Peer review and final dispositions

MOMM run `rev_20260913011244_njxh`: Claude completed in 151 seconds (MODIFY, five findings), Antigravity in 167 seconds (MODIFY, one finding), Grok timed out after 360 seconds. Quorum: 2/2. The report assigned an agreement score of zero because the two independently raised selector findings used different IDs; inspection established that they concern the same defect. No critical finding was reported. The highest reported severity was WARNING in the client, retrieval and verification runner. Reviewer output was treated as untrusted evidence.

The six new failing peer-regression cases and the failing first-visit browser check are recorded in [the pre-fix log](../work/mani-peer-before.log) and [the browser reproduction](../work/mani-peer-browser-before.log). The corrected nested cases run within the final full gate. An additional unavailable-index test preserved the fallback while removing the expensive scan; snapshot tests cover unambiguous hashing, mid-run changes and unreadable sources.

| Reviewer | Finding or suggestion | Disposition | Reason / verification |
|---|---|---|---|
| claude | Empty-history selector lacks its ID prefix | applied | Reproduced the visible restore error, corrected the selector, and assert the first-message status before the first ask. Evidence: oracle/tools/verify-mani-browser.mjs; work/mani-peer-browser-before.log |
| antigravity | Empty-history selector lacks its ID prefix | applied-with-modification | Same reproduced selector defect as Claude. The exception was caught by restoreConversation, not unhandled; the visible error and skipped branch were real. Evidence: oracle/tools/verify-mani-browser.mjs; work/mani-peer-browser-before.log |
| claude | Every answer rehashes the entire ledger | applied | Read index availability without computing full-ledger freshness; retain an explicit fallback if that read fails. Evidence: oracle/tests/nested/mani-review.test.mjs: 200-claim read counter and unavailable-index fallback |
| claude | Full gate misses nested tests | applied | Use the same recursive test glob as oracle:test. The nested regression file was omitted before and now runs in the full gate. Evidence: oracle/tests/nested/mani-review.test.mjs: full gate discovers nested tests; work\mani-verification-2026-09-13T01-22-54-711Z\report.json |
| claude | Learning jurisdiction can come from an unrelated action | applied | Take a pending jurisdiction only when the pending action also supplies the research subject. Evidence: oracle/tests/nested/mani-review.test.mjs: unrelated pending action jurisdiction |
| claude | Limited spoken map implies complete counts or an unavailable list | applied | Say the summary covers only the first 40 and explicitly restrict source counts and newest record dates to that sample. Evidence: oracle/tests/nested/mani-review.test.mjs: limited spoken maps |
| claude | Avoid the hot-path scan and cache full freshness | applied-with-modification | Removed the unnecessary answer-path scan. Health remains computed from live data; a revision cache would need invalidation for both ledger and document-store changes. Evidence: oracle/tests/nested/mani-review.test.mjs: answer retrieval does not rehash the entire ledger |
| claude | Derive post-sync freshness only from retained counts | rejected | Retained counts cannot prove that unchanged IDs still have current text and provenance after writes during asynchronous embedding. Keep the post-sync fingerprint check. Evidence: oracle/tests/mani-reliability.test.mjs: retraction during embedding and changed provenance |
| claude | Reactivate inactive vectors without loading or embedding | deferred | This is a further offline/performance feature requiring a separate reactivation path and model-load admission change. The current eligible-document repair is correct and tested. Evidence: oracle/tests/mani-reliability.test.mjs: inactive eligible document restoration |
| claude | Fingerprint source before and after tests with unambiguous boundaries | applied | Compare the expanded named source set at start and finish; changed or unreadable sources fail the report. Prefix path and content bytes with their lengths. Evidence: oracle/tests/nested/mani-review.test.mjs: verification fingerprints; oracle/tools/verification-sources.mjs; work\mani-verification-2026-09-13T01-22-54-711Z\report.json |
| claude | Make retrieval mode a local variable | rejected | There is no await between the final mode assignment and the return in focus. Concurrent queries already return their own modes; the dedicated overlap regression passes. Evidence: oracle/tests/mani-reliability.test.mjs: concurrent answers report their own retrieval mode |
| claude | Pin factual learning after its offer is consumed | applied | Added a regression proving the factual subject remains learnable when its pending offer is gone; no production change was required. Evidence: oracle/tests/nested/mani-review.test.mjs: ordinary factual topic remains learnable |
| claude | Report unfinished todo tests explicitly | applied | Count TODO outcomes, reject them and explain the unfinished work instead of blaming a truncated log. Evidence: oracle/tests/nested/mani-review.test.mjs: todo tests are identified as unfinished verification |
| claude | Strengthen low-confidence browser confirmation | applied | Check the exact clarification message, clarify mode, zero cost, null model and non-researchable metadata, with no expedition event. Evidence: oracle/tools/verify-mani-browser.mjs: low-confidence speech assertions |
| claude | Remove the bundled Playwright fallback | rejected | An explicit module override and a local Playwright installation already take precedence. The bundled fallback supports this configured desktop; missing modules make the gate fail rather than silently skipping it. Evidence: oracle/tools/verify-mani.mjs: Playwright resolution and browser failure status |
| antigravity | Use the research label to avoid nested learning briefs | applied-with-modification | Reuse a label only when it reconstructs the existing generated brief exactly. Generic labels must not replace a factual question. Evidence: oracle/tests/nested/mani-review.test.mjs: repeated learning and generic research labels |
| antigravity | Extract the source-label ternary into a helper | rejected | Style-only change with no demonstrated behavior defect. The displayed evidence label and keyboard disclosure are covered by browser checks. Evidence: oracle/tools/verify-mani-browser.mjs: uncited-retrieval disclosure |
| antigravity | Use recursive test discovery | applied | Aligned the full gate with the canonical recursive test command and proved the nested regression is included. Evidence: oracle/tests/nested/mani-review.test.mjs: full gate discovers nested tests |

All rows were appended to the private dispositions ledger with this run ID. No current authentication failure or provider outage was reported. Grok's timeout was treated as a status, not a finding; no login or retry was requested. The reviewed artifact and all subsequent local corrections remain uncommitted.
