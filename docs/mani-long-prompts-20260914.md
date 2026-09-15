# Mani long-prompt input repair — 14 September 2026

The local app now accepts up to 12,000 characters per question. A visible count and inline validation are present in both the chat composer and shared explorer question editor. Oversized pastes are preserved, not truncated.

The original chat was a single-line field with a hidden 2,000-character check; its warning appeared in the voice status away from the input. The explorer separately imposed a native 2,000-character maximum, and saved chat questions were capped at 2,000 characters. These were distinct failures.

Enter submits from the chat composer. Shift+Enter adds a line. IME composition and repeated keydown events do not submit. The send button shares validation and submission handling. Accepted multiline text reaches the request intact; failed sends restore the draft without replacing nonempty newer input. Counts update after discovery transfer, draft restoration and research-question prefills. The model retains the full original request, or the full content request when review administration has been separated for an automatic MOMM handoff. Bounded history/retrieval projections remain bounded.

Validation: 899 automated tests passed (853 Oracle, 46 website), plus lint, types, build, and browser journeys. Browser checks used real Enter and button events with synthetic responses, including maximum-length input, oversized paste preservation, empty input, IME, multiline text, HTTP failure restoration and explorer transfer. A deliberately injected HTTP 503 was asserted separately from unexpected console errors. Model-input tests used a stub model, not paid providers.

Final report: work/mani-verification-2026-09-14T21-10-11-776Z/report.json
Live proof: work/prompt-input/live-proof.json
Source manifest and prepared review input: work/prompt-input/source-manifest.json and review-input.md.

The idle local server was restarted and its served assets were matched to the checked files. Its over-limit response confirms the live 12,000-character policy. Knowledge-base integrity remains clean; no knowledge or conversation content was used as a test fixture against the live server.

MOMM: prepared locally, awaiting approval to export the scoped 20-file update and synthetic tests to Claude and Antigravity. The previous automatic approval rejection requires consent for the new payload. No new review has been dispatched; no peer findings or completion are claimed. User conversations, transcripts, credentials, databases and review logs are excluded.

No commit, upload or publication was performed. Reload existing tabs, or open http://127.0.0.1:4242/?view=long-prompts-20260914#talk.
