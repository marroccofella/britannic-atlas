# Mannin conversation and public-source recovery audit

Updated 12 September 2026. Covers both supplied conversations: legislation/source access and religious diversity. Changes are local; nothing was committed or published. The original conversations were not sent to external reviewers or rewritten.

## What failed, why it failed, and what changed

| Observed failure | Reproduced cause | Implemented correction |
|---|---|---|
| Repeatedly asking the user to repeat an already explicit MOMM request | Narrow command patterns missed polite forms, “think harder with mom”, “So run mum”, and combined requests | Deterministic recognition of those forms; search and review are separately bound actions. Ambiguous recognition such as “Rum Pum” remains a clarification. |
| “Both” lost the subject or became a generic answer | A single pending-action model did not bind the two available actions to a completed answer | “Both” and “do both” bind to the current saved search offer and its fixed factual review target. A changed topic invalidates the offer. Merely saying “do it” does not authorize an additional paid review. |
| Follow-up requests lost new subquestions | Accepting a search offer could discard the words after “and” | Retry requests retain the original subject and the additional requested comparison or questions. |
| A discussion of misheard words was reviewed as an Isle of Man factual answer | Self-assessment was not classified as conversation, and review eligibility accepted the resulting episode | Shared conversation-repair classification keeps these answers local, preserves the factual topic, and rejects old misclassified episodes for new external review. |
| A failed check hid the factual answer the user wanted reviewed | Review targeting inspected only the latest turn | It can look back through same-subject failures and recognised conversation repairs; it stops at a new substantive topic. |
| A requested review silently disappeared when the user spoke again | The browser started paid work only after the response stream and could abort or supersede that handoff | The server owns and deduplicates review jobs. The browser observes saved status. Normal conversation can interrupt observation without cancelling the job; explicit Stop/Escape requests server cancellation. |
| “Review complete” appeared with only one successful reviewer | The application checked for any success after asking for two | The requested quorum is enforced before synthesis. Available findings remain visible, but an insufficient coalition cannot produce a completed combined answer. |
| Review/search history asserted actions without execution evidence | Future context retained assistant prose while dropping operation diagnostics | Bounded dated tool diagnostics and durable review receipts take precedence over claims in old prose. Acceptance, actual dispatch, failure, interruption and completion are distinct. No-report failures are saved. |
| Valid government/parliamentary pages were reported as blocked | The local URL filter rejected required public download/presentation parameters | Narrow publisher-specific validation preserves Tynwald `file`, legislation `download`, and observed gov.im presentation parameters. Credentials, signed URLs, private addresses, unsafe redirects and rate limits remain protected. |
| Readable official evidence was missed deep in a PDF | Selection favoured page prefixes; later evidence could also be crowded out by the first document | Relevant verbatim passages are selected across extracted pages, with page citations. Evidence from different documents is interleaved within the answer budget. |
| Browser challenges or unrelated search results became apparent evidence | Incomplete challenge recognition and no relevance check before accepting discovered text | Known challenge pages are failures. Readable but unrelated discovered pages are excluded and leave recovery available. Explicitly selected public pages can still be read as requested. |
| A later timeout erased an earlier successful source | One aggregate abort rejected the entire lookup | An internal deadline retains completed evidence and records the unfinished stage. Explicit user cancellation still stops the answer. |
| A blind user was told to navigate a blocked page and paste it back | Recovery consisted mainly of a browser link | The app tries bounded alternative public sources in the conversation, including readable official document copies. Failure details without URLs remain visible and labelled for assistive technology; “search again” is actionable. Browser links are optional. |
| Town weather was silently treated as an airport observation | All Island temperature requests selected Ronaldsway | Named-town and elsewhere-on-the-Island requests use public-source search. Airport observations retain their location and observation-time qualification. |

## Corrected legislation evidence

The Foundations measure was no longer merely a proposal at the time of these conversations:

