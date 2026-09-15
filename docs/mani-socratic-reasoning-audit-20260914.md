# Mani Socratic reasoning and transcript repair

Date: 14 September 2026. Local runtime: `2026-09-14-socratic-reasoning`.

The implementation is active at [local Mani](http://127.0.0.1:4242/?view=socratic-reasoning-20260914#talk). Nothing was committed to the application repository, pushed, or publicly deployed. Existing unrelated edits and the user's original conversation were preserved. External MOMM review remains pending approval.

## What failed and what changed

| Weakness observed | Cause | Implemented correction |
|---|---|---|
| A request to design a loophole-detection workflow became an unrelated Island policy answer. | General design requests inherited factual jurisdiction routing. | Recognise a design task and produce an applied assessment without automatically searching Island facts or offering unrelated research. |
| A follow-up asking for Socratic analysis became a generic explanation. | The previous design was not retained as the assessment target. | Save an explicit reasoning subject; bind short follow-ups to it. Recover this particular legacy subject from completed turns in the same conversation, without crossing a newer factual topic. |
| Old examples were treated as factual support. | Assistant conversation history and source evidence were insufficiently distinguished in the prompt. | Prior answers are context, not proof. The public reasoning record accepts citation IDs only from the evidence actually cited in this answer. |
| Possible loopholes could sound like established defects or completed work. | There was no structured distinction between hypothesis, test proposal and execution. | Weaknesses remain hypotheses; opportunities remain proposals with success tests. The record cannot authorise actions or declare independent verification. |
| The old census could be presented as the latest population; a larger estimate could be called an all-time maximum. | Population questions did not always request current sources or distinguish statistical measures. | Route population-size questions to a fresh source search; require reference years, census/estimate distinctions and a comparable series for a historical maximum. The exact population values from the transcript were not independently certified by this investigation. |
| “When are you?” elicited an invented time. | It missed the local clock route. | Answer using the runtime clock. |
| A closed consultation was described as currently open. | The page retained stale overview prose; short closure text and dated headings were dropped during extraction/selection. | Preserve and prioritise the source's Closed, Opened, Feedback updated and Results updated fields. Generate bounded date/status advisories from actual source text. |
| Proposal evidence was used to infer that no current requirement exists. | Absence of commencement evidence was confused with evidence of absence. | Explain that a consultation does not establish either enactment or the absence of a later requirement. Require current commencement/operator evidence before advising on current obligations. |
| Three broader tests failed intermittently while isolated tests passed. | Parallel catalogue loaders shared temporary import files; repeated imports could also return stale module contents. | Isolate temporary imports per process and key them by source content. Both failures have independently reproduced regression tests. |

The consultation's own [official page](https://consult.gov.im/home-affairs/proposal-for-id-on-steam-packet-journeys/) records closure on 8 June 2026 and an August results update, while retaining older present-tense overview text. The final live Mani check used those dated fields and left current implementation unconfirmed. The separate government announcement still refused automated access; this update does not claim to remove site restrictions.

## The public reasoning record

`mani-reasoning/1` holds the objective, assumptions, source checks, counterexamples, possible weaknesses with proposed tests, opportunities with success criteria and trade-offs, cited links, and a next step. Six fixed checks cover objective, assumptions, evidence, counterexamples, consequences and verification.

This is a concise public assessment, not private chain-of-thought. It is stored with the conversation and restored after reopening. A collapsed, keyboard-accessible panel provides read-aloud text. Strings and arrays are bounded; displayed content is inserted as text; executable or credential-bearing source URLs are rejected. A new named subject supersedes the old design, current-law design requests keep source retrieval, and requests to explain the method receive an explanation.

Assessments, user transcripts and speculative proposals are not written into the shared factual/vector ledger. Eligible public excerpts continue through the existing successful-read receipt, source-link, privacy, freshness and indexing checks. These controls establish provenance and storage consistency, not the truth of every claim.

## Verification

- Final complete verification: **774 passed, zero failed or skipped**: 728 Oracle tests and 46 website tests. This includes 22 new tests. Lint, type-check, build, PDF runtime and browser journeys passed.
- Final report: `work/mani-verification-2026-09-14T11-52-39-630Z/report.json`. Source fingerprints were stable throughout verification.
- The original nine-turn conversation was replayed privately in an in-memory database. Its Socratic follow-up recovers the intended design. No test turns were inserted into the user's original conversation.
- Two real model turns in a separate test conversation produced concrete weaknesses and opportunities, stayed on the requested assistant design, wrote zero speculative facts, and saved their assessment records.
- Browser check against the running app restored both saved panels after reload, opened the disclosure by keyboard and fitted a 390-pixel viewport. No page or console errors were recorded. Synthetic browser checks also exercised unsafe content, unsafe URLs, duplicate panels and readback content.
- A real public-source conversation initially reproduced the lost-status/overstatement defect. After correction, it retained closure/update fields, supplied the closed-consultation and unconfirmed-implementation advisories, cited the read source, and saved one new dated source excerpt.
- Final knowledge integrity: 252 eligible ledger records indexed; zero missing or stale indexed records; zero invalid excerpts, malformed records, missing/orphan vectors or foreign-key errors. Thirty-two expired source excerpts remain historical and are excluded from current eligibility. The failed first source probe also saved a genuine public excerpt, so the two source probes added two records overall; neither saved model-generated analysis as fact.
- Physical microphone accuracy and a human screen-reader/listening session were not tested. Browser readback tests establish control wiring and text, not spoken accuracy. Passing local tests do not certify every website, future model answer or current statistic.

## MOMM review status

MOMM **1.15.1** was loaded and its protocol followed through preflight and preparation. Claude, Antigravity and Grok passed local readiness checks; readiness is not a completed model review. The attempted 14-file code export was rejected by automatic approval review because consent did not explicitly cover this exact payload. Subsequent live testing expanded the completed bundle to **16 files**, including the source-extraction repairs. The final local patch is 69,960 bytes.

No payload was dispatched after that rejection. The prepared review excludes the private transcript, conversations, credentials, databases and review logs. The bundle and its source hashes are in the gitignored `.ensemble_reviews/socratic/review-project/` fixture. This fixture has a private baseline commit for comparing only this task; the application repository has no new commit.

| Reviewer | Review disposition | Reason / verification |
|---|---|---|
| Claude | Pending dispatch | Preflight ready; external code-export approval required. |
| Antigravity | Pending dispatch | Preflight ready; external code-export approval required. |
| Grok | Pending dispatch | Preflight ready; external code-export approval required. |

These are dispatch states, not reviewer findings. There is no new sealed report, finding disposition ledger or completed MOMM receipt for this update. After consent, dispatch the exact current bundle, reproduce any material findings before fixing them, account for every suggestion, rerun affected verification, and validate the final source manifest before recording completion.
