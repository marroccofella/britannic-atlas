# Mani health and release investigation — 13 September 2026

## Conclusion

Mani's current local build passes the tested checks, but it is not a general release. Local HEAD `792ac80f` (11 September) already contains committed September work, with additional uncommitted and untracked changes beyond HEAD. The hosted version remains at commit `4abccf10` (23 August). The hosted Britannic Atlas is an older, owner-private publication. This investigation does not establish that every voice, accessibility, source-reading or model-answer scenario works.

The directly executed MOMM dispatcher is **1.15.1**, report schema `momm-report/1`, under Node 22.16.0. Its installed protocol was read afresh. The previous Mani full-testing review recorded **1.14.1**. The updated protocol requires a separate governor completion validator with file hashes and per-item decisions; dispatch success alone is not completion. No MOMM installation or update was performed here.

## Current local evidence

| Check | Observed result |
|---|---|
| Complete local gate | 624 Oracle tests and 46 website tests passed: 670 total, no failures, skips, cancellations or unfinished TODO tests. Lint, TypeScript, build, PDF runtime, cached offline embeddings, source stability and browser checks passed. |
| Reproduce the local gate | From the repository root, using Node 22.16.0: `node --experimental-strip-types --disable-warning=ExperimentalWarning oracle/tools/verify-mani.mjs`. The browser journey scope is listed below; this requires the installed dependencies, local PDF runtime, cached embeddings and Chromium. |
| Latest report | [Full verification](../work/mani-verification-2026-09-13T13-16-41-612Z/report.json). |
| Browser scope | Isolated Chromium journeys for fresh history, a free knowledge-map answer, low-confidence speech handling, evidence disclosure, keyboard controls, 390/1280px layouts, page lifecycle, saved-history reload, explorer drill-down and Back/Forward, and question preparation/draft restoration without dispatch. |
| Current runtime | Local port 4242, flow version `2026-09-13-full-verification`; health OK with no active answers or tool work at inspection. |
| Evidence index | 223 of 223 eligible ledger claims indexed, zero missing, zero stale; query mode hybrid; 31 official-document entries. These are index counts, not proof of claim truth or completeness of Government coverage. |
| Source continuity | The 15 named files in the verification source manifest matched the fingerprint from the previous completed turn. This comparison does not cover every repository file. |
| Real answer-provider probe | An isolated answer pipeline, using an in-memory database seeded from the project's public catalogue, received “The capital of the Isle of Man is Douglas.” from the configured Claude route. This does not establish that catalogue grounding produced the answer. The real configured Claude route completed; reported cost was USD 0.0236102 and evidence status remained `model_prior`. No user conversation or production database was used. |
| Probe evidence | [Live probe](../work/mani-release-live-probe.json). One successful example establishes reachability at that time, not general factual accuracy or service reliability. The probe submits one question, sets a 60-second timeout per model invocation, and adds no retry loop. The probe has no overall answer-pipeline deadline; only its individual model invocations are time-limited. This does not establish an end-to-end latency guarantee for Mani. |

## Published release evidence

The Sites connector title is “Britannic Atlas — The British World, Properly Mapped”; its existing origin deliberately remains `britannica-atlas`, a distinct stored hostname spelling. The connector reports it as active at `https://britannica-atlas.marroccofella.chatgpt.site`. Its latest saved version is **12**. The associated production deployment reports **succeeded**, last updated **23 August 2026 at 17:34:31 UTC**. It identifies source commit `4abccf10c77c7dfe35d5e1e174867747c248d613`.

Access is `custom`, with the current user as owner, exactly one allowed account user, no allowed workspace or tenant groups, and zero external visitors. The sole allowed account is listed with role `owner` in the connector response. An unauthenticated HTTP request to the hosted origin returns 401. That is consistent with the private access policy; authenticated hosted-page functionality was not tested here.

The deployed commit is present locally. Its message is “Add MANX Isle of Man intelligence layer”; listing its `oracle/` tree returns no files. Local HEAD is a later commit, `792ac80fba54aaeac4b15976b704f36038b6e2b6`, dated 11 September, and current Mani modules and tests include additional uncommitted/untracked changes. The specific runtime paths checked were `oracle/server.mjs`, `oracle/lib/brain.mjs` and `oracle/public/app.js`. All three are absent from the deployed commit and marked added in the deployed-commit-to-HEAD comparison, and exist in the current checkout. The full `oracle/` comparison reports 92 files added with 82,014 inserted lines. This identifies the current runtime implementation rather than assuming every related Atlas asset lives under one directory. The hosted version therefore does not contain this local Mani runtime or its September fixes.

At the review-time status snapshot, the working tree had 130 changed/untracked entries (70 tracked entries and 60 untracked files). These include existing chat, reader, discovery and verification work as well as local audit documents; this investigation does not claim authorship of those earlier changes. The runtime entry point, answer logic and browser application remain modified beyond HEAD.

The local application defaults to loopback and uses Node SQLite and account-authenticated model CLIs. Publishing the separate Atlas website would not by itself turn that local runtime into a hosted general-release service. The project's README still classifies Mani as a supervised internal alpha.

## MOMM scope and readiness

The app's default script resolver points to the same installed 1.15.1 dispatcher used by this investigation. This resolver observation does not prove the environment of every independently launched process; app health reports dispatcher presence, not version or provider readiness.

Preflight found Claude 2.1.270, Antigravity 1.2.2, Grok 1.0.30 and Copilot 1.0.83 installed with account-session evidence. Preflight made no model calls and does not establish live reviewer success or available quota.

The proposed MOMM payload is this project-local report, to challenge the investigation's conclusions and evidence limits. It excludes application source, user transcripts, conversations, credentials, databases and review logs. That would be a review of this status report, not a new full code audit of every Mani source file.

The user approved sending the completed investigation report, including its test counts, internal runtime/release metadata and repository revision IDs, to Claude, Antigravity, Grok and Copilot. This was scope-based consent; no approval-time content hash was captured, and no retrospective byte-pinned approval is claimed. The first dispatch and the bounded retry each record their actual input SHA-256 in the private MOMM report and ledger. The retry included a clarification of the existing probe timeout within the approved scope. The site hostname contains an account identifier, which was included as part of the approved release metadata; credentials and private conversations were excluded. Review outcomes and governor completion evidence are recorded separately; this report does not pre-empt them.

## Remaining acceptance limits

- Physical microphone recognition, installed voice playback and screen-reader output need real-device acceptance; simulated speech and keyboard checks do not certify them.
- The real model probe was one public question, not a broad accuracy benchmark, and was not labelled source-verified.
- Live reading of the whole public web was not tested. The index records two blocked crawl entries and an older Government robots-access failure. These are historical records, not proof that the same pages remain blocked now.
- Only unauthenticated hosted access and Sites deployment/access metadata were checked; the private site's authenticated journeys were not exercised.
- No commit, push, application-source upload, deployment, audience change, credential change or skill update was performed. The prior local-only preference remains in force.

**Decision:** working within the verified local scope; not generally released. Real-device and external-service acceptance, a supported distribution/deployment approach, and an explicit audience decision remain before general availability can be claimed.
