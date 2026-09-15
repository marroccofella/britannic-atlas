# Mani: resumed-conversation repair — 14 September 2026

The earlier sign-off was incomplete. It tested a fresh, short exchange but missed the persisted state of the conversation the user actually continued. The additional transcript reproduced a real failure. This audit supersedes the pending four-file-review status in the previous history audit.

## What failed and why

1. A question about whether Mani had improved was treated as a new Island factual subject. It overwrote the pending historical question in saved dialogue state.
2. The following assent ran a source search, but it searched the performance comment instead of the outstanding land-separation and ancient-monuments question. This was a wrong-tool-input failure, not proof that no websites could be read.
3. Generic Island words made a minimum-wage article and a Bills index appear relevant. Both were saved as source excerpts despite not answering the historical question.
4. Earlier complaint and fragment turns made reconstructing the saved task harder. Recovery needed to distinguish unexecuted assent, a lookup of the wrong subject, completed factual research, a cancelled offer and a genuinely new topic.
5. Live checking exposed bibliography and contents passages being admitted to factual evidence. A citation pointer is useful for navigation but is not the cited work's substantive evidence.

## Corrections

- Whole-request performance questions remain conversational and retain the pending factual subject. The response uses actual saved context and does not invent a measured improvement score.
- A complaint with a separately stated factual question retains factual answering and tool access.
- Bounded legacy recovery restores the affected subject and offer, preserves unrelated saved state, and persists the repair once. Completed research does not itself create a fresh offer. Old diagnostic lookups do not count as completing a different factual task. Recovery does not itself launch a model call, research expedition or external review.
- Public evidence needs meaningful subject relevance. Bibliographies, contents and illustration pointers are excluded from factual saving. Explicitly selected public URLs remain readable.
- Saved source records retain their citations, extraction identity and freshness; repeated reads refresh existing records rather than increasing support through repetition. Source excerpts remain qualified as not independently verified.
- The earlier bounded two-source settlement answer and its four-file correction are included in this completed eleven-file review scope.

## Verification and local activation

- **752 tests passed:** 706 Oracle tests and 46 website tests, no skips. Lint, types, build, PDF readiness and automated browser journeys also passed.
- Eight independently authored peer-regression checks failed against the sealed dispatch-time sources and passed against the final sources. The private replay of the actual saved conversation recovered the correct subject and four source URLs.
- The running app completed a real two-turn performance-question / assent exchange. It read the geological paper, Historic Environment Record, Manx National Heritage monument catalogue and HER access policy. It answered the historical question with linked sources and retained uncertainty about dates and the distinction between a heritage record and an exhaustive statutory list.
- The first live fixture assertion expected a solely Manx jurisdiction. Its explicit cross-border wording correctly produced “Isle of Man and United Kingdom”; the verification was corrected to accept that bounded scope. The user's actual saved question was independently checked and remains Manx-scoped.
- The final repeated source check saved **9 eligible passages as refreshes, 0 additions**. Bibliography and contents passages were excluded.
- **10 unsuitable records were withdrawn** from factual retrieval: 2 unrelated pages and 8 bibliography/contents/illustration passages. Their source records and the reasons for withdrawal remain available for audit. Withdrawal concerns relevance and evidential use, not a declaration that the underlying publications are false.
- Databases were backed up before each local activation. All **17 original conversation messages** are unchanged. The original conversation's saved subject and pending action are repaired.
- The final integrity check reports **243 eligible records / 243 indexed**, zero missing or stale records, zero missing/orphaned vectors, and zero malformed or invalid source records. Twenty-four expired weather excerpts remain in the ledger but are ineligible for retrieval. Reduced active counts are not silent deletion.
- The browser module served by the running server matches the repaired local file. Direct inspection of the user's embedded tab was unavailable because the browser automation runtime failed at sandbox startup; automated browser journeys and the real served conversation/asset endpoints were checked instead.

Verification report: [full checks](../work/mani-verification-2026-09-13T22-45-08-452Z/report.json). Private final continuation and handoff receipts are in work/mani-resumed-live.json and work/mani-resumed-handoff.json. Private backups, transcript fixtures and reviewer records remain gitignored.

