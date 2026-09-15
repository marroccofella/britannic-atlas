# Mani live progress audit — 14 September 2026

The local running version is **2026-09-14-live-progress**, activated at 2026-09-14T17:30:12.7717730Z. This update improves operational feedback while work is running. It does not certify that earlier conversation-comprehension or source-retrieval failures are all resolved. Nothing was committed or published.

## What caused the silence

The app already streamed some answers and review events, but much of the progress was confined to a small status area or an individual review panel below the conversation. Server keep-alives were invisible comments. Model generation, source lookup and knowledge indexing lacked consistent prominent stage reporting. A healthy connection could therefore look indistinguishable from a frozen request.

The new panel appears immediately, including while conversation history loads. Independent cards identify answer, MOMM, research and visual work. Closed operation labels show preparing, knowledge lookup, searching, reading, writing, checking, indexing, reviewing and combining reviewer replies when the corresponding event occurs. Reviewer counts distinguish valid responses from unavailable routes. These are operational labels, not model reasoning or proof of factual accuracy.

## Timing and interaction

- Connection heartbeats arrive every five seconds. The local running server returned its first heartbeat after 5021 ms. A heartbeat confirms the app connection; it does not claim a reviewer advanced, a source was read or an answer was verified.
- Elapsed time updates every second using a monotonic clock. After 15 seconds without a meaningful change, the panel states that it is waiting for the next result. After 20 seconds without a connection update, it says completion is unconfirmed. A real buffered heartbeat clears that connection notice without inventing work.
- Terminal cards distinguish finished, could-not-finish, stopped and observation-paused. Clarification is not labelled success. Terminal time freezes, cards expire after eight seconds, and a new request removes finished clutter. Active tasks are never evicted by the former eight-card cap.
- Loading older messages retains live tasks. Switching conversations fences old events. Reopening saved active jobs starts a fresh observation of server-owned state; it does not repeat paid work. A late event cannot revive a stopped observation.
- Spoken progress is opt-in and the setting persists. It begins only after three seconds, is spaced by at least 15 seconds, and unchanged messages repeat no sooner than 30 seconds. It is suppressed while hidden, listening or speaking. Starting capture, an arriving answer sentence, or switching the setting off stops progress speech without aborting the answer.
- Keyboard-accessible activity details and a polite status region provide text access. Timer ticks and card removal are silent. The panel visibly indicates whether progress voice is on. Real microphone and screen-reader listening were not performed; automated event and DOM checks cannot certify their acoustic quality.

## Defects found during verification

Actual failing regressions demonstrated active-task eviction, default-on progress voice, microphone capture beginning without cancelling progress speech, wall-clock jumps inflating elapsed time, pagination clearing activity, raw tool text overriding the safe announcement, and a transient audio reset leaving Ready under an active request. Each was corrected and retested. Older isolated UI fixtures were updated to supply the new activity dependency; their existing assertions remain intact.

## Verification

**835 application tests passed:** 789 Oracle and 46 website tests, with zero skips. Lint, type checking, build and browser journeys passed. The browser test deliberately holds a request before any response, verifies immediate preparation and the honest 15-second waiting notice, then delivers synthetic progress and an answer. It checks keyboard details, opted-in audio, clarification status, hostile text rendering, secret-free tool labels and silent elapsed updates. Production providers and websites are not used by these deterministic tests.

The final application fingerprint is **4705cca32e375e1373fe37eaeda3fd776a7273dd61b322201752f7cf2fd88f9a**. A separate live check verified the running version and heartbeat. Activation waited for the current work to finish. The knowledge index integrity check passed, with 391 ledger claims retained and no missing/orphan vectors reported. Progress events themselves do not write factual knowledge.

Evidence: [full verification report](<D:/1code projects/British Terror/work/mani-verification-2026-09-14T17-26-29-365Z/report.json>), [live runtime check](<D:/1code projects/British Terror/.ensemble_reviews/live-progress/live-check.json>), [desktop screenshot](<D:/1code projects/British Terror/work/mani-progress-visual/desktop.png>), [phone screenshot](<D:/1code projects/British Terror/work/mani-progress-visual/mobile.png>).

## MOMM review

MOMM **1.15.1**, run **rev_20260914171152_tsk3**, reviewed a synthetic behavior specification only. Application source, credentials, databases and private conversations were not exported. Claude returned MODIFY with six findings; Antigravity returned ACCEPT with none; Grok returned invalid output and did not contribute findings or quorum. Two valid reviewers met the required quorum. Agreement was zero: the findings were Claude's unique catches, not consensus proof.