- **24 March 2026:** Legislative Council Final Stage passed. [Official Hansard, PDF page 18](https://tynwald.org.im/index.php/spfile?file=%2Fbusiness%2Fhansard%2F20202040%2Fc260324.pdf#page=18).
- **19 May 2026:** Royal Assent was given to the **Foundations (Amendment) Act 2026**. [Official Hansard, PDF page 82](https://tynwald.org.im/index.php/spfile?file=%2Fbusiness%2Fhansard%2F20202040%2Ft260519.pdf#page=82); corroborated by [Votes and Proceedings, page 7](https://tynwald.org.im/index.php/spfile?file=%2Fbusiness%2Fvp%2FVP%2F2026-PP-0094.pdf#page=7).
- **Commencement and operational readiness remain separate questions.** March Hansard describes appointed-day commencement; June implementation consultation material does not establish that every provision or the register was operational by September. [Consultation feedback](https://consult.gov.im/economic-development/data-asset-register-registrar-consutation/).

Mannin's actual public reader successfully retrieved the relevant parliamentary PDFs and June consultation response document during verification. The catalogue contains discovery pointers; answers must read their contents, rather than treating a stored pointer as proof.

## Corrected religion evidence

The government original refused automated reading, but an **official Tynwald copy** of the census was successfully downloaded and read by Mannin: [2021 Census Part I, GD 2022/0014](https://tynwald.org.im/spfile?file=%2Fbusiness%2Fopqp%2Fsittings%2F20212026%2F2022-GD-0014.pdf).

The religion question was voluntary. **74,487 respondents answered it, out of 84,069 residents.** The transcript mixed the respondent denominator with the whole population. The source is *Part I*; the suggested “Report Two: Ethnic Group, National Identity, Language and Religion” title was not the correct source.

| Affiliation | Respondents | Published percentage of respondents | Percentage of all residents, calculated |
|---|---:|---:|---:|
| Christianity | 40,725 | 54.7% | 48.4% |
| No religion | 32,603 | 43.8% | 38.8% |
| Islam | 393 | 0.5% | 0.5% |
| Buddhism | 390 | 0.5% | 0.5% |
| Hinduism | 263 | 0.4% | 0.3% |
| Judaism | 113 | 0.2% | 0.1% |

Published narrative and denominator: [PDF page 14](https://tynwald.org.im/spfile?file=%2Fbusiness%2Fopqp%2Fsittings%2F20212026%2F2022-GD-0014.pdf#page=14). Exact counts and voluntary-question footnote: [Table 2.12, PDF page 28](https://tynwald.org.im/spfile?file=%2Fbusiness%2Fopqp%2Fsittings%2F20212026%2F2022-GD-0014.pdf#page=28). Rounded percentages need not sum to exactly 100%.

There is no separate Catholic or Sikh row. That cannot establish a zero Sikh population or a Catholic percentage. Affiliation counts also cannot establish how many places of worship operate.

Some of the previously unanswered premises and history questions do have usable sources:

| Requested topic | Supported answer and qualification |
|---|---|
| Catholic churches | The community's own directory states **six Roman Catholic churches**, in Douglas, Onchan, Peel, Ramsey, Castletown and Port Erin. [Manx Catholic](https://manxcatholic.org/contact/). |
| Anglican churches | The diocesan **2023** statement gives **12 ecclesiastical parishes and 38 churches/chapels**. This is a dated organisational figure, not a fresh 2026 building survey. [Statement of Needs, page 5](https://www.sodorandman.im/wp-content/uploads/Statement-of-Needs-V2.1-2023.pdf#page=5). |
| Methodist communities | The current directory contains **28 unique chapel/community entries**. Entries are not independently verified active-building counts. [Directory](https://www.methodist.org.im/chapels-communities.html). |
| Mosques | The Islamic Association lists a first mosque and a new mosque address. This does not prove that two premises are simultaneously active. [Association contact page](https://iaiom.com/contact/). |
| Hindu community | A readable community site exists; a complete current premises count was not established. [Isle of Man Hindu Temple](https://isleofmanhindutemple.org/). |
| Jewish and Sikh premises | A reliable comprehensive current premises count was not established in this check. This remains an explicit gap. |
| Historical religious disadvantage | Manx National Heritage records that Catholics and non-conformists were required to marry in parish churches until 1849. [Family-history guide](https://manxnationalheritage.im/wp-content/uploads/2018/02/Family-History-Sheet-Library-and-Archive-Service-Digital.pdf). |
| Wartime experience | MNH documents Jewish Austrian Jussin Brainin's 1940 internment at Mooragh. This is a specific historical experience, not proof of equivalence to Northern Ireland's conflict. [WWII archive guide, page 56](https://manxnationalheritage.im/wp-content/uploads/2025/07/LibraryResources-WW2-Internment.pdf#page=56). |

Anglicanism and Methodism also differ in organisation and tradition; describing this as merely worship style or implying identical beliefs is too broad. A comparison should distinguish the Anglican diocese and episcopal structure from Methodist circuits/conference, and qualify differences between traditions rather than flattening them.

## Verification and practical limits

- **565 local application tests passed; one existing test skipped.** This includes regressions derived from both conversations and privacy/cancellation failures found during internal review.
- **46 shared web-app tests passed.** Build, ESLint and TypeScript checks passed.
- The actual public reader retrieved the Royal Assent records and census table, including 74,487 respondents, 40,725 Christians and 32,603 reporting no religion. No model or private conversation was needed for these document checks.
- Headless browser checks used synthetic conversation responses and mocked all private/model APIs. Diagnostics without links were visible, review observation made no paid dispatch request, explicit Stop requested server cancellation, and layouts fit 390px and 1280px widths without page errors. This is not a full assistive-technology certification or a real microphone/acoustic recognition test.
- Public HTML/text and text-based PDFs are supported. Login-only material, unresolved challenges, rate limits, image-only PDFs and documents beyond resource limits may still be unavailable. The app must name those limits and unresolved facts; it cannot guarantee every website is readable.
- Automatic alternative discovery is bounded and uses the configured search allowance. A readable alternate source is cited under its own URL. Search snippets, reviewer agreement and a successful HTTP response alone are not factual verification.

## External peer review

The full scoped review, `rev_20260912190124_1grm`, did not meet its two-reviewer quorum: Claude timed out, Antigravity returned invalid output, and Grok returned a zero-confidence MODIFY with no findings or suggestions. Its message described reading the artifact rather than providing a substantive assessment. There was no agreement score or risk heatmap. This is **incomplete external review**, not approval. The smaller complete-module follow-up, rev_20260912190616_0x3z, also did not meet quorum: all three routes timed out, with no findings or suggestions. No source-code change was accepted on external reviewer authority.

The private MOMM ledger is `.ensemble_reviews/ledger.html` and remains gitignored. Neither attached transcript was included in either review payload.


| Reviewer / gate | Suggestion or outstanding work | Disposition | Reason / verification |
|---|---|---|---|
| External reviewers | No actionable suggestions returned | Nothing to triage | No findings; timeouts, invalid output and a zero-confidence non-assessment |
| Governor review gate | Complete substantive independent assessment | Deferred | Both external attempts failed quorum; local regressions, browser checks and actual public-source reads passed |
