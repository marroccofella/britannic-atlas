# Mani: quantified requests, conversation repair and evidence checks

14 September 2026 · Local runtime `2026-09-14-town-scope`

**Thesis:** Mani discarded a complete Isle of Man temperature request because it mistook “all” for a request to expand a previous topic; the repeated question and saved state then kept the user in the same unhelpful menu.

The correction is active in [local Mani](http://127.0.0.1:4242/?view=town-weather-repair-20260914#talk). Application changes remain local and uncommitted. This investigation preserves earlier unrelated edits and the original conversation. It does not establish that every possible request or website will work.

## 1. Ranked vulnerabilities

No Fatal vulnerability was demonstrated by this transcript. These are usability and evidence-handling failures; the transcript does not establish deception, unauthorized access or a legal defect.

| Rank | Flaw, consequence and affected party |
|---|---|
| Material | A quantifier anywhere in a complete question activated a broadening/menu branch. A legitimate user could not obtain the requested temperatures, and a new subject could be replaced by an earlier infrastructure topic. |
| Material | The correction “I asked what was…” was not recovered as a repeated question. The saved menu failures retained no factual subject, so continuing the original conversation could fail even after a fresh-chat fix. The user bore the burden of rephrasing context the app already had. |
| Material | A clarification containing speech was recorded as `answered: true` and shown as ready. Users, including people relying on spoken controls, could mistake a menu for completion; success telemetry could also overstate performance. |
| Material | An explicitly named unsupported locality could fall back to the airport weather reading. An eight-place aggregate also lacked an explicit statement that its coverage was limited. Users could infer geographic coverage the result did not provide. |
| Material | Equivalent ISO and readable UTC timestamps, and a hyphenated provider name, could trigger unsupported-fact warnings. This created false evidence alarms and could erode trust in valid warnings. |
| Minor / unconfirmed | The pasted page contains several copies of the red-team instructions. Their origin is not established. The repeated text was not found in the application source inspected for this investigation. It is not evidence that the app intentionally displayed or injected that prompt. |

There is no evidence of someone deliberately exploiting these weaknesses. The practical opportunity was for malformed or over-broad routing to hijack a legitimate request, not a demonstrated attacker or motive. Duplicate descriptions of the same defect are consolidated above.

## 2. Terms, evidence and burden

| Term or assertion | Problem or operative definition | Support class | Remaining gap |
|---|---|---|---|
| “All” | Quantifies towns in the complete request; it does not mean “expand the previous topic.” Bare “all” remains a contextual continuation. | Direct: failed routing tests before the fix, passing tests after it. | Natural-language matching is bounded, not exhaustive. |
| “Major towns” | The user supplied no population threshold. The answer now names Douglas, Ramsey, Peel, Castletown, Onchan, Port Erin, Port St Mary and Laxey and explicitly limits coverage to those eight places. | Direct: configured locations, parser tests and live response. | This is a supported settlement list, not an official classification or a claim to cover every settlement. |
| “There” / unstated location | The app displays an Isle of Man default. A complete question without a conflicting location should use that default; explicit foreign places and explicit same-case references retain their own handling. | Direct: router code and foreign/default regression tests. | Homonymous and unrecognised place names still need bounded handling; no universal geographic resolver is claimed. |
| “Was” in “I asked what was…” | May report the user's earlier current question rather than request a historical measurement. The repair inherits a current frame only for the same weather subject and without an explicit different period or location. | Direct: correction, historical, clock-time and changed-place tests. | Implicit temporal language outside these recognised forms may need clarification. |
| “Answered” / “ready” | Nonempty speech does not establish that the requested task was completed. | Direct: old saved metadata, corrected receipt and rendered UI test. | Legacy answers remain visible as historical records; they are not silently rewritten. |
| “Source-linked” | A record identifies a successfully read public source. It does not mean independently verified, measured locally or current forever. | Direct: tool receipts, source records, expiry fields and live index checks. | A single provider can be wrong. Storage consistency cannot settle source truth. |
| “Temperature” | The tool returns timestamped Open-Meteo model estimates, not readings from a thermometer in each place. | Direct: parsed provider data and explicit answer wording. | Nearby places can share a model grid; no new independent measurements were obtained. |
| “Review the conversation” | An explicit request for review correctly selects the review operation. Reviewer progress is not completion and agreement is not factual verification. | Direct: the saved review receipt and routing regression. | This investigation did not certify every result from the user's separate in-app review job. |

The application bears the burden of showing that it selected the requested subject, obtained relevant current evidence, represented its limits and completed the task. The user should not need to prove the Island context again. The governor bears the burden of reproducing a defect before claiming its correction. There is no contract or legal instrument in this case to which authority, severability or drafting canons should be artificially applied.

The argument depends on these assumptions: the visible Island scope is a meaningful default; the user asked a complete weather question; provider timestamps and units can be parsed; and saved turns belong to the same conversation. Tests cover explicit foreign scope, uncertain speech, failed source reads, old/future data and crossing into a new task so these assumptions do not become unconditional permissions.

## 3. Strongest alternative explanation

“Major towns” is imprecise and the first question does not repeat “Isle of Man.” A targeted scope question could be reasonable in a context-free assistant. That explanation does not justify the generic infrastructure/law menu in an Island-focused app, nor its repetition after the user restated the weather subject. Deterministic local reproduction identifies a routing defect before source reading or model synthesis. Provider refusal, model reluctance or deceptive intent is therefore unnecessary to explain these two failures.

The repetition of “I asked…” is ordinary conversational repair. It is not evidence of deceit. Likewise, the repeated analyst instructions in the pasted page could have several origins; choosing one without a captured DOM or matching source would be speculation.

## 4. Residual unknowns and limits

- There is no proof that all geographic names, phrasings, model responses or websites now work. Unknown explicit localities use public-source search instead of substituting airport data; a source can still refuse access or return no usable evidence.
- The repeated prompt's origin remains unknown. No destructive change to settings or page content was made on that assumption.
- The default eight-place weather facility is bounded. Its two-hour validity and five-minute future tolerance are eligibility checks; a ten-minute cache does not independently improve the provider's accuracy. The lookup has a 90-second limit.
- Browser tests cover controls, keyboard interaction, status text and read-aloud wiring. A physical microphone and a human screen-reader/listening session were not tested.
- The lexical evidence check compares terms and values. It does not prove semantic entailment and cannot promote a single-source estimate to independently verified knowledge.
- MOMM reviewed the behavioral specification, not application source. The separately prepared code review remains undispatched because automatic approval review required consent for that source export. The current combined bundle contains 21 application/test files and excludes conversation, credential, database and review-log files.

## 5. Implemented remediation and verification

The tight behavioral rule is: **When a complete question names a subject, answer that subject in its explicit or established scope. Treat “all” as broadening only when it is the whole continuation request. A correction refers to the same task only when its subject and time constraints support that reading.**

Changes:

- Whole-request broadening detection protects quantified questions about weather, permits, towns and school closures from old-topic/menu routing.
- Interrogative restatements are unwrapped without turning embedded commands into authorization. Explicit dates, past/future periods, clock times and changed locations retain their meaning.
- Legacy recovery is confined to the known generic-menu failure, the same conversation and a maximum of twelve completed turns. It stops at a newer factual task or dismissal and preserves prior answers, preferences and review state.
- Clarification receipts now say `answered: false` and `clarification_required`. Old false-success clarification receipts render as “needs clarification” while keeping Read aloud available.
- Unsupported explicit weather locations select search; the eight-place result states its limited coverage and model-estimate status.
- Evidence comparison normalises equivalent UTC timestamp formats and uses consistent hyphenated-name boundaries. Negative tests still identify changed temperatures, dates, times, locations and provider names. Status remains single-source.
- Existing Socratic assessment records remain public summaries of objectives, assumptions, counterexamples and proposed checks. Their presence does not prove that every check was executed or authorize further actions.

**Final verification: 791 passing tests, zero failures or skips** — 745 Oracle tests and 46 website tests. Lint, type-check, build, PDF runtime, model readiness and browser journeys passed. The new town-scope file contains 17 tests; the first routing reproduction had nine failures before the fixes. Subsequent targeted tests reproduced the unsupported-location, coverage and timestamp-warning defects before correction.

The final report is `work/mani-verification-2026-09-14T12-33-47-231Z/report.json`. Its source fingerprint was checked against the final application files. The previous 774-test suite missed this literal quantified-request case; its success was not proof that this conversation worked.

The actual original three-turn conversation was replayed privately in memory. The repeated question now selects the eight-place weather tool, and recorded answers remain unchanged. No test turns were inserted into the original conversation.

A separate live two-turn conversation completed both the original temperature request and its correction. Each returned eight timestamped, source-linked estimates without model synthesis, false timestamp warnings or automatic extra research. The first final turn added eight records; the correction refreshed those same eight. An optional search button remains available and does not itself start research. One earlier live diagnostic also saved eight genuine dated provider records; these were preserved, not deleted to improve the result.

At the final check, **268 eligible ledger records were indexed**, with zero missing or stale indexed records, invalid excerpts, malformed records, missing/orphan vectors or foreign-key errors. Thirty-two expired excerpts remain historical and are excluded from current eligibility. The failed-source regression writes zero factual records; user corrections and proposed reasoning are not promoted to shared factual evidence. These are integrity and provenance results, not universal truth certification.

## MOMM review and dispositions

MOMM **1.15.1**, behavioral run `rev_20260914121647_ynvd`: Claude returned MODIFY with seven findings; Antigravity returned ACCEPT with no findings and two suggestions. Grok returned invalid output, which is a provider response status rather than a finding. Two valid reviews satisfied the requested quorum. Agreement score was zero; all seven findings were unique to Claude, comprising five warnings and two nits, with no critical finding.

Seven missing specification boundaries were reproduced with document checks before edits and passed afterward. This verifies those document requirements only. Application changes were separately reproduced and tested by the governor. Thirteen findings/suggestions were addressed and one was rejected. The blanket foreign-context carry-over proposal was rejected because it conflicts with the product's explicit per-turn Island default; explicit same-case and foreign-location handling remains tested.

The final completion validator was rerun after the timestamp fix, checked the reviewed document and current application verification fingerprint, and recorded completion with no errors. It validates recorded evidence and local hashes, not the truth of reviewer reasoning or the correctness of every answer. The behavioral review does not certify the pending 21-file source bundle.

[Private MOMM ledger](<D:/1code projects/British Terror/.ensemble_reviews/town-scope/behavior-review/.ensemble_reviews/ledger.html>)

The complete finding and suggestion dispositions follow.

| Reviewer | Finding or suggestion | Disposition | Reason / verification |
|---|---|---|---|
| claude | State the jurisdiction invariant per conversation: define precedence as explicit place in the current turn > place established earlier in the conversation > displayed default, with clarification when place names collide. | rejected | Automatic persistence of every foreign place conflicts with the product’s explicit per-turn Manx default. Retain explicit same-case references and clarify this precedence in the document; no new blanket carry-over rule was applied. |
| claude | Define "explicit period" to include relative past and future expressions, and add a freshness window after which an inherited "current" frame must be re-fetched. | applied-with-modification | Defined relative past/future exclusions, matching-subject inheritance, two-hour validity and five-minute future tolerance. Tests preserve explicit clock times, changed places, historical periods and reject stale/future data. Inheritance does not reuse the prior answer as current. |
| claude | Require weather answers to name the supported settlement list, or at least its count, whenever the question uses a vague aggregate like "main towns". | applied | Required an explicit limited-coverage notice. A real parser regression failed before and passes after adding the eight-place coverage sentence; all named place outputs remain present. |
| claude | Add negative synthetic checks for each prohibition in rules 5–7 so the tests guard what must not happen, not just the happy path. | applied | Listed the negative requirements explicitly and added unsupported-locality, stale/future-weather and failed-read/no-write tests. Existing tests cover review-status handling and source-evidence seals. The failed source correction adds zero ledger records. |
| claude | Define "eligible source" and the freshness threshold concretely, and state whether tool-generated estimates can ever become shared evidence. | applied | Defined estimates as timestamped, linked single-source records that retain the model-estimate wording. The complete weather/correction integration test asserts estimate wording and eight genuine source-derived writes; integrity checks remain distinct from factual verification. |
| antigravity | Explicitly specify the timeout and cache TTL policies for the weather facility model estimates to complement the timestamped freshness checks. | applied | Documented the existing 90-second bounded lookup, ten-minute response cache, two-hour validity and five-minute future tolerance. Cache reuse still revalidates source timestamps; stale/future regression tests pass. |
| antigravity | Define an explicit fallback error schema for queries referencing settlements outside the eight supported locations rather than relying solely on non-substitution. | applied-with-modification | Documented the existing public-source search and unavailable-source outcome for unsupported locations. Reproduced and fixed the explicit unknown-locality airport fallback; no unnecessary new error schema was added. |
| claude | jurisdiction-carryover-conflict | applied-with-modification | Clarified the document: an explicit place and explicit same-case reference precede the per-turn displayed default. Did not adopt blanket foreign carry-over. Specification check fails before/passes after; existing foreign/default routing tests and new quantified foreign question test pass. |
| claude | place-naming-undefined | applied-with-modification | Defined homonymous names under the displayed default, explicit foreign overrides and unsupported-place search. A new local regression reproduced Glen Maye falling back to the airport; it now selects search. The document does not claim a complete geographic resolver. |
| claude | bounded-coverage-not-disclosed | applied-with-modification | Required an explicit limited-coverage notice. A real parser regression failed before and passes after adding the eight-place coverage sentence; all named place outputs remain present. |
| claude | temporal-inheritance-unbounded | applied-with-modification | Defined relative past/future exclusions, matching-subject inheritance, two-hour validity and five-minute future tolerance. Tests preserve explicit clock times, changed places, historical periods and reject stale/future data. Inheritance does not reuse the prior answer as current. |
| claude | coverage-missing-negative-cases | applied-with-modification | Listed the negative requirements explicitly and added unsupported-locality, stale/future-weather and failed-read/no-write tests. Existing tests cover review-status handling and source-evidence seals. The failed source correction adds zero ledger records. |
| claude | model-estimate-evidence-status | applied-with-modification | Defined estimates as timestamped, linked single-source records that retain the model-estimate wording. The complete weather/correction integration test asserts estimate wording and eight genuine source-derived writes; integrity checks remain distinct from factual verification. |
| claude | undefined-recovery-terms | applied-with-modification | Defined the exact legacy menu/clarification gate, twelve-turn bound, no new-topic/dismissal crossing and low-confidence boundary. Defined partial-answer semantics separately from pure clarification. Saved-conversation, low-confidence and clarification/read-aloud tests pass. |


