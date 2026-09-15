> Follow-up, 14 September 2026: the resumed-conversation failure was reproduced and corrected. The pending four-file review is included in the completed eleven-file review. See [the follow-up audit](mani-resumed-conversation-audit-20260914.md) for the final 752-test result, live continuation and evidence cleanup.

# Mani conversation and knowledge audit — 13 September 2026

The repairs are active in the local Mannin app. The supplied conversation exposed failures in context, follow-through, evidence selection and accurate explanations of the knowledge base. Those paths now have regression coverage and a real two-turn verification. Nothing was published, pushed or committed to the user's application repository.

**Review status:** MOMM 1.15.1 completed the broader 19-file repair review. A later four-file historical-answer correction has passed local tests and independent read-only inspection. Its closing external MOMM review has not run: automatic approval review rejected this exact export twice and a separate consent request is pending. Do not describe the final source as fully MOMM signed off yet.

## Failures, causes and resulting behaviour

| Failure in the conversation | Cause | Correction and check |
|---|---|---|
| Earliest beginnings answered with later institutions | Evidence requests could go straight to unsupported generation; different historical dates were conflated | Source lookup now precedes answering. The bounded earliest-settlement answer uses the inspected excavation report and heritage overview, keeps house dating separate from first arrival, and cites the exact PDF pages. Missing evidence and mixed topics retain their separate handling. |
| “Of course, yes, do it”, “Tell. Tell me” and a delivery complaint lost the task | Assent, speech repair and action routing competed; some matches accepted only fragments or swallowed commands | Complete assent resolves against a real pending offer. Source imperatives retain their command route and existing offer mode. Diagnostic requests preserve the offer. Negation, a new question and low-confidence speech cannot silently authorize it. |
| Mentioning England and Ireland switched away from the Manx subject | A foreign-place match overrode the historical relationship | Historical separation follows the Manx subject, with geology sources for that relationship. A new England-only question still changes scope. Recycling language does not select a geology paper. |
| Repeated assurances about queued work without a result | Generated descriptions were not tied tightly enough to actual operations | Reads run before narration. Prompts and conversation memory receive the completed tool operations and knowledge-write receipts. An unavailable source remains explicitly unavailable. |
| Mani denied having persistent knowledge or could not explain it | Product architecture was left to model guesses | A local runtime answer explains the SQLite ledger, FTS5 and vector retrieval, actual counts and integrity state. This is persistent source retrieval, not retraining the underlying model. Mixed factual requests keep their factual task. |
| Learning could merge the same text from different publishers or collide with seed claims | Evidence identity relied too heavily on text alone | Source identity includes evidence kind, case-sensitive passage text and canonical source URLs, including PDF page. Sound legacy IDs refresh in place; a different publisher keeps an independent identity. |
| A contact footer could discard an otherwise useful public passage | Privacy filtering acted on a whole extracted block | The original server-read seal is checked first. Eligible verbatim public sentences can be retained while contact/private units are omitted. Unbound, tampered, private and contact-only inputs remain excluded. |
| Users could not see whether knowledge had really been saved | Storage was hidden and empty receipts could appear misleadingly | Answers show an accessible expandable receipt with additions, refreshes, exclusions, read dates and source links. The receipt is preserved with conversation metadata. An empty foreign lookup produces no misleading save-failure panel. |
| A successful ledger write could be mistaken for successful vector indexing | Write and index outcomes were not clearly distinguished | Index synchronization completes before the answer; a failure reports the actual saved result plus an index error. Null legacy receipt entries are handled safely. |
| Model-researched findings looked like original source text | Evidence labels and timestamps blurred different origins | Model research remains source-linked research, not a verbatim excerpt. Research completion and source retrieval times remain distinct. Model consensus does not establish factual truth. |

## What is saved during conversation

Eligible relevant public passages from completed, server-recorded reads are persisted with source URLs, PDF page references where available, retrieval time, expiry and content fingerprints. Re-reading refreshes the existing matching source record without inflating its independent support. Public evidence is synchronized into the local retrieval index. Private conversation history is stored separately and is not automatically promoted to shared factual knowledge. A model's answer, a search snippet, a failed read or a reviewer agreeing with a claim is not a verified public source.

