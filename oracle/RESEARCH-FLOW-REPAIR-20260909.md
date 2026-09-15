# Research follow-up repair — 9 September 2026

The failure was real: the browser displayed the research result's itemised unresolved questions, but the next answer received only a shortened summary. It could not work through the list, and an old clarification about Tynwald versus fibre then displaced the user's clear reference to the latest result.

The repair selects the saved research result before generic clarification routing. Its questions and access-block details enter the bounded conversation projection. The selection survives reload, explicitly named earlier results are respected, unrelated new questions clear the selection, and low-confidence speech still requires clarification. Any later approved source check carries the saved questions instead of repeating only the broad original topic. No fresh research is automatically started by asking about the outstanding questions.

## Verification

- 399 tests passed; zero skipped; Oracle lint clean.
- Eight new regressions include the two exact failed follow-ups, topic selection, session isolation, missing results, speech-confidence handling, prompt content and the later source-check target.
- An actual Edge browser and the actual HTTP server passed both follow-ups and reload using synthetic research and an offline answer adapter. The adapter asserted that all five saved questions arrived in the prompt. No microphone, model provider, paid research or private conversation copy was used for that test. This verifies plumbing, not generated-answer quality.
- Activation backed up the original database and preserved all 167 pre-existing conversation turns, including metadata. Mani was restarted only after idle/process checks and returned a healthy response.

## Remaining validation

The real-model browser test was blocked by the safety reviewer because it would send copied conversation context to Mani's Claude provider without specific approval. User approval has been requested; this test was not bypassed. Government access blocks and unanswered legal questions remain gaps, not facts that this conversation patch has verified.

MOMM review run `rev_20260909182841_w5pf` returned no completed external review: all four routes timed out; quorum was 0/2. There are no findings or suggested improvements to triage, no agreement score and no risk ranking. The subsequent targeted-source-check correction is locally tested but also has no completed peer review. This is an internal alpha repair, not a passed independent release gate.

| Reviewer | Suggestion | Disposition | Reason / verification |
|---|---|---|---|
| Claude, Antigravity, Copilot, Grok | None returned | Review deferred | All timed out; no peer acceptance claimed |

Private evidence is retained in `.ensemble_reviews/research-flow-offline-browser.json`, `research-flow-live-probe.json`, `research-flow-preservation.json` and the MOMM ledger. The current code-only review input is retained separately from user transcripts.
