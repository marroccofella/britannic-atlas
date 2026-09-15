# Mannin Matrix interface refinement — 14 September 2026

The local interface again centres the live speech transcript, green terminal typography and the Manx artwork. Secondary controls sit in native keyboard-accessible disclosures. Search and MOMM progress remain visible in a compact area, with the polite announcement region and optional spoken updates preserved.

Recognised words remain stable while the browser revises unfinished words. Text appears immediately and is rendered literally. Reading earlier transcript lines no longer forces the view back to the end. The cursor respects system and explicit motion preferences.

## Verification

- 886 tests passed: 840 Oracle and 46 website tests; no skips.
- Lint, type checks, build and browser journeys passed.
- Browser checks covered phone and desktop layouts, keyboard disclosures, speech corrections, stable text nodes, literal markup, Escape without submission, motion preferences, progress expiry and the browser console.
- A supplementary check on the actual live status element confirmed that its message remains visibly readable after the progress panel disappears.
- Tests used synthetic recognition events, without accessing the user's microphone or sending test conversations to external models.
- Final report: `work/mani-verification-2026-09-14T20-21-05-864Z/report.json`.
- Served local HTML and stylesheet were checked against local source. Assets use no-cache. Existing tabs need a refresh.

## MOMM 1.15.1

The first review completed with Claude and Antigravity; Grok timed out. Claude's status-visibility and motion-setting findings were reproduced, repaired and verified. The whitespace finding was rejected after testing the actual capture producer, which already normalizes both strings. All suggestions were adjudicated in the private ledger.

The first bundle's formal completion could not bind the reviewers' embedded filename labels to the single reviewed artifact. That record remains explicitly unvalidated rather than being rewritten. A correctly scoped follow-up reviewed the repaired CSS: Claude and Antigravity both accepted. Its final completion receipt validates all dispositions and the final local source hashes. This validates records and bytes, not universal correctness.

The follow-up's legacy-browser compatibility nit was acknowledged outside the tested scope: the interface already uses :has(). The verified current browser supports it. No legacy-browser coverage is claimed.

No application backend, conversation data, knowledge records or search behavior was changed. Nothing was committed or published.

## Disposition summary

| Reviewer / run | Disposition | Verification or reason |
|---|---|---|
| Claude / first | Applied two findings and the related visibility suggestion | Both failed before repair and passed after; final browser gate passed |
| Claude / first | Rejected whitespace finding and three other suggestions | Capture-producer normalization, existing motion owner and intentional empty listening line |
| Antigravity / first | Applied responsive stylesheet cleanup; rejected two suggestions | Final browser gate; capture strings and fixed activity labels already satisfy the contracts |
| Grok / first | Timeout | No usable review; not counted toward quorum |
| Claude / final | Applied responsive cleanup; rejected remaining suggestions and compatibility nit | Current-browser checks passed; existing tests, intentional spacing and declared scope |
| Antigravity / final | Applied responsive cleanup; rejected extra animation abstraction | Final browser gate; retained a single motion owner |