Running version: **2026-09-14-resumed-conversation**, checked at 2026-09-13T22:50:52.704Z. [Open the corrected local chat](http://127.0.0.1:4242/?view=resumed-conversation-20260914#talk). No application commit, push or general-release deployment was made.

These checks establish this repaired flow and storage consistency. They do not establish that every possible future answer is correct, that every external website is accessible, or that physical microphone/screen-reader use has been tested by a human listener.

## MOMM review

MOMM **1.15.1**, run **rev_20260913222852_yf72**, reviewed eleven application/test files. Claude returned MODIFY with five findings; Antigravity returned ACCEPT; Grok timed out without a completed review. The two completed routes met the required quorum. Peer assertions of testing are treated as untrusted review evidence; the governor's reproduced checks are recorded separately.

All five findings were addressed. Of eight suggestions, five were applied or applied with modification and three structural/style changes were rejected with reasons. The governor validated and recorded completion against the final source hashes and the 752-test verification. The earlier completion receipt and decisions were preserved when the live evidence filtering was added. The closing four-file correction is no longer awaiting review.

[Private MOMM ledger](../.ensemble_reviews/resumed-history/review-project/.ensemble_reviews/ledger.html). Reviewer inputs excluded the user's transcript, conversations, credentials and databases.

## Disposition table

| Reviewer | Finding or suggestion | Disposition | Reason / verification |
|---|---|---|---|
| claude | Centralise the 'Answer this specifically for … :' prefix stripping in one helper. Four call sites now use slightly different regexes (brain, conversations, evidence-ledger, live-tools). | rejected | The prefix handlers serve different scopes, including foreign-jurisdiction legacy recovery. No separate prefix-related failure was established; broad consolidation would expand this focused repair. |
| claude | Persist the repaired dialogue state (saveState) after a successful legacy recovery so the 80-row replay does not run on every load. | applied | Persist a successful bounded legacy recovery once. A following load returns the same stored state without replaying the old turns. |
| claude | Move historySourceAnswer's URL and passage patterns into source-catalog or a curated-answers table, so source-passages.mjs stays source-agnostic. | rejected | Retain the narrowly gated two-passage answer beside its passage checks for this correction. Moving it into a new catalogue is a separate structural change and adds no demonstrated correctness benefit here. |
| claude | Have replay derive 'offered' only from recorded answer metadata (researchOffered/nextSteps), not from route or question-text heuristics. | applied-with-modification | Remove automatic re-offering from completed research routes. Retain an explicit, unfulfilled user request for source evidence when legacy answer metadata is missing or wrongly suppressed by the old jurisdiction bug; the supplied conversation exhibits that case. A completed real lookup consumes the offer. |
| claude | Add a test pinning that a complaint combined with a factual question still reaches liveRequest and the model path. | applied | Added a synthetic mixed complaint/factual request that verifies both liveRequest and the answering model are reached. It failed before and passes after. |
| antigravity | Normalize curly apostrophes (such as U+2019) to standard straight apostrophes in historySourceAnswer before checking question tokens against the allowed word whitelist, matching the normalization used in conversationRepairQuestion and liveRequest. | applied | Normalize curly apostrophes before the bounded historical question allowlist. The typographic apostrophe fixture failed before and passes after. |
| antigravity | Cache the results of loadState turn replays or persist the repaired dialogue state back to the store to avoid replaying up to 80 conversation turns on subsequent state loads for the same session. | applied | Persist the repaired state; the same first-load/second-load regression validates this duplicate suggestion. |
| antigravity | Cache the match result of `value.match(/\\.{5,}/g)` in navigationOnly rather than evaluating the regular expression multiple times against the input string. | rejected | The bounded 3500-character navigation check has no demonstrated performance failure. Avoid changing its implementation solely to cache a small regex result in this incident repair. |
| claude | complaint-regex-swallows-factual-question | applied-with-modification | A complaint clause cannot suppress a separately stated factual request. The mixed Ramsey forecast test now reaches both the source tool and factual model path; the Douglas population check also remains factual. |
| claude | replay-reoffers-completed-research | applied-with-modification | Completed research no longer creates a fresh offer merely from its route. Replay ignores old clarification, fragment and diagnostic lookups that did not execute the factual task. Recorded new offers remain authoritative. Completed-research regression and actual private saved-conversation replay pass. |
| claude | loadstate-drops-saved-fields | applied-with-modification | Recovery patches the affected factual subject and offer fields into the saved state while retaining unrelated answer and UI context. The researchFocusId, conversationTopic and unknown saved-field regression passes. |
| claude | topic-gate-rejects-relevant-sources | applied-with-modification | No useful question terms now means no relevance evidence. Explicitly named sites can match by two whole subject words as well as historical facet vocabulary. Generic Island words still reject unrelated wage and Bills pages. Live verification additionally exposed bibliography entries and plain contents pages: the same navigation-evidence gate now excludes them, with an independently reproduced eighth regression and withdrawal of those four saved passages. |
| claude | performance-speech-sentence-join | applied | Add a sentence stop only when the saved subject lacks terminal punctuation. Spoken performance-response regression passes. |

