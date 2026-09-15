# Mani conversation logic and non-code review audit

14 September 2026. Local release: `2026-09-14-logic-flows`.

The transcripts exposed failures in request routing, saved task state, source acquisition, review eligibility, assessment quality and review restoration. The changes below are implemented locally. Nothing was committed or published. Original conversation messages were preserved.

## Findings and repairs

| Failure | Cause | Implemented correction |
|---|---|---|
| Tide times and heights were replaced by offers to search | The lookup trigger depended on wording such as “current”; it did not recognise tide-time requests | A tide-time request starts public-source lookup. Conceptual explanations of tides remain separate |
| “Do what I asked”, “Yes, do it and review” and “To both” did not perform the requested work | Missing command variants and a compound-action requirement for an already completed reviewable answer | Recognise the variants, preserve the task, and select a task assessment when the answer is unfinished |
| Continuing a saved conversation researched the instruction to use MOMM instead of the original question | An operational instruction had overwritten the saved factual subject and pending offer | Recover the subject from the recorded same-session offer, preserve its originating-task binding, and reject a superseded offer |
| MOMM was described as requiring code or a finished factual answer | Capability wording and review eligibility were inconsistent with the non-code dispatcher | Public answers, plans and unfinished-task assessments are eligible. Public questions outside Manx topics can also be reviewed. Explicit review requests remain distinct from quoted instructions, negations and family references |
| A review returned its input excerpts rather than an assessment | The synthetic review episode contained a raw briefing payload | Create a local assessment of recorded completion and operations, label excerpts unverified, and propose a next action before peers finish |
| The latest request disappeared from long assessments | Turn selection spent the budget on older entries | Select newest eligible turns first, display chronologically, retain required labels, and bound the entire assessment to 4,300 characters |
| Internal review material appeared as a user turn | Legacy episode import included synthetic review episodes | Exclude synthetic review episodes and their old legacy copies from ordinary history and recall; retain the underlying review records |
| Invalid reviewer output could contribute displayed findings | The projection bounded fields but did not require valid contributing reviewer statuses | Only validated successful reviewers contribute findings; false corroboration and unknown finding IDs are filtered |
| A saved non-code review disappeared after reopening | The history route looked for an answer episode ID, while the command turn stored its review target in action metadata | Resolve the saved review by its server-recorded action target within the same session |
| Readable tide directories were treated as sufficient acquisition | The reader stopped after successful text extraction | Follow at most six distinct relevant detail links, one layer deep, and make one alternative discovery attempt when requested times/heights are absent |
| PDF failures exposed local paths and interpreter tracebacks | Raw extractor exceptions reached public tool receipts | Replace those details with a bounded accessible-document failure message |
| A protected-area depth range was used to suggest a shallow crossing | Point, area and continuous-route claims were conflated | Add spatial scope checks for endpoints, route maximum depth and missing bathymetric profiles |
| Diving safety was inferred from depth and an assumed ascent speed | Geography and human physiology used the same evidence context | Route such questions to dedicated sources and prohibit unsupported passive-ascent reassurance or numerical ascent estimates |
| More reasoning methods risked adding verbosity rather than reliability | Method names were being treated as a general recipe | Select two or three complementary method groups; distinguish proposed checks from performed checks and facts from inferences |
| Historical clarification messages kept demanding another answer | The UI rendered old clarification metadata as a current prompt | Show the historical failure and offer a keyboard-accessible “Retry original question” action |

