# Oracle — a Manx-first spoken answer engine

Oracle sits beside the Britannica Atlas and turns its Isle of Man knowledge into something you can talk to. Every new conversation starts in the Isle of Man: an unqualified mention of the Island, government, companies, law, tax, ports, transport, infrastructure or public services is interpreted as Manx. A clearly named foreign place can override that for one answer without changing the home context.

One-turn overrides recognise the Crown Dependencies, the United Kingdom nations, all named British Overseas Territories and common neighbouring countries. They are labelled on that answer only; short follow-ups return to the last Manx subject, and a fresh foreign-only turn does not silently become permanent context. “Go deeper” is armed only by a completed Manx answer, so a one-turn foreign comparison cannot create a misleading Manx research request.

You speak, it listens in British English, shows how it interpreted imperfect speech, and answers sentence by sentence in a British voice. Short follow-ups such as “all”, “tell me” and “figure it out” stay attached to the active subject. Known recognition slips such as “draw me a mao” and “infastructure” are repaired locally; uncertain speech is shown for confirmation instead of spending money or blaming the user.

The application and its databases run locally, without API keys: Node's SQLite holds the ledger, sqlite-vec plus a pinned on-device embedding model provide semantic retrieval, the Claude CLI uses your existing account for answers, MOMM's OAuth reviewers cross-examine answers and visuals, and the browser's Web Speech API provides speech. Answer generation and peer review contact their respective providers; embedding and vector search do not upload the corpus.

See [MANX vector knowledge base](MANX-INDEX.md) for setup, crawl coverage, authorised document imports, freshness limits and verification boundaries.

## Conversation-first repair (9 September 2026)

Common greetings, input-channel acknowledgements and questions about Mani, trust and MOMM now use short, zero-model-cost local replies. A MOMM example stays attached to that product topic after reload. These exchanges do not receive factual-evidence badges or paid-research offers. Full new questions clear stale clarification prompts; incomplete fragments receive one short clarification without speculative tax or technical answers.

Model answers are prompted to lead with one to three useful sentences unless depth is requested. Factual source checks, confidence caps and explicit research consent remain in place. This improves the conversation contract; it does not guarantee model accuracy or fill blocked Government-source coverage.

Messages are limited to 2,000 characters. Longer pastes are retained in the input with an explanation; direct oversized requests return readable JSON rather than a disconnected socket. Browser acceptance uses product replies and synthetic speech, not microphone recordings or paid research. The independent peer-review attempt timed out and did not meet quorum.

```bash
npm run oracle          # http://127.0.0.1:4242  (Chrome or Edge for the microphone)
npm run oracle:test     # unit tests, no model calls
npm run oracle:check    # tests plus Oracle-only lint
npm run oracle:dream    # one unattended curiosity expedition
```

## Complete local verification (13 September 2026)

Run `npm run oracle:verify` for the full local gate. It checks PDF extraction, the pinned offline embedding model, all Oracle tests, project lint, TypeScript, the website build and tests, and an isolated browser journey. A skipped, cancelled or unfinished TODO test, missing dependency, incomplete test summary, failed browser check, or change to the named source snapshot during testing makes the run fail. The ordinary unit-test command can still skip optional runtime tests; it is not the full gate.

The runner uses the configured `ORACLE_PDF_PYTHON` or the optional local runtime's `pdfPython` setting and requires `pypdf`. It uses installed Playwright (or the bundled desktop runtime); `MANI_PLAYWRIGHT_MODULE` can identify another installed module. It does not install dependencies or download models automatically. Logs, screenshots and the report go in a new `work/mani-verification-*` directory; `work/mani-verification-latest.json` identifies the latest result, including failures. Browser tests create their own local database and disable paid research and MOMM.

Browser coverage includes a real free knowledge-map answer, saved-history reload, low-confidence speech admission, keyboard evidence disclosure, uncited-retrieval labelling, page lifecycle events, 390/1280px layouts, and explorer drill-down, Back/Forward, question preparation and draft restoration without submitting or changing conversations. A strict `unload=()` policy remains enabled during the check; fresh sessions restore an empty history without a console 404. Synthetic speech and answer fixtures are explicitly distinguished from real endpoints.

Retrieved records are not automatically citations. Valid inline claim citations now survive missing model metadata, while an answer that cites none of its retrieved evidence explains that limitation and retains its lower evidence status. Knowledge maps disclose keyword matching and the 40-result limit. Their dates describe ledger records, not source publication dates, and primary-source counts do not imply that every source is Manx.

This gate does not certify every model answer, every external website, actual microphone recognition, screen-reader output or physical voice playback. See [the full testing audit](../docs/mani-full-testing-audit-20260913.md) for findings, evidence and outstanding acceptance work.

