# Mannin conversation handling audit — 13 September 2026

The local app has been updated at [Mannin](http://127.0.0.1:4242/?view=chat-coverage-20260913#talk). No changes were committed, uploaded or published. Existing unrelated working-tree changes and saved conversations were preserved.

## What the transcript exposed

| Failure | Cause | Correction |
| --- | --- | --- |
| A question about external access with a weather example received only a forecast | Live-tool selection and the fixed-response shortcut could ignore another part of the request | Capability explanations run locally. A hypothetical example gets a specific optional lookup; actual mixed requests retain their factual questions. Fixed tool responses are used only when they cover the whole factual request. |
| An Island forecast was described as sufficient for Peel | The source planner could choose the general forecast without preserving the requested place | Named towns require a separate source search. The response distinguishes a forecast from a measurement and preserves requested forecast days. |
| “Did you see my question?” and conversation analysis acquired factual labels and research controls | Repair wording fell through to factual routing | These use the saved conversation, preserve a valid pending action, and cannot create factual Search or MOMM offers. Financial exchange and messaging-product questions remain factual. |
| “Do it all” lost the intended action | The preceding response could replace the subject or manufacture an unrelated research offer | Capability examples bind a concrete action to the completed turn. Voice acceptance and the button use that subject; reload preserves it. A capability list does not authorise running every capability or a MOMM review. |
| Search diagnostics repeated the same failure | Empty discovery was followed by the same search with no new source destinations | Recovery searches still follow failed page reads, but an empty discovery result is not immediately repeated with the identical query. |
| A mixed request's follow-up included Mannin's own capability wording | Retrieval and follow-up offers used the entire compound request | Retrieval, source relevance, expeditions and saved search offers use the factual part. Answer generation still receives the full request. |

## The console warning

The reported warning was `Permissions policy violation: unload is not allowed in this document`, attributed by the user to `content.js:1`.

No app-owned `content.js`, `unload` listener, `beforeunload` listener or unload permission header was found. Mannin already uses `pagehide` and `visibilitychange`. An isolated browser instrumented listener registration while loading the real app under an explicit `Permissions-Policy: unload=()` response header. It recorded five supported lifecycle registrations, no unload registrations, no JavaScript errors and no console messages. The typed draft survived simulated page hide/show events. This is a page-event check, not certification of every browser's back/forward cache behaviour.

The actual localhost response contained its existing content-type, cache and referrer headers; it did not set a Permissions-Policy header. No policy was weakened and no console warning was suppressed. Chrome recommends moving away from unload to supported lifecycle events: [Chrome unload guidance](https://developer.chrome.com/docs/web-platform/deprecating-unload), [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

The browser-control connection failed to attach to the user's existing browser. Consequently, the original `content.js` source URL and the warning's owner could not be established. An injected browser script is a possibility, not a confirmed diagnosis. The original warning is **not claimed to be fixed**; app behaviour under the restrictive policy was verified.

## Verification

- Six initial transcript reproductions failed before implementation. Two additional saved-offer tests exposed and fixed the button validation and research-eligibility paths.
- Six review regression groups failed before their fixes: hypothetical variants, smart punctuation/greetings, factual exchange/chat nouns, receipt verb forms, additional towns and forecast-versus-observation shortcuts.
- Two further failing tests covered factual-only retrieval/offer scope and retention of a requested forecast day.
- Final local suite: **581 passed, one skipped**. Integrated website suite: **46 passed**. Total: **627 passed, one skipped**. Lint, TypeScript and production build passed.
- An isolated instance of the real server used a fresh test database. Its capability response required no model call, offered the correct subject, survived reload, and dispatched the button with the saved turn ID. The subsequent source response was synthetic to avoid starting unnecessary live work.
- Browser checks passed at 390 and 1,280 pixels without horizontal overflow. Source-reading and review regressions remained green.
- The existing localhost server was confirmed idle before restart. Its health endpoint now reports `2026-09-13-chat-coverage`, with no active answer or tool work at verification.

Primary regression files: `oracle/tests/chat-request-coverage.test.mjs`, `oracle/tests/capability-offer.test.mjs`, `oracle/tests/chat-coverage-review.test.mjs`, and `oracle/tests/mixed-request-offer.test.mjs`. Verification logs and synthetic browser fixtures are retained locally under `work/chat-20260913-*`.

## Peer review and dispositions

MOMM run `rev_20260912224753_o76o` received only the scoped public code and synthetic tests. Private attachments, conversations, credentials, databases and review logs were excluded.

Claude returned MODIFY, with three warnings and one minor finding retained in the normalised report. Antigravity returned invalid output and Grok timed out. Agreement score was zero; all retained findings came from Claude. The risk ranking identified the request classifier and conversation policy. **Only one of two required reviewers completed: this was not a successful multi-reviewer approval.** All material findings were reproduced and corrected locally. The final corrections were tested locally; there was no subsequent external review run.

Every row below was recorded against that run in the private, ignored `.ensemble_reviews/dispositions.jsonl`; `.ensemble_reviews/ledger.html` was rebuilt.

| Reviewer | Finding or suggestion | Disposition | Reason / verification |
| --- | --- | --- | --- |
| Claude | Hypothetical wording could trigger a lookup | Applied | Explicit hypothetical cues stay explanatory; suffix variants tested. |
| Claude | Smart apostrophes defeat preamble recognition | Applied | Shared quote/whitespace normalisation; mobile-input variants tested. |
| Claude | Exchange-rate questions treated as conversation | Applied | Noun boundaries tightened; exchange controls, rates and chat services tested. |
| Claude | Missing receipt-question verb forms | Applied | Heard, understood, answered, get and negated forms tested. |
| Claude | Classify only once in dialogue routing | Rejected | Source selection, research eligibility and saved-offer validation are independently callable boundaries. They share the same pure classifier and validate their own input. |
| Claude | Fail closed on hypothetical cues | Applied with modification | Explicit examples remain explanatory; polite “could you get it now” remains an actual request. Both paths tested. |
| Claude | Share text normalisation | Applied | Capability and fixed-tool coverage checks use the same normaliser; punctuation tests pass. |
| Claude | Share and expand Manx place recognition | Applied | One list feeds both weather patterns; additional towns and Ronaldsway distinction tested. |
| Claude | Retrieve and offer only the factual remainder | Applied | Retrieval input, pending action and saved button destination tested together. |
| Claude | Add nearby-variant regression cases | Applied | Table-driven tests cover punctuation, greetings, dates, locations and non-conversation nouns. |
| Claude | Tighten capability grammar and clause boundaries | Applied | Access and connection constructions separated; greeting and comma/semicolon clauses supported. |
| Governor | Complete the two-reviewer assessment | Deferred | Antigravity and Grok did not produce usable assessments. Their failures are review limitations, not approval or product findings. |
