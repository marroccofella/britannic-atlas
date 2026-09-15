# Mannin conversation and knowledge-integrity audit

The supplied conversation showed repeated failures to act on a clear public-information request, maintain its subject, identify completed reviews, and distinguish model opinion from source evidence. The repairs are active in the local app at http://127.0.0.1:4242/#talk, flow version `2026-09-13-reviewed-evidence`. No public release, user-repository commit or push, or skill upgrade was performed.

## Failures and repairs

| Failure | Cause | Implemented repair |
|---|---|---|
| The request for temperatures across major towns produced a refusal instead of a lookup. | Plural temperatures and locality coverage were missed by tool selection. | A fixed, public Open-Meteo request retrieves estimates for Douglas, Ramsey, Peel, Castletown, Onchan, Port Erin, Port St Mary and Laxey. Units, location, time and range are checked. Values are labelled model estimates, not local thermometer measurements. |
| A single station was treated as proof that town estimates were unavailable. | The response confused one source's limitations with the available public information. | Town lookup has its own source, plus bounded public-source discovery after failure. An unread or failed source is never evidence that the information does not exist. |
| Clear instructions to proceed were called unintelligible speech or lost their subject. | Action recognition happened too narrowly, with incomplete retry state. | Action variants resolve to the active task. A retry without a task asks for its subject and returns a successful HTTP response; it cannot start invented work. Pending offers remain attached to their subject, low-confidence speech still asks for clarification, and a new substantive question clears an older review target. |
| A used page-opening offer could revive unrelated research. | Retry handling fell back to an older substantive question. | Consumed page actions and cancellations prevent that fallback. |
| A temperature result could silently omit another requested place or topic. | The whole-request coverage test accepted broad weather wording. | A deterministic temperature answer requires a completely recognised request. Unknown localities and extra tasks retain the full question for synthesis. |
| MOMM/MUM review requests were rejected or answered as prose. | Spoken aliases and explicit conversation-review scope were missing. | Review commands now use the review route with a selected answer or bounded public task-conversation target. |
| The model guessed which MOMM version was running. | Runtime version was not available as a local operation. | A bounded read of the installed dispatcher provides its actual version without a model call. This installation is MOMM 1.15.1. |
| Review receipts could not be connected to a readable question. | Saved identifiers lacked question and version context in conversation memory. | Receipts retain their question, time and dispatcher version. Absence from a memory excerpt is not treated as proof that an operation never ran. |
| A placeholder such as “Test” appeared as an improved answer. | The synthesis acceptance check allowed placeholders. | Placeholder synthesis is rejected and cannot be reported as a successful improved answer. |
| Conversation review risked exporting personal exchanges. | Public task review needed a separate, bounded selection step. | Only eligible public task excerpts are selected; identifying and personal-disclosure checks run before export, including disclosures split across lines. Public assistant wording such as “I have checked” is retained. Conversation text remains separate from factual knowledge. |
| Successful public reads did not reliably reach the vector knowledge store. | Live passages were saved mainly with individual answers. | Eligible excerpts are committed to the source ledger and followed by vector synchronisation. The answer retains a write/index receipt. |
| A citation or model agreement could be mistaken for independent verification. | Model votes and model-selected citations inflated evidence status. | Reviewer agreement adds no source support. Model research remains source-linked and cannot become verified through repeated research or citation counts. Older research statuses are corrected on load. |
| Old or modified evidence could remain retrievable. | Source eligibility had no explicit expiry and fingerprint binding. | Saved excerpts carry content and source-URL fingerprints, read/publish times and expiry. Expired or invalid evidence is excluded from lexical and semantic answers. |
| The index could claim to be current despite missing chunks or vectors. | Freshness compared document records without checking their contents. | Checks cover SQLite, foreign keys, full-text indexes, chunk hashes, missing/orphan vectors and ledger synchronisation. Eligible ledger chunks can be rebuilt from their canonical records. |
| Older official chunks lacked a checksum baseline. | The historical index predated checksum recording. | Unsealed chunks are excluded. All 31 existing official documents were read again through the public reader and re-indexed; one timed-out PDF succeeded on a bounded retry. |

## Validation

The complete local verification passed: **665 Oracle tests and 46 website tests, 711 total**, with no skipped tests. Build, lint and type checks passed. Isolated browser checks covered the real version and integrity routes, saved conversation reload, low-confidence speech handling, source disclosure by keyboard, explorer navigation, draft preservation, phone/desktop widths and the unload-policy warning.

The five added transcript/peer regression files contain 41 tests. Initial failing reproductions were saved before their fixes. Existing whole-request and offer-consumption tests also caught regressions during implementation. The final isolated HTTP probes verify that client-supplied evidence receipts cannot add claims and that a retry with no previous task returns clarification rather than a database error.