## Release status

**Supervised internal alpha.** Not for public or unsupervised use. The browser journey audit of 4 September 2026 (`.ensemble_reviews/oracle-browser-journey-review-20260904.md`) set the release gate, and the September 7 local repairs address its outstanding delivery items:

| Blocker | Status |
|---|---|
| P0-1 false answers wearing verified badges | Closed. Status is bound to the answer's own content by an entailment check that only ever lowers a status. |
| P0-2 explicit foreign scope silently rewritten as Manx | Closed. A named country is honoured; an unqualified question stays Manx-first. |
| P0-3 reload recovery | Repaired for results completed after the September 7 update. Answers, research, successful reviews and canvases restore; old unsaved reviews cannot be reconstructed. |
| P0-4 truthful canvas success | Repaired. Rendering reports whether a visual was drawn or only a safe text alternative is available; failed actions remain retryable. |

What the automated suite proves and what it does not: the automated tests and Oracle-only lint cover the logic above, including a fake-clock check that the Three Legs rotate while thinking. They do not replace browser acceptance checks in a visible tab, and reduced-motion behaviour was verified only for the testing pane, not as a general default.

## How an answer happens

The Mani microphone control uses a vector tracing of the supplied mechanical Three Legs artwork. A click immediately shows “Opening microphone” and can be cancelled with another click. The legs and their three lights rotate while listening, waiting for the final transcript, preparing an answer, or running research for this conversation. This includes gaps between streamed sentences and long-running answer reviews or visuals. “Processing voice” can be cancelled; a delayed or duplicate transcript cannot restart a cancelled answer.

A pale-mint contour glow follows the actual traced legs and mechanical details, using a shared SVG instance under the original artwork rather than a hand-drawn connector around the three lights. Both layers rotate together without drifting; the feedback glow disappears at rest. Real edits in either question/transcript input pulse it; fast typing sustains brightness instead of strobing. During Mani playback the contour response is softer so the central orb and three speech lights remain the focus. After the user starts listening and recognition opens, a local-only microphone RMS meter follows voice level and silence without recording, storing, playing or uploading samples. If metering is unavailable, recognition events remain a fallback and the status explains that limit. The meter releases tracks on Stop, final transcript, error, cancellation and hidden-page navigation; delayed permissions cannot revive it, and audio-context startup is time-bounded. Reduced motion retains static feedback instead of amplitude flashes.

During actual Mani playback, green, blue and gold zones represent word onset, estimated syllable rhythm and phrase sustain/release, with matching centre-ring sections and a brighter central orb. Browser word boundaries anchor timing. If a voice omits them or speaks longer than the estimated plan, gentle estimated articulation continues until playback ends. Output effects are expressive timing cues—not measured loudness or phonemes. The legs stop rotating during output speech; the three lights and centre move instead.

Mani sits beside the conversation on desktop and becomes a compact voice card on phones. The question field comes before the suggested topics; voice preferences and service quotas are under “Voice & settings”, with evidence diagnostics in the voice card. The standalone SVG is labelled as an animation preview and links back to Oracle; its controls do not record or generate speech.

Pause, Stop, interruption and playback errors extinguish the speech glow. Pending work returns to the thinking indicator. Reduced-motion mode uses static lights and an activity label; a visible “enable animation” control and the existing Motion preference let the user explicitly override it. Hidden tabs suspend animation work and stop/discard microphone input; another user action is required to resume listening.

Regenerate the tracing with `python oracle/tools/trace-mani.py INPUT.png oracle/public/mani-triskelion.svg` (build-time Pillow only; no added browser/npm dependency). `node oracle/tools/export-mani.mjs` exports `oracle/public/mani.svg` with the exact live controller and feedback styling embedded. Listening, Thinking, Speaking, Typing and Idle previews simulate events; the preview does not record or speak. Its motion choice is stored separately so it cannot turn off animation in the main app. Oracle itself drives these effects from microphone levels and recognition/playback/input events. Interactive preview controls require opening the SVG as a document; an SVG embedded as an image does not execute its scripts.

