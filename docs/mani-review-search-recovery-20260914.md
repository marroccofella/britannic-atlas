# Mani: review and search recovery, 14 September 2026

This update is local only. No commit, push or public deployment was made. The active release is `2026-09-14-review-search-recovery-r3` at [Mannin](http://127.0.0.1:4242/?view=review-search-recovery-r3-20260914#talk).

## What failed

The saved review had enough successful peers, but its final editor exhausted structured-output retries. That is a failed synthesis, not a verdict about the user's question. A subsequent “Try again” was interpreted as a search and used an unrelated diagnostic sentence as its subject. Long “do both … and also …” requests could lose the search/review binding. The old persisted conversation could carry those mistakes into later turns.

Search receipts also conflated returned URL candidates with an observed search. Finally, the first live retry during this investigation completed technically but its answer repeated old Isle of Man framing, dismissed an explicitly named cross-border question, and used “this turn” ambiguously. Completion of a provider call did not establish an adequate answer.

## Changes

- A structured-editor format failure may make one bounded plain-text attempt using the already completed peer results. Quorum, cancellation and the overall editor deadline still apply; the fallback requires more than five seconds remaining. Authentication/service failures do not trigger it. Recovered prose is labelled not source-verified, cannot inherit a verified status/high confidence, and contributes no new knowledge claims.
- “Try again” follows the last review's server-recorded target before stale search offers. Persisted recovery uses raw user commands, not mistaken assistant answers, and stops at cancellation, a new substantive topic or the 12-turn boundary. It does not rewrite transcripts or dispatch work on load.
- Long combined requests retain the research subject, jurisdiction and added question. A recap can supply a missing subject only when its complete gap list contains exactly one public gap. Ambiguity and private records are not guessed. Explicit partial negation preserves the separately authorized action.
- Performance questions and tested paraphrases remain conversation diagnostics. Mixed factual follow-ups retain their factual question.
- Source discovery observes provider tool events even without text-token streaming. Receipts distinguish search invocation, paired tool result, URL discovery and actual page reads. Search success is not source verification or proof that the question was answered.
- Diagnostic review input now includes a bounded public task assessment through the original turn. Private turns and later events are excluded; the original episode and conversation text remain unchanged. Cache validation uses this stable assessment, while the original review target stays attached to its receipt. This repairs the missing-context cause, rather than relying solely on stronger prompting.
- Review editing now distinguishes a retrospective assessment from a fresh answer. The host's default jurisdiction cannot cancel an explicitly named cross-border task. Missing context must be stated rather than invented. Review retry notices also have a readable label when the old target lacks one.

## Verification

The final deterministic gate passed **857 tests**: 811 Oracle tests and 46 website tests. Lint, type-check, build and browser journeys passed. Twenty-two focused recovery/boundary tests cover the new behavior; separate probes check cached review reuse and duplicate observers. The browser suite simulates voice input and does not certify physical microphone recognition or screen-reader narration.

Final report: [verification report](../work/mani-verification-2026-09-14T18-30-07-484Z/report.json). The local proof binds the checked application files by fingerprint. Production sources and provider availability were also checked separately; the deterministic suite itself does not make paid calls.

## Actual review and search checks

A copy of the affected conversation selected the correct previous review target. A real “Try again” request then accepted and dispatched that exact target. Three reviewers completed; the final editor produced a structured result. That first result's scope/timing flaw led to the retrospective-editor correction above. A second live check showed that prompt changes alone were insufficient: missing earlier task context still distorted the assessment. The context projection above was therefore added and tested on a copy of the affected conversation. The final live review completed successfully with Codex, Antigravity and Grok; Claude was the app governor and self-excluded, and Copilot returned an error. It now identifies the three omitted tasks and treats the truncated ascent-time answer as unverified. It is explicitly a retrospective assessment through the original turn, not a statement about later work. A repeat request returned the same cached operation without another dispatch. The final live receipt is retained in the private evidence directory.

The application also ran the outstanding named-crossing search: **three observed successful WebSearch calls and one successful JNCC page read**, with citation and answer retained in the conversation. An independent check of the same live-tool module observed four searches and three successful reads covering JNCC and GEBCO. These are two separate runs, not a single seven-search result.

The [JNCC North Channel MPA page](https://jncc.gov.uk/our-work/north-channel-mpa/) describes an area-wide depth range, not a continuous Torr Head–Mull of Kintyre profile. The corrected answer says that no primary chart/profile for the exact line was retrieved and leaves its minimum, maximum and continuous profile unresolved. The [GEBCO grid documentation](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2024-grid) identifies a possible dataset; merely reading its documentation is not extracting or validating the crossing profile. No precise crossing depth is claimed.

The conversation retains the citation and tool receipts. This UK-scoped source was not inserted into the Manx factual knowledge store: its existing jurisdiction policy kept that boundary. Startup checks retained **393 claims**, with SQLite, full-text and vector-integrity checks passing and no missing/orphan vectors. Storage integrity does not verify every factual claim.

Final live check: [local receipt](../.ensemble_reviews/review-search-recovery/final-live-check.json).

## MOMM review and disposition

Used installed **MOMM 1.15.1**, with Codex as governor and Claude, Antigravity and Grok reviewing a synthetic behavior specification. All three completed: Claude MODIFY, Antigravity ACCEPT, Grok MODIFY. The shared material excluded application source, private transcripts, databases and credentials. This was a behavioral review; application verification remained local.

All **16 findings and 14 suggestions** were investigated and ruled on. The governor completion record validates the local evidence and file hashes, not universal correctness. Its final application proof was refreshed after the retrospective wording and bounded-context corrections.

| Disposition | Count | Treatment |
|---|---:|---|
| Applied | 4 | Added or clarified the proposed boundary and verified it. |
| Applied with modification | 18 | Kept useful parts while preserving existing consent, evidence and receipt semantics. |
| Rejected with recorded reason | 8 | Probes showed existing handling, a mistaken premise, or unnecessary duplicate state. |

The [complete per-item disposition table](../.ensemble_reviews/review-search-recovery/dispositions.md) and [private MOMM ledger](../.ensemble_reviews/review-search-recovery/behavior-review/.ensemble_reviews/ledger.html) contain the individual decisions. Run: `rev_20260914175458_qik2`.

Remaining limits: the exact crossing profile is still unverified; arbitrary natural-language requests and generated prose cannot be guaranteed correct; providers and source sites can still fail. Failed or partial work must remain visible with its actual receipt and unresolved gap.