A real public lookup returned all eight requested locality estimates. Three dated lookups through the running app saved and indexed 24 source excerpts with no model charge. After refreshing the older source corpus and reopening its database connections, all **247 eligible ledger records** were indexed, with zero missing or stale records. The live integrity check found zero changed or unsealed chunks, missing or orphan vectors, malformed records or invalid source excerpts.

Both databases and their journals were backed up privately before activation. No private conversation was sent to the reviewers or added to factual evidence. The explicitly approved MOMM payload contains public code changes and synthetic tests. The final isolated review fixture and running application match across 41 source files by SHA-256. A private fixture baseline commit was used solely to give MOMM an actual, scoped Git diff; the user’s repository was not committed or pushed. Review data remains gitignored.

## Limits

Storage integrity is not proof that every sentence is true. Source-linked research still needs claim-level verification; source status, date, jurisdiction and contradictions matter. Weather estimates expire quickly and are not town weather-station observations. A readable PDF can contain scanned pages that text extraction cannot read; those limits remain recorded.

Public-reader safeguards remain in place: public HTTPS destinations, private-network rejection, redirect checks, size and time limits, rate-limit handling and no credential-bearing URLs. Some websites will remain inaccessible. A blocked page is reported as unread, and public alternatives are attempted where permitted.

Personal-disclosure filters are conservative safeguards, not a guarantee of perfect classification. Physical microphone recognition, spoken-answer accuracy and a human screen-reader session remain separate acceptance checks.

## MOMM review record

MOMM **1.15.1** was used, with Codex as sole writer and verifier. The installed version was also read successfully through the running application's free local route. Claude, Antigravity and Grok each returned a valid final review: Claude and Grok requested modifications; Antigravity accepted. The final quorum was **3 valid reviewers against 2 required**.

The initial broad text bundle had one valid reviewer, below quorum. Two companion panels subsequently each met quorum. Their text-input scope could not certify separately named application files; that limitation is retained in those historical records. The closing review used a real 13-file diff in a private isolated repository, followed by comparison of 41 application/review source hashes and the complete application verification report.

All **47 findings and suggestions** across the rounds have recorded decisions: 25 applied or applied with modification, 22 rejected with reasons, none deferred. The 14 findings comprise 12 applied corrections and two rejections supported by local investigation. Every applied material finding has a failing reproduction and passing verification. No finding was accepted merely because reviewers agreed.

The final live check exposed a missing jurisdiction field in the no-subject retry response. The reproduction was extended to exercise the real HTTP path, the field was repaired, all 711 tests were rerun, and the MOMM observations and completion receipt were refreshed. Previous records were preserved privately. Final governor validation reports **complete: true**, no unresolved items and no validation errors.

The MOMM validator checks recorded evidence and actual local file hashes. It does not independently prove that tests are adequate or that every factual answer is correct.

| Review items | Applied / modified | Rejected | Verification |
|---|---:|---:|---|
| Findings | 12 | 2 | Failing/passing regression records; rejected findings have investigation probes. |
| Suggestions | 13 | 20 | Behavioral reproductions, existing suites or stated inspection checks; every rejection has a reason. |

## Inspect the evidence

- [Full failure-by-failure MOMM disposition table](<D:/1code projects/British Terror/.ensemble_reviews/transcript-repair/all-dispositions.md>).
- [Final private MOMM ledger](<D:/1code projects/British Terror/.ensemble_reviews/transcript-repair/completion-project/.ensemble_reviews/ledger.html>).
- [Validated completion receipt](<D:/1code projects/British Terror/.ensemble_reviews/transcript-repair/completion-project/.ensemble_reviews/completions/rev_20260913193845_lnfd.json>).
- [Full verification report: 711 tests and browser journeys](<D:/1code projects/British Terror/work/mani-verification-2026-09-13T19-58-19-578Z/report.json>).
- [Final running-app HTTP checks and knowledge integrity](<D:/1code projects/British Terror/work/mani-final-http-check.json>).
- [Actual public lookup and source-to-vector write receipt](<D:/1code projects/British Terror/work/mani-live-evidence-check.json>).

The final running-app check at 20:01 UTC on 13 September 2026 returned the actual MOMM version and a no-subject retry clarification, both without a model charge. The integrity response was healthy: 247/247 eligible ledger records indexed, 24 source excerpts, and zero missing/stale records, invalid excerpts, changed/unsealed chunks or missing/orphan vectors. These are time-stamped checks, not a promise of perpetual freshness or universal site access.