1. **Resolve.** A deterministic dialogue layer repairs a small, bounded set of speech errors, restores the active subject, and applies the Isle of Man default. Map requests are completed instantly with the bundled Manx map and make no model call.
2. **Focus.** The resolved request—not the rough transcript—is matched against Manx-scoped ledger evidence. Each hit is weighted by its *trust* (status × confidence × age decay × attention), and the best claims are packed into a fixed token budget.
3. **Answer.** Local product and greeting replies bypass the model. Other questions stream a concise spoken answer that cites relevant ledger tags and explains material uncertainty without a compulsory spoken disclaimer. Sentences are handed to the synthesiser as they arrive.
4. **Meta.** A hidden JSON tail carries the model's confidence, which tags it relied on, and any gaps. The status shown to the user is **derived from the claims actually used**, not asserted by the model. Unsupported fluent answers remain labelled as model knowledge with capped confidence.
5. **Research offer.** If the ledger coverage is thin or the answer exposes a real gap, Oracle offers **Check official Manx sources**. Nothing is queued and no gap is recorded until the user explicitly confirms. That confirmation runs the fast source pass only; its progress, first sourced answer, citations, unresolved points and final status return inside the originating conversation card. Completed research is read aloud by default, with a remembered opt-out in Voice & settings. It waits for active speech/input/tools to finish; every result has a replay control. If no official Manx source is found, Oracle says so and keeps the gap open instead of presenting secondary material as an official verification.

**Go deeper** is deliberately different: it runs the full research, adversarial, lateral and cross-model sequence. Both routes survive a page reload for the same browser session. Cancelling an active check aborts its model work and fences every late preview or result; a new conversation does that for all research owned by the old session.

## Think harder with MOMM

Every completed substantive Isle of Man answer has its own **Think harder with MOMM** button. One click is the consent point for a bounded peer-review run. The browser sends only the answer episode reference; the server reloads the answer and public evidence itself, strips conversation identifiers, raw speech, local paths, URL credentials and private-looking metadata, then asks the available OAuth reviewers to challenge it. After success, that answer's button disables so an accidental second click cannot buy the same review twice; later answers still have their own button.

The result is shown as a considered answer, evidence status, reviewer verdicts, concise rationale summaries, concrete findings, corrections, and points of agreement or disagreement. It does **not** expose private chain-of-thought, raw prompts, arbitrary reviewer markup, or local review paths. Reviewer agreement is not treated as source evidence: if synthesis materially changes the answer, the changed wording is marked **not source-verified** until those new propositions are researched.

Stop, barge-in, a newer question, New Conversation, and server shutdown cancel or fence outstanding MOMM/canvas work. The server drains that work before closing the ledger.

## Reviewed canvas

Requests such as “draw a graph”, “make a chart”, or “show a diagram” use the reviewed canvas path. Oracle first says what it can and cannot produce; for example, a photorealistic image request is honestly redirected to a structured diagram rather than pretending a local image renderer exists. The server creates the specification from the resolved Manx request and a small public-evidence projection, MOMM reviews it, and only a fixed data-only schema can reach the browser.

Supported visual forms are bar, line, scatter, and node-edge diagrams. Arbitrary HTML, JavaScript, CSS, SVG, URLs, custom colours, non-finite numbers and oversized datasets are rejected. Factual visuals fail closed when no reviewer succeeds. Every accepted visual includes a derived text/data alternative, source and as-of information where factual, and a bounded PNG download. The browser independently validates the specification again before drawing it.

Map requests remain instant and free. The bundled Isle of Man SVG is a fixed local capability action, not a MOMM-reviewed canvas, and is clearly labelled diagrammatic and not for navigation. Its stable card offers allowlisted links to MANX Earth, Isle of Man Government maps, OpenStreetMap, Google Maps and Google Earth; asking about the existing map focuses that same card instead of drawing a duplicate. Oracle knows which action it emitted but truthfully says it cannot inspect the user's screen pixels.

## What a review leaves behind

Successful reviews are saved as conversation-owned artifacts in the local database, with the considered answer, public reviewer findings and sources. Reloading restores their controls without autoplay or another paid review. Completed canvases are saved in the same way. Historical results that were never saved before this repair cannot be reconstructed.

Reviewer agreement is not new source evidence. Synthesis cannot attach an existing citation to a different proposition or increase ledger support merely by being repeated. New propositions require a separate source-check expedition; the panel explains when nothing was added to the belief ledger. Productive completed research also offers a review of its own saved findings and unresolved limitations.

## Citations

A citation has to point at the page that carries the claim. A bare origin such as `https://www.gov.im` is a website, not a reference, so it is shown as context and plainly labelled "site homepage, not a page that carries this claim" rather than passed off as evidence. Checkable, official citations sort first, and credentials, query strings and fragments never survive into a stored source.

## Reaching the official Manx sources

The official Manx estate is awkward to read automatically, and pretending otherwise made the source check look permanently empty. Two things are true of it: search engines index gov.im thinly, so a plain query rarely surfaces a deep page; and the site sits behind a firewall that rejects many automated requests outright, `/media/` PDFs especially.