The JNCC North Channel page describes depths within a protected area; it does not establish a continuous shallow route across the channel. [JNCC source](https://jncc.gov.uk/our-work/north-channel-mpa/). The transcript's reassurance about floating up from depth should not be relied on. Breath-hold blackout can occur during ascent or after surfacing. [Divers Alert Network](https://dan.org/alert-diver/article/hypoxia-in-breath-hold-diving/).

## Reasoning and evidence boundaries

Legal/business analysis groups together definitions, jurisdiction, date and evidence; tests a strong contrary reading; and compares lawful opportunities with their constraints. Silence, an omitted clause, a penalty cap or an assumed low enforcement probability does not establish permission. Hesitation, tone and self-repair do not prove deceit. Hypnotic or therapeutic techniques are not evidence tests.

For tide answers, the required fields include port, prediction date, event type/time, height, units, timezone, datum and source links. Chronological comparison requires known timezone offsets. Unknown-zone events remain separate. A directory, wave height, weather forecast or flapgate schedule is not a tide prediction. These are answer requirements and retrieval checks, not a comprehensive deterministic tide-table parser.

Source reads retain actual success/failure receipts. Reviewers propose improvements; their agreement is not source verification. Assessments, method records and review text remain conversation material and do not become shared factual claims. Public-source excerpts still require the existing evidence seals, provenance, eligibility and index checks. Sensitive information, credentials and private destinations remain excluded from external review and lookup.

## Verification

- Full application verification passes: **771 Oracle tests and 46 website tests**, plus lint, TypeScript, build and browser checks. No skipped tests in the full gate.
- Browser checks activate the original-question retry with Enter, verify reasoning/evidence disclosures and read-aloud text, check named controls and mobile layout, preserve drafts and history, and detect no application `unload` listener or console errors in the isolated browser.
- The original five-turn tide conversation was replayed in an isolated in-memory database. Continuations returned to the tide request, original messages stayed unchanged, and the replay made no network calls or factual writes.
- Negative checks cover superseded offers, private latest tasks, cross-session review receipts, malformed reviewers, unsafe/private/login links, cyclic links, PDF failures and untrusted reasoning metadata.

Physical microphone recognition, a real screen reader and listening quality were not verified by these automated checks. Passing tests do not establish that every future answer or every external site will work.

## Live checks and remaining limitation

The local server was restarted only while idle. Its health endpoint reports the new flow version.

A fresh three-port tide request performed search, attempted the official gov.im page and searched for an alternative. The official page refused automated reading and the alternative search returned no usable table. The answer was correctly marked unanswered; it supplied no invented times and wrote zero factual records. **Obtaining today's tide predictions remains unresolved.** This update does not bypass source refusal, authentication, robots restrictions or rate limits.

The knowledge integrity check passed after activation: 269 eligible records indexed, zero missing/stale entries, zero invalid source excerpts, and passing database, full-text and vector consistency checks. Forty expired excerpts remain historical records and are not current eligible evidence. This verifies storage and eligibility, not the truth of every stored statement.

A subsequent explicit non-code review of that unfinished public tide task was accepted through the app. A local assessment appeared immediately. Codex and Antigravity accepted it; Grok requested a more explicit omission checklist and recovery plan. Three valid reviewers met the two-reviewer requirement. Copilot errored; Claude was excluded as governor. The completed synthesis listed the missing per-port times, heights, timezone, links and ordering, and proposed an alternative public page/PDF route without claiming that retrieval had run.

That live check also reproduced the missing review panel on reload; the restoration fix is covered by session-bound tests and a live reload check. Review results do not automatically execute their proposed next steps.

## MOMM review record

Installed skill: **MOMM 1.15.1**. A separate behavioral-specification review used Claude, Antigravity and Grok with quorum two. Claude returned MODIFY with seven findings; Antigravity returned ACCEPT without findings; Grok returned unusable output. Agreement was zero, and all seven findings were unique to Claude. They were investigated individually rather than accepted by vote.

The behavioral review's seven findings and eight suggestions have recorded dispositions and validated local evidence. Six findings were addressed through specification clarification and, where reproduced, application corrections. The claimed absence of network/redirect/deadline protection was rejected after code inspection and existing boundary tests. All eight suggestions were adopted with the modifications recorded below. The completion validator checks records and file hashes; it is not independent proof of correctness.

This external review covered the behavioral specification, not the application source. The earlier source-export approval remains unresolved; no application source or private transcript was sent by this investigation's behavioral dispatch. The in-app review received only the public synthetic task assessment described above.

[Full disposition table](../.ensemble_reviews/logic-flows/dispositions.md) · [Private MOMM ledger](../.ensemble_reviews/logic-flows/behavior-review/.ensemble_reviews/ledger.html)

| Reviewer | Finding or suggestion | Disposition | Verification |
|---|---|---|---|
| Claude | Pending-task freshness and binding | Applied with modification | Preserve session/origin binding; superseded-resume regression; no arbitrary repeat-consent rule |
| Claude | Assessment size and selection | Applied with modification | Failing then passing 40-turn/latest-request and total-size test |
| Claude | Findings on quorum failure | Applied with modification | Failing then passing malformed-reviewer projection test; existing quorum/job tests |
| Claude | Missing redirect/private-network/deadline protection | Rejected | Existing shared deadline and DNS/redirect/credential/refusal tests verified |
| Claude | Two/three checks versus legal criteria | Applied with modification | Clarified method groups containing related criteria; selection tests |
| Claude | Chronological sorting with unknown zones | Applied with modification | Explicit prompt/specification rule; no unsupported claim of a complete tide parser |
| Claude | Missing test traceability | Applied with modification | Named test mapping and actual browser keyboard retry |
| Claude | One owner for review state | Applied with modification | Server job owns completion; valid synthesis and restored receipts remain distinct |
| Claude | Field priority during truncation | Applied with modification | Required labels preserved, excerpts bounded, older whole turns dropped |
| Claude | Expiry or task/context key | Applied with modification | Chose existing session/task keys; preserved authorization for unchanged tasks |
| Claude | Explicit overall network budget | Applied with modification | Clarified existing global deadline and all-hop network checks |
| Claude | Merge legal criteria into groups | Applied with modification | Three legal/business method groups |
| Claude | Map clauses to named tests | Applied with modification | Traceability added to reviewed specification |
| Antigravity | Prefer most recent eligible turns | Applied with modification | Latest request retained in long-assessment regression |
| Antigravity | Prediction versus retrieval timestamps | Applied with modification | Preserve prediction date and distinguish ISO 8601 retrieval time |
