# Mannin spoken progress repair — 14 September 2026

The app had progress speech off by default, even while visual progress was on. Its scheduler also delayed the first cue for three seconds, allowed a minimum of fifteen seconds between cues, and selected only the newest active task. The earlier UI tests checked visible progress but did not establish that default progress reached speech playback.

The requested voice-first behavior is now implemented locally:

- Progress speech defaults on. An explicitly saved mute remains respected, including across reloads.
- An eligible first cue arrives after about one second; subsequent changes are coalesced with at least six seconds between cues. Unchanged updates repeat no more often than every twenty seconds.
- Concurrent activities share announcements so a long-running search cannot indefinitely hide MOMM progress, or vice versa.
- Microphone use, answer playback, hidden tabs and explicit mute suppress progress speech. The current stage is used when speech resumes; obsolete progress messages are not queued.
- Answer speech preempts progress speech. Muting progress leaves the request and answer playback intact.
- A failed voice exposes an Enable voice feedback button. Its user-gesture retry preserves the active request.
- Existing final answer and MOMM outcome playback remains in place.

## Evidence

The new regression expectations failed in four cases before the repair and passed after it. Final verification passed all 889 tests (843 Oracle, 46 website), lint, type checks, build and browser journeys. The browser suite now uses a synthetic speech device to observe calls and start events, and verifies interruption, mute persistence, answer priority and failed-voice recovery. It does not establish that the user's physical speakers are audible.

Final report: `work/mani-verification-2026-09-14T20-44-11-776Z/report.json`.
Live asset proof: `work/spoken-progress/live-proof.json`.
The running local app serves the checked HTML, JavaScript and progress module with no-cache headers. Existing tabs must be refreshed to load changed JavaScript.

MOMM has not yet reviewed this update. Automatic approval review rejected sending the new code payload because earlier consent covered other changes. The exact public-code and synthetic-test bundle is prepared locally at `work/spoken-progress/review-input.md`; no export occurred. Conversations, credentials and databases are excluded. A separate approval request is pending.

Nothing was committed or published. The prior Matrix styling is retained.