So the check works at it rather than asking once. It runs host-scoped searches against each allowed host, retries with different wording, fetches promising pages directly, prefers HTML over PDF, and never invents a URL it did not open.

It also distinguishes two outcomes that used to look identical. **This search did not find a usable official page** is reported as a limited search result, never proof that no page exists. **An official page exists but refused to be read** is reported as a blocked check, with the exact URLs and what the site did, listed under "Official pages that could not be read". That evidence is collected from the pages the pass actually tried, never asserted, and a blocked check never counts as an answer.

Allowed hosts are `gov.im`, `tynwald.org.im`, `judgments.im`, `iomfsa.im`, `manxnationalheritage.im`, `culturevannin.im` and `learnmanx.com`, together with genuine subdomains, so `legislation.gov.im` and `www.gov.im` both qualify.

**Reading a site that refuses the named reader (15 September 2026).** Several official hosts (`legislation.gov.im`, `iomfsa.im`, `courts.im`, `judgments.im`) answer anything that is not a browser with a "Request Rejected" page while serving the same public page to a browser, and `www.gov.im` refuses a machine outright after heavy traffic. The reader therefore identifies itself first, retries a refusal exactly once with an ordinary browser profile (the same public GET, origin spacing and size limits; nothing signed or hidden), and if the page is still refused, gone or unreachable it asks the Internet Archive for the latest snapshot (`web.archive.org/web/2id_/<url>`). An archived copy is never passed off as a live read: the excerpt, the tool receipt, the ledger source and the model prompt all carry the snapshot date and why the live page could not be read, and a source check confirmed from a snapshot records `via: "archive"`. The archive is never used for a private or unsupported link, and an archived refusal page is still a refusal. Switch off with `ORACLE_READER_BROWSER_UA=off` or `ORACLE_READER_ARCHIVE=off`.

## Seeding and corpus corrections

The ledger is seeded from the Atlas corpus (`app/knowledge/content.ts` and `app/manx/data.ts`) under a `SEED_VERSION`. **Bump that constant whenever the corpus changes a fact or a citation.** On the next start every ledger re-seeds: claims the corpus still carries have their citations replaced, not merged, so a corrected URL drops the dead one; claims the corpus no longer says are retired with `retiredBy` provenance rather than left standing as verified beside their replacement; and a refresh adds no support, because a re-seed is not fresh evidence. Learned, lateral and reviewed claims are never touched. A targeted editorial correction (see `seed-corrections.mjs`) still runs afterwards for cases that must preserve a claim's identity for historical references.

## The learning loop: provenance-gated belief

Every fact is a *claim* with sources, a support count, a contradiction count, a volatility class and a status that is **computed** by `deriveStatus`, never asserted:

| status | rule |
|---|---|
| verified | two **confirmed** routes, one of them a primary/official publisher: the cited pages were fetched by Oracle and found to carry the claim |
| corroborated | two or more distinct publishers cited (one government is one publisher, however many subdomains), not yet both confirmed |
| single_source | one publisher, however many of its pages are cited |
| hypothesis | no readable source: lateral thinking not yet checked, or every cited page has gone |
| contested | contradictions ≥ support |

A citation is an assertion until the page has been read. Every source carries the outcome of its last check (`confirmed`, `unmatched`, `blocked`, `missing`, `unreachable`, `unverifiable`); only a confirmed read adds a route and only a page that has gone (`missing`) removes one. Research findings have their citations read before they are stored, the server reads a bounded batch of the least recently checked citations on every start, and `npm run oracle:verify-sources -- --all` reads everything. Reviewer agreement never adds support, a caller cannot declare a source primary, and a claim without a readable source is a hypothesis whatever produced it. Since 15 September 2026 every ledger re-derives its statuses once under these rules on open (`status_rules_version`), retiring claims that only ever rested on reviewer agreement and purging expired live excerpts.

A full **Go deeper** expedition runs four routes and only then ingests. The faster **Check official Manx sources** action runs the first route alone and returns immediately after it:

- **Research** — Claude with live web search, structured findings with the URLs it actually saw.
- **Adversarial twin** — for every finding, the strongest counter-claim is stated and *searched for*. If the counter-claim finds support, the claim enters as contested, not as fact.
- **Cross-model** — momm puts the numbered findings in front of the other installed models as a read-only fact-check brief. Their output is untrusted evidence: only who agreed or disagreed with which claim is counted.
- **Lateral** — three randomly chosen operators (reversal, random entry, provocation, negative space, scale shift, analogy transplant, what-would-have-to-be-true, contrarian expert, follow the ledger, time traveller) generate hypotheses aimed at what the standard sources omit. Each hypothesis is then verified by the same research route; only supported, sourced ones can enter as `lateral` claims. Unsupported hypotheses remain ephemeral and are neither published nor stored as facts.

