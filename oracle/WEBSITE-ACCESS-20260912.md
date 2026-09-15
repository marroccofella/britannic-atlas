# Public website reading — local repair, 12 September 2026

Mani can now read supported public HTTPS pages outside the preferred Manx source list, public document/pagination query links, and text-based PDF documents. The preferred source catalogue and evidence classification remain separate from URL reachability. Reading a page does not verify it.

The transport follows up to five validated redirects, checks DNS addresses in the actual connection, decodes bounded gzip/deflate/Brotli responses, retries one transient network/server failure, and retains server Retry-After deadlines. It sends no browser cookies or account credentials. Login/signed/private-network URLs, unsupported file types and unsupported query parameters require a browser or a readable copy. JavaScript-only pages and image-only PDFs may have no extractable text.

Failed reads and partial PDF coverage are displayed in Source access beneath the answer, with the original source link. These links are not presented as evidence. Weather, news and forecast failures also retain recovery links. SourceAccess consumes persisted meta events; it makes no requests itself.

## Observed public requests

- Tynwald homepage: read successfully (3,190 characters).
- Wikipedia Isle of Man article: read successfully (excerpt bounded to 12,000 characters).
- Government consultation portal: read successfully (excerpt bounded to 12,000 characters).
- Main Government homepage: returned a real automated-access refusal. No bypass attempted.

These results do not guarantee every website is readable or that a site remains available. The separate provider WebSearch/WebFetch research route retains its provider's access limitations.

## Verification and review state

Six original access failure regressions pass, including the PDF/crawler fixes independently delivered by the other local task. The final Oracle suite passes 533 tests, with one skipped and zero failures. Focused lint passes. The real interface recovery panel passes at mobile and desktop widths with all conversation APIs mocked; no user conversation or model call was created by that browser test.

The internal read-only review found lost Retry-After deadlines for 502/504, shortened long cooldowns and missing weather/news recovery links. Each was reproduced before fixing; oracle/tests/reader-recovery-review.test.mjs also checks the raw transport refuses credential-bearing URLs before opening a connection.

The new external MOMM dispatch was initially rejected. The user explicitly approved it, and two reviews completed: rev_20260912165030_elay (one Antigravity ACCEPT; Claude/Grok timeout; quorum 1/2) and rev_20260912165833_4k1m (Antigravity invalid output; Claude/Grok timeout; quorum 0/2). The required external quorum was not achieved. No incomplete or timed-out response is treated as acceptance. All four optional suggestions in the substantive review were explicitly rejected with reasons and evidence in the ledger. The earlier coverage-label review is separate: one substantive Antigravity ACCEPT, unavailable other routes, and a low-confidence incomplete-input Grok response. The two overlooked Antigravity suggestions now have explicit dispositions in the private ledger.

## Coverage correction discovered when checking the supplied step-one report

The overall catalogue totals were correct, but per-area totals misclassified 17 outline area roots as groups. The local stats module now applies the same evidence classifier to each area root and its descendants. The table now reconciles to 149 source-linked topics, 2,704 research outlines and 16 grouping nodes (2,869 topics). The regression failed before the fix with 2,687 versus 2,704 outlines, then passed. Local site build and all 46 hosted tests pass; nothing was published.

## Reader review dispositions