This captures source evidence; it does not prove every statement in a source. Source excerpts remain labelled as not independently verified. Retrieval integrity checks detect storage/index problems, not universal factual correctness.

## Knowledge actually added and checked

The source-reading pass added **19** eligible passages from six public documents/pages. The first real conversation check added a further three source passages selected for its narrower question: **22 additions in this investigation**. Subsequent repeated reads refreshed existing records.

The final live check at **2026-09-13T20:59:16.592Z** reported **46 source excerpts** in the ledger and **269/269 eligible ledger records indexed**. Database and full-text checks passed. There were zero expired or invalid source excerpts, missing or stale ledger index entries, changed or unsealed indexed documents, and missing or orphaned vectors.

Public sources read:

- [Manx National Heritage: The Manx Mesolithic](https://manxnationalheritage.im/wp-content/uploads/2020/05/MOTM-EarlyPeople-AMesolithic.pdf#page=1). The broad period label is not an exact first-arrival date.
- [Ronaldsway excavation report sample, summary](https://www.archaeopress.com/Archaeopress/DMS/9A26816D482B4A05BD823311F1F20BA7/9781805832553-sample.pdf#page=15). Keep the specific Cass ny Hawin II house dating and calibrated-BC convention intact.
- [Chiverrell and colleagues: institutional copy of the Quaternary paper](https://livrepository.liverpool.ac.uk/3166881/1/quaternary-06-00003-with-cover.pdf#page=24). Its discussion of insularity preserves uncertain severance timing and radiocarbon conventions; it does not justify inventing an Irish land bridge.
- [Isle of Man Historic Environment Record](https://isleofmanher.im/).
- [MNH coast, countryside and ancient monuments visitor sites](https://manxnationalheritage.im/our-sites/type/coast-countryside-ancient-monuments/). A visitor catalogue is not an exhaustive statutory register.
- [IOMHER access policy](https://manxnationalheritage.im/wp-content/uploads/2021/03/IOMHER-Access-Charging-Policy.pdf#page=4). Absence of a record is not proof of absence of archaeology.

## Verification

- **736 automated tests passed:** 690 Mani/Oracle and 46 website tests, no skips. Lint, type checking, production build, PDF runtime and browser journeys passed.
- The final verification fingerprint matches the current application source. Report: 'work/mani-verification-2026-09-13T20-57-29-288Z/report.json'.
- Browser coverage includes actual architecture/integrity endpoints, accessible knowledge receipts and citations, keyboard navigation, low-confidence speech handling and source-status presentation.
- A real two-turn local conversation asked for earliest settlement evidence and followed with “Of course, yes, do it.” Each turn read sources before narration, returned two page-specific citations, refreshed six saved passages, added no duplicates and used no generative-model call (recorded cost zero). The earlier model answer's unsupported Irish-coast statement did not enter factual storage and is absent from the corrected answer.
- Live architecture, size and integrity questions worked; incomplete “Do both” and “Search that” requests without a known subject returned clarification rather than an exception.
- Private review evidence, source-read records, database backup and synthetic conversation reports remain ignored by Git.

No automated run here certifies human microphone recognition or a complete screen-reader experience. Some websites still refuse automated access; public alternatives can be tried, but credentials, access restrictions and failed reads are not bypassed or represented as successful. The direct historical answer is deliberately bounded; this is not a guarantee against every possible generated-answer error.

## MOMM 1.15.1

Broader repair run: 'rev_20260913202745_uq5r'. Claude returned MODIFY and Antigravity ACCEPT; both were valid reviews, meeting the required two-reviewer quorum. Grok returned invalid output and does not count as an approval. The verdicts disagreed (agreement score zero), so every material item was investigated locally rather than accepted by vote.

All 13 findings/suggestions were adjudicated: 11 applied or applied with modification; two rejected with recorded reasons. Behavioural changes have failing-before/passing-after evidence. The rejected fragment-handling finding has an explicit comparison against the actual earlier code. A governor completion receipt validated that reviewed state; it remains a historical receipt and does not cover the later four-file answer extension. The validator checks local evidence records and source hashes, not the adequacy of all reasoning or universal safety.

Private dashboard: [.ensemble_reviews/history-repair/review-project/.ensemble_reviews/ledger.html](../.ensemble_reviews/history-repair/review-project/.ensemble_reviews/ledger.html).

| Reviewer | Finding or suggestion | Disposition | Reason / verification |
|---|---|---|---|
| claude | Keep completeAssent to pure consent tokens and let interactionCommand own imperatives such as "check sources" and "do your research"; add a test that both phrasings still route to search. | applied-with-modification | Source-check imperatives go through command handling, preserving a real offer when present. Explicit-source-command and existing offer/running-operation tests pass. |
| claude | Have persistPublicEvidence return null (or skip the reason) when live.claims is empty, so receipts only exist when something was eligible to save. | applied-with-modification | Return the compatible empty receipt without a reason when no claims exist. The renderer also hides legacy empty reason-only receipts. Unit and browser checks pass. |
| claude | Compute retrieval.stats() once per turn and share it between syncPublicEvidence and knowledgeRuntime instead of calling it twice. | rejected | Keep independent runtime introspection and write-receipt functions. No measurable latency failure was established, and each accurately reads available index state; caching is outside this corrective change. |
| claude | Use /^Isle of Man/ in the history catalog guard for consistency with the Foundations entry and mixed jurisdictions. | applied-with-modification | Use the bounded Isle of Man or Isle of Man and … scope form; cross-border geology receives its source pointers without admitting arbitrary prefix lookalikes. Regression passes. |
| claude | knowledgeSpeech omits the final full stop in the 'needs attention' branch; append '.' consistently. | applied | Add the missing terminal full stop to the health-warning sentence; knowledgeSpeech regression passes. |
| antigravity | Filter null or non-string URLs before sorting in KnowledgeBase.upsertClaim to prevent undefined values from serializing to null in JSON when hashing source IDs. | applied | Filter invalid and non-string URLs before constructing the source identity. Identical valid sources now produce identical IDs despite malformed extra input; regression passes. |
| antigravity | Use the Unicode uppercase property class \p{Lu} in publicEvidenceText sentence splitting to ensure robust sentence boundary detection across non-ASCII characters. | applied | Use Unicode uppercase sentence boundaries so a safe factual sentence beginning É survives a preceding contact sentence. Failing/passing projection regression retained. |
| antigravity | Add optional chaining or guard against null entries when mapping metadata.meta.knowledgeWrite.entries in conversations capsule for enhanced resilience to legacy records. | applied | Validate the entries array and ignore null/non-object entries when preparing memory. A legacy null-entry fixture no longer breaks conversation context. |
| claude | source-check-command-swallowed-by-assent | applied-with-modification | Explicit source imperatives are parsed as commands. A valid existing offer retains its mode and running-work acknowledgement; with no offer, the known public subject is used. The command regression and existing offer suite pass. |
| claude | bare-please-go-clears-offer | rejected | The stated pending-question reproduction behaves identically in the actual pre-repair and final versions: a short reply consumes the saved clarification. Go was already explicit assent. The comparison probe found no introduced state loss; stale offers remain unusable. |
| claude | source-excerpt-id-migration | applied-with-modification | A sound legacy source record keeps its ID when the exact text and source URLs match, preserving references and reporting refreshed. Different sources stay independent. Hash input now uses filtered source URLs. Legacy and URL-identity regressions fail before and pass after. |
| claude | receipt-panel-on-non-manx-answers | applied | Empty lookups carry no exclusion reason; the UI requires considered source passages before displaying a reason-only receipt. Unit and rendered browser tests verify no misleading save panel. |
| claude | separation-catalog-overmatch | applied | Geology selection now requires geological context or a specific historical land-separation relation; separate glass recycling does not select the paper. Reproduced and verified. |


The closing four-file review bundle is prepared in the private 'answer-review' fixture. It contains only the answer helper, answer integration and two synthetic test files. Export approval is pending; no final review result is claimed.

## Local handoff

[Open the updated Mannin chat](http://127.0.0.1:4242/?view=conversation-knowledge-20260913#talk). The running process was restarted only after confirming it was idle. Existing databases and conversation history were preserved; a private pre-activation database backup is retained. The public/general release has not been updated.