Three further mechanisms keep the ledger honest over time:

- **Decay.** Trust halves every 30 days for live facts, 180 for periodic ones (office-holders, rates), 4 years for structural ones. Stale claims sink in retrieval and are the first candidates for re-verification.
- **Attention ledger.** Your thumbs up/down on an answer is applied to every claim that answer used, nudging future retrieval toward what actually helped.
- **Hybrid retrieval that follows the ledger.** Every answer focuses the ledger with keyword search (SQLite FTS5, BM25) fused with a local semantic index (sqlite-vec, pinned on-device MiniLM embeddings), then the same trust and status weighting on top. A paraphrase such as "can I bring my dog" reaches the claim about pets and animal health rules that shares no word with it. The index is derived from the ledger and follows it automatically: every claim write schedules an incremental re-embed, startup catches up on anything written while no model was loaded, and retracted or contested claims are deactivated so a stale vector can never bring them back. `/api/health` reports `retrieval.ledger` (indexable, indexed, missing, stale) and `retrieval.sync`; the Focus panel says which retrieval actually served each answer ("semantic + keyword", or "keyword only" with the reason), and each episode records it. Similarity is a relevance signal only. Status is still derived from evidence, and the entailment gate stays lexical, so semantic recall can find more evidence but never loosens what counts as verified. Without the local model, retrieval is keyword-only and says so.
- **Calibration.** Stated confidence is bucketed and compared with your feedback. Once a bucket has five samples, spoken confidence is blended with the empirical hit rate, and the Brain panel shows the expected calibration error. An engine that says "ninety per cent" and is right half the time will start saying "about seventy".
- **Scoped conversation memory.** Historical dialogue can include earlier foreign comparisons, clearly labelled as past conversation rather than verified Manx evidence. The current turn's jurisdiction still controls knowledge-base retrieval; conversational continuity does not change the home jurisdiction.

**Dream** (the button, or `npm run oracle:dream`) stays inside the Manx ledger. It picks an Isle of Man gap first, then the weakest Manx claim for re-verification, then a random settled Manx topic for lateral exploration.

### Building the ledger by talking to it

The aim is the largest collection of reliable, sourced Manx knowledge ever collated, and you direct its growth in conversation. Nothing enters the ledger by being said: every route below ends in the same provenance-gated pipeline, so a claim's status is still derived from its evidence.

| Say | What happens | Cost |
|---|---|---|
| "How big is your knowledge base?", "Where are the gaps?" | Mannin speaks the ledger's size, status mix, official sourcing, growth this week, open gaps and semantic-index coverage, from the tables. | none |
| "How well do you know the TT races?", "What do you have on ferries?", "What's missing from the ledger on housing?" | A map of that subject: how many live claims, their statuses, how many cite official sources, the newest evidence, and any open gap that touches it. It ends by telling you what to say to build it out. | none |
| "Learn about the TT races", "Build out Manx housing", "Add ferry timetables to the ledger", "Teach yourself about Tynwald Day" | The full research pass on that subject, queued as an expedition: official Manx sources, the adversarial twin, a cross-model check and lateral leads. Only sourced findings are stored, each with its evidence; each stage is shown as it runs. "Learn more about that" binds to the last subject. | about $1 and a few minutes, within the hourly expedition cap |
| "Search for …", "Check official Manx sources for …" | A single-source check on one point, as before. | pence to tens of pence |
| "Think harder with MOMM" | Peer review of the last answer; corroborated findings are stored. | a MOMM slot |

A spoken instruction heard with low confidence is read back for confirmation before anything is spent. "What do you know about X" remains an ordinary question answered from the ledger, so asking about a subject never turns into an instruction to research it. The Brain panel shows Manx claims, topics, claims added this week, official sourcing and index coverage, so the build-out is visible as it happens.

Failed, interrupted, empty or incomplete research is remembered rather than immediately bought again. Automatic retries wait 15 minutes, then 30 minutes, one hour and progressively longer (up to 24 hours), and stop after five attempts until a person explicitly asks to try again. Merely sitting in the queue does not count as an attempt; the lease and attempt counter begin only when research actually starts. A successful answer resolves the gap atomically.

## Configuration