All six findings and seven suggestions were triaged. Specification omissions were checked against the preserved original document before clarification; local application tests independently established executable behavior. The governor completion validator succeeded and recorded a receipt tied to the final application verification. This records the evidence chain, not universal correctness or external code review.

[Private MOMM ledger](<D:/1code projects/British Terror/.ensemble_reviews/live-progress/behavior-review/.ensemble_reviews/ledger.html>)

## Dispositions

| Reviewer | Finding or suggestion | Disposition | Reason / verification |
|---|---|---|---|
| claude | State the retention invariant explicitly: evict only terminal cards, and let active tasks exceed the cap or collapse into a '+N running' summary. | applied-with-modification | Reproduced nine tasks losing the oldest, and fixed retention: active tasks are never evicted; terminal clutter is removed on a new start. Oldest-failure and independent-task tests pass. |
| claude | Define a single per-activity state machine (preparing → phase* → terminal{success, unanswered, failed, cancelled, observation-paused}) and derive the no-revive, restore and freeze rules from it. | applied-with-modification | Clarified observation scope: pausing stops this visit’s observation; explicit reopening checks server-owned active receipts using a fresh controller without restarting paid work. Late updates cannot revive a paused card. Also reproduced and fixed pagination clearing live activity. |
| claude | Specify which stream carries visual-generation heartbeats, and which announcements (15s waiting, 20s connection loss, card removal) go to the polite region, with de-duplication across concurrent tasks. | applied-with-modification | Specified answer versus session-stream heartbeats, visual connection ownership and de-duplicated polite announcements; timer ticks and removal are silent. Transport cleanup and DOM announcement tests pass. |
| claude | Consider defaulting spoken progress off when voice input is not in use, or asking on first voice interaction. | applied-with-modification | Reproduced default-on preference and changed it to explicit opt-in. The visible voice-off/on cue and persistent setting preserve user choice; browser checks confirm the initial state. No physical screen-reader session is claimed. |
| antigravity | Define an explicit monotonic clock reference (e.g., performance.now or server timestamp deltas) for UI timer calculations to prevent drift across system sleep or clock adjustments. | applied-with-modification | Use a monotonic clock. Reproduced wall-clock changes inflating elapsed duration; the same test now passes with performance.now. |
| antigravity | Specify an explicit eviction policy (e.g., FIFO) and dismiss animation behavior when the eight-card limit is reached during rapid task generation. | applied-with-modification | Reproduced nine tasks losing the oldest, and fixed retention: active tasks are never evicted; terminal clutter is removed on a new start. Oldest-failure and independent-task tests pass. |
| antigravity | Provide an explicit user-facing visual cue when progress speech is active or muted so screen-reader and voice users have immediate modality parity. | applied-with-modification | Added a visible Progress voice on/off cue. Preference changes update it immediately and disabling the setting silences an active progress utterance. |
| claude | eviction-drops-active-task | applied-with-modification | Reproduced nine tasks losing the oldest, and fixed retention: active tasks are never evicted; terminal clutter is removed on a new start. Oldest-failure and independent-task tests pass. |
| claude | restore-vs-no-revive-conflict | applied-with-modification | Clarified observation scope: pausing stops this visit’s observation; explicit reopening checks server-owned active receipts using a fresh controller without restarting paid work. Late updates cannot revive a paused card. Also reproduced and fixed pagination clearing live activity. |
| claude | progress-speech-mic-echo | applied-with-modification | Reproduced capture starting without silencing progress. Capture now cancels progress first without aborting the answer. First real sentence also preempts it; both event-order tests pass. |
| claude | default-on-speech-a11y | applied-with-modification | Reproduced default-on preference and changed it to explicit opt-in. The visible voice-off/on cue and persistent setting preserve user choice; browser checks confirm the initial state. No physical screen-reader session is claimed. |
| claude | missing-verification-coverage | applied-with-modification | Added application tests for retention, explicit restore, microphone preemption, metadata clarification, hostile DOM text, raw tool text, opted-in speech, and heartbeat cleanup. Browser checks cover silent timer/removal announcements. Local implementation tests remain distinct from this document-only peer review. |
| claude | hidden-tab-false-connection-loss | applied-with-modification | Clarified that the warning means no recent connection update, never provider failure. A buffered heartbeat clears it without advancing the operation; fake-clock recovery test passes. No synthetic heartbeat or grace period hides a real missing connection. |