| Suggestion | Disposition | Verification / reason |
|---|---|---|
| In public-reader.mjs, replace [...s].some(...) character-code inspection with a compiled regex (e.g. /[\x00-\x20\x7f]/) to avoid array allocations during string validation. | rejected | No measured validation bottleneck exists for URLs bounded to 2,000 characters. Character-code checks are explicit and pass the project no-control-regex lint rule; the suggested regex recreates that lint conflict. oracle/lib/public-reader.mjs control/readablePage; focused ESLint passed |
| In public-reader.mjs, call timer.unref() on the 15-second request timer in requestPublicPage to avoid keeping the Node.js event loop active. | rejected | The request deadline is intentionally active until completion/error; the close handler clears it. The bounded reader must finish or reject outstanding work rather than let a lone pending request silently exit. oracle/lib/public-reader.mjs requestPublicPage:15-second timeout and req close cleanup inspected |
| In live-tools.mjs, parse requestedPage using an explicit null fallback rather than Number(undefined) (NaN) when no #page hash is present to prevent relying on NaN falsiness in page ranking. | rejected | This is pre-existing PDF ranking behavior, outside the transport repair. Missing fragments produce NaN and are intentionally falsy; existing PDF tests verify ordinary and requested-page reads. No incorrect selection was demonstrated. oracle/lib/live-tools.mjs requestedPage and PDF extraction; oracle/tests/quality-routing.test.mjs and website-access.test.mjs pass |
| In source-access.mjs, append section directly to turn as a fallback if turn.querySelector('.nextSteps') is not present in the DOM. | rejected | Every actual conversation turn contains the nextSteps anchor. Browser tests verify the recovery panel is visible after the real meta event; no supported turn layout lacks that anchor. oracle/public/index.html turn template; work/reader-browser-result.json mobile/desktop test |
| Preserve Retry-After for 502/504 across repeated requests | applied | Independent local review reproduced the failure before the governor correction; regression now passes. oracle/tests/reader-recovery-review.test.mjs — 502 and 504 respect a server retry deadline across separate requests |
| Preserve long server cooldowns instead of shortening them to one day | applied | Independent local review reproduced the failure before the governor correction; regression now passes. oracle/tests/reader-recovery-review.test.mjs — long server retry instructions are not shortened to one day |
| Keep source recovery URLs for weather, news and forecast failures | applied | Independent local review reproduced the failure before the governor correction; regression now passes. oracle/tests/reader-recovery-review.test.mjs — weather and news failures include their exact recovery page |

## Focused coverage review

rev_20260912170051_tibh received one substantive Grok MODIFY review; Antigravity timed out, so its quorum was also not met (1/2). The warning about unknown evidence categories was reproduced and fixed. All four suggestions have explicit decisions below. No timeout or invalid output counts as approval.

| Suggestion | Disposition | Verification / reason |
|---|---|---|
| Reject unknown or missing evidence labels rather than silently counting them as grouping nodes. | applied | The synthetic catalogue test failed before the fix and passes after explicit sourced/outline/group classification with an error for unknown values. tests/discovery-evidence-categories.test.mjs — unknown and missing evidence labels; work/discovery-evidence-before.log and after.log |
| Pin the 22 area roots in the regression by asserting each area's own evidence bucket: load the area node and check that coverageOf(area, true) increments outlineCount or groupCount to match area.evidence, not merely that the three buckets sum to topicCount. | applied | Added synthetic area-root cases covering sourced, outline and group, alongside all-category reconciliation on the real catalogue. tests/discovery-evidence-categories.test.mjs — an area root retains each supported evidence category |
| Replace the Vite SSR boot in the test with a direct import of stats.ts (or a tiny Node loader) so the invariant runs in milliseconds and does not depend on a bundler lifecycle. | rejected | The Vite SSR loader matches the existing project tests and actual JSON/TypeScript import behavior. A separate Node loader adds configuration without addressing a correctness defect. tests/discovery.test.mjs existing ssrLoadModule convention; focused tests complete successfully |
| Walk the tree once, stashing Coverage on each node, then derive both discoveryStats and discoveryAreas from those cached bags instead of re-tallying every area. | rejected | The bounded catalogue is traversed approximately twice during module initialization. No runtime latency defect was demonstrated; a caching refactor is outside the count correction. app/manx/discover/stats.ts total and area initialization inspected |
| Inventive idea: emit a coverage merkle — a hash of (id, evidence, child-coverage) per node — and snapshot the 22 area hashes; any silent reparenting or evidence drift would fail a single equality, and the same hashes could drive a live 'where did the count move' treemap without recounting. | rejected | Merkle snapshots and a change-history treemap add new state and interface scope. Direct category invariants expose the observed defect with readable expected counts. tests/discovery-area-coverage.test.mjs and discovery-evidence-categories.test.mjs |
| Classify each area root using its own catalogue evidence value instead of adding every area to grouping nodes. | applied | Independently reproduced 17 outline roots counted as groups. The corrected table reconciles all categories with the actual catalogue. tests/discovery-area-coverage.test.mjs; work/discovery-area-before.log and after.log |