| variable | default | meaning |
|---|---|---|
| `ORACLE_PORT` / `ORACLE_HOST` | 4242 / 127.0.0.1 | bind address |
| `ORACLE_MODEL` | sonnet | model alias for answers |
| `ORACLE_RESEARCH_MODEL` | sonnet | model alias for expeditions |
| `ORACLE_EXPEDITIONS` | auto | `off` to never launch background research |
| `ORACLE_MAX_EXPEDITIONS_PER_HOUR` | 6 | cost guard |
| `ORACLE_MOMM` / `ORACLE_LATERAL` | on | disable a route |
| `ORACLE_DB` | oracle/data/oracle.db | ledger location (gitignored) |
| `ORACLE_MOMM_SCRIPT` | auto-detected | path to momm's `multi-review.mjs` |
| `ORACLE_MOMM_TIMEOUT_MS` | 240000 | per-reviewer deadline passed to momm (codex often needs 3–4 minutes on a 12-claim brief) |
| `ORACLE_MOMM_HOURLY_LIMIT` | 6 | shared sliding-hour allowance for answer reviews and canvases |
| `ORACLE_MAX_IN_FLIGHT` | 4 | concurrent questions before the server returns 429 |
| `ORACLE_KEEP_BRIEFS` | 20 | reviewer briefs retained under `.ensemble_reviews/oracle/` |
| `ORACLE_CLAUDE_BIN` | auto-detected | full path to the Claude executable, if it is not on `PATH` |

## Spending guards

Answering is cheap, around a penny. Researching and multi-model review are not. Speech recognition transcribes the room as readily as it transcribes you, so **an expedition is only launched after explicit consent for something that is actually a question**. Two gates must both agree:

- A local check: at least twelve characters, three words and two content words, and either a question mark or an interrogative word. Pressing "go deeper" waives the question-mark rule, because a deliberate button press on a bare topic is intent.
- The model's own `researchable` verdict, which vetoes fragments, greetings and stray conversation the local check would let through.

A question that fails either gate is handled locally: Oracle asks for a short confirmation while keeping the Manx context. It makes no model call, spends nothing and never becomes a gap for the curiosity loop to chase. Unresearchable gaps recorded before this rule existed are retired at startup. On top of that sit the hourly expedition cap and the in-flight limit.

The browser assigns every turn a unique request id and a conversation number that survives a page reload. SQLite durably records accepted request ids and rejects replay before model work. The server continues counting a replaced process until it has actually stopped.

## Saved conversations and efficient context

Use the conversation selector to reopen a chat, **New conversation** for an independent thread, and **Load earlier messages** to page through its full saved transcript. Accepted user turns, local clarifications, map actions, completed answers and interruption state live in the local SQLite database. Existing model-answer history is migrated without deleting the original episodes; previously unrecorded local turns cannot be reconstructed. Older completed research remains linked to its original request where the link was recorded. Switching chats stops the old chat's active work but keeps its history and topic.

The in-memory dialogue cache is backed by SQLite, so topic state and the question Mani was asking survive cache eviction and server restart. Answer text is checkpointed at most once per second while streaming, then saved in full at completion. A hard crash may lose the final sub-second fragment; recovery labels the saved partial answer interrupted. A single-process database lease prevents another server from treating live work as crashed work.

Prompts use a bounded extractive projection: the unresolved question, recent exchanges retaining both beginnings and endings, and older relevant dialogue or research. SQLite FTS5 ranks lexical matches with BM25, and normalized hashed term vectors rerank dialogue by cosine similarity. These are **lexical vectors, not semantic embeddings**; synonym-only recall is not guaranteed. No embedding service, summarization model call or additional dependency is required. Stored dialogue is never promoted into factual evidence merely because it was recalled.

The working-memory allowance is at most 3,600 estimated tokens; system instructions, scoped evidence, the original utterance and resolved request share an 8,500-estimated-token input ceiling. The UTF-8 byte-based estimator is conservative but is not the model's tokenizer or billed token count. Provider-managed caching is not claimed as measured savings. Stable instructions remain separate from changing context.

Conversation history and research stay on this computer in `ORACLE_DB`; selected excerpts are sent to the existing answer-model CLI when needed. History is local convenience storage, not encrypted storage or a multi-user access-control boundary. Keep the default loopback binding and exclude the database and private review logs from publication.

Design references: [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [SQLite FTS5](https://www.sqlite.org/fts5.html), [token-count estimates](https://platform.claude.com/docs/en/build-with-claude/token-counting), and [Web Speech events](https://webaudio.github.io/web-speech-api/#speechsynthesisevent).

This was not theoretical. In a live session on 2 September 2026, four mis-heard fragments ("What is the capital?", "Oracle M8 against.", "I have.", "I have been.") launched four expeditions and cost $4.01. Every one of those transcripts is now a test case.

## Safety properties

The server binds to loopback and sends no CORS headers, but a page on another origin could still *drive* it blind, and every request spends real credits. So state-changing routes refuse a cross-origin `Origin` header and require `application/json`, which together defeat the CORS-safelisted `text/plain` form post. Static paths are resolved inside `public/` and compared against the directory separator, so a sibling sharing the prefix cannot pass.

Claim text, topics and reviewer findings are written by models and by the open web. The client never interpolates any of it into HTML: everything arrives as a text node, and status values are checked against a fixed list before becoming a CSS class. Reviewer output is untrusted data, never executed. Only bounded verdict, summary, rationale and correction fields reach the interface; hidden reasoning is discarded.

Evidence is idempotent. Each contribution carries a key derived from its source URLs and counts, so re-researching a topic cannot promote a claim on its own repetition. An adversarial pass that finds nothing is not a second source, a reviewer agreeing at near-zero confidence is not agreement, and one answer is one calibration sample however many times it is voted on.

Costs: a local repair, clarification or map is free. A model answer is roughly a cent; MOMM review/canvas and a full expedition use the signed-in model CLIs and can take several minutes. The shared MOMM allowance and expedition cap bound repeat spend. Evidence details remain available in the collapsed Diagnostics panel.

## Voice

The client lists every installed voice with British male ones first (Edge's *Ryan* and *Thomas* natural voices, Chrome's *Google UK English Male*, macOS *Daniel*). Choose in the header; the choice is remembered. Speech starts on the first complete sentence. While Oracle is busy the microphone visibly says **Interrupt and speak**; clicking it or pressing Space outside an editable control stops the old voice/answer and starts listening. Escape or Stop cancels without reopening the microphone. Automatic microphone reopening is off by default. Completed-research speech is on by default with a remembered opt-out, so Oracle does not unexpectedly reopen the microphone or talk over the user. “New conversation” cancels owned work, clears the temporary dialogue context and restores the Isle of Man home scope.

## Files

```
oracle/server.mjs        HTTP + SSE server, static UI, API
oracle/lib/dialogue.mjs  Manx-first dialogue state, bounded speech repair, local actions
oracle/lib/scope.mjs     one shared definition of Isle of Man scope and aliases
oracle/lib/kb.mjs        SQLite belief ledger, trust, focus, calibration
oracle/lib/brain.mjs     answer pipeline
oracle/lib/deliberate.mjs bounded MOMM answer review and shared allowance
oracle/lib/answer-evidence.mjs deterministic evidence boundary for revised answers
oracle/lib/external-policy.mjs public-only external review projection
oracle/lib/visual.mjs    closed visual schema, review, repair and validation
oracle/lib/learning.mjs  expeditions: research, adversarial, cross-model, lateral, ingest gate
oracle/lib/lateral.mjs   lateral-thinking operators and prompt
oracle/lib/momm.mjs      momm dispatcher bridge and report interpretation
oracle/lib/claude.mjs    headless Claude CLI wrapper (OAuth, streaming, JSON schema)
oracle/lib/segmenter.mjs sentence streaming and the meta guard
oracle/lib/seed.mjs      seeds the ledger from app/knowledge and app/manx
oracle/public/app.js     voice client and chronological conversation UI
oracle/public/speech.mjs browser speech confidence and bounded repair
oracle/public/policy.mjs safe external links, status validation and numeric UI fallbacks
oracle/public/manx-map.svg bundled instant Manx diagram; its card links to the hosted MANX Earth & Street View
oracle/tests/            unit tests (no model calls)
```

API: `POST /api/ask` (SSE), `POST /api/deliberate`, `POST /api/canvas`, `POST /api/session/reset`, `POST /api/feedback`, `POST /api/expedition`, `POST /api/expedition/cancel`, `POST /api/dream`, `GET /api/research?sessionId=`, `GET /api/brain`, `GET /api/claims?q=`, `GET /api/events?sessionId=` (session-scoped SSE), `GET /api/health`.

## The MOMM conversation

Pressing **Think harder with MOMM** now opens a conversation panel under the answer. Every reviewing model gets its own colour-coded lane: Codex blue, Copilot violet, Grok amber, Antigravity teal, Gemini rose, and Oracle green. The lanes animate live off the dispatcher's own events. A pulsing dot and shimmering "reading and thinking" label while a model works, an elapsed timer per lane, a retry note if a provider flaps, and a verdict badge that pops in the moment that model finishes, with its finding count. A progress bar across the top fills as reviewers complete.

The dispatcher delivers each model's words only in its final report, so when the report lands each lane fills in immediately in the order the models actually finished, including in background tabs: the verdict, its confidence, its summary, and the specific findings that model raised. Oracle's lane ends the conversation with what changed and the considered answer.

**Read the conversation** plays the whole exchange aloud with a different British voice per model. Natural voices are handed out first, your own chosen Oracle voice is reserved for Oracle, and if the machine has fewer voices than models the pitch shifts so no two ever sound alike. The lane currently speaking glows, the speaker's name and voice show beneath the controls, and Pause, Stop, Esc or simply speaking to the Oracle all halt playback without cancelling a review that is still running.

The header shows usage as it happens: which review this is out of the shared hourly allowance, how many reviewers have finished, elapsed time, and, once done, the synthesis cost and total duration. Everything respects `prefers-reduced-motion`: lanes appear instantly, badges do not pop, and text is revealed in one go.

---

◆ Oracle is part of the [42.uk](https://42.uk/) universe. Powered by [Promptus](https://42.uk/).

*RELAX. IT'S ALREADY OVER.*

## Island discovery explorer (10 September 2026)

The main navigation now connects Talk to Mani and Explore the island. Explore includes the complete 2,869-topic hierarchy, full-catalogue search, breadcrumbs, browser Back/Forward support, contextual related subjects and curated links to existing Manx research pages. Source-linked descriptions remain distinct from research outlines; a link alone does not establish support.

Bring question to Mani prepares an editable question in the current conversation. Browsing does not submit a request, switch conversations or cancel research. If a draft was already present, Restore my previous draft recovers it. Hosted explorer links open the local Mani app with a question in the URL fragment; they do not run the local answer engine in the cloud.

The canonical explorer assets are in `public/discovery/`. After editing them, run `node tools/sync-discovery.mjs` to refresh the static copy served by Mani. `node --test tests/discovery.test.mjs` verifies that both copies match, every topic is reachable, and curated routes exist.

## Trust review (15 September 2026)

The suite was green while use had gone wrong: since 11 September, 190 answers carried `model_prior` against 23 `single_source`, "do it", "dig deep" and "run it through MOMM" produced explanations that nothing ran, and no research had been queued for four days. Five independent code reviews plus the recorded turns found the causes in routing, accounting and state rather than in anything the tests exercised. Fixed the same day and pinned by `tests/trust-review-20260915.test.mjs` and `tests/research-accounting.test.mjs`:

- **Routing.** "Research X", "look into X" and "dig into X" research X, not the previous subject. Manx place names and "the Island" keep Manx scope; Jersey cows, bone china, an Iceland store and the Prince of Wales no longer switch it. Questions about Manx Utilities are answered as asked. Bare Manx subjects answer instead of refusing. A short new subject is not swallowed as the reply to Mannin's last question. Every spoken route into paid research is read back when recognition is doubtful or unmeasured. "What time is it?" is a clock read, not a paid answer.
- **Receipts and spend.** An expedition that fails after its first route records what it spent. Provider errors on the adversarial and lateral routes are reported as failures. A MOMM run in which no reviewer completed is not a review and leaves no run id in the ledger. The MOMM hourly cap survives a restart and refunds a review that never dispatched. The terminal dream runner honours the hourly cap. Findings from reviewers that did not run cannot contest claims.
- **Ledger.** Agreement between models never makes a claim verified. A research pass that re-finds a verified corpus sentence does not downgrade it. The verification date moves only with fresh evidence. Expired source excerpts leave search before the result limit, and a fresh live reading of the same page retires the previous one. A follow-up bound to earlier research uses its findings only while the ledger still stands behind them. The entailment gate sees a denial and no longer confuses Castletown with Castle Rushen.
- **Server and client.** The Host header is validated against the listening address, closing a DNS-rebinding route past the origin check. Opening another conversation stops what is being spoken, not the research, review or canvas that was paid for; only Stop cancels those. A canvas keeps generating and saves if the browser disconnects. A queued search that is cancelled says so. Escape inside a text field does not stop server work. Brain statistics are rendered as text. A server-reported failure ends the answer as a failure, not a dropped connection. "Use MOMM" after a clarification says there is no completed answer to review.
- **Atlas.** The discovery composer and the hand-off to Mannin share one 12,000-character limit, with the shared policy file in the sync and parity lists. The corpus review dates now say when the corpus was last corrected and the seed version was bumped so the ledger follows. An unknown jurisdiction on the answers API is an error, not the United Kingdom.

Still open: a research offer after a foreign-only answer can be stale on arrival; seed citations assert `primary` rather than deriving it; a canvas requested and not completed before a reload is not restorable; automated reading of gov.im is refused by its firewall, which is the real cause of most "live check failed" turns.
