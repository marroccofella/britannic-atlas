// Reading the official Manx estate and the Internet Archive fallback.
//
// Four official hosts serve a "Request Rejected" page to anything that does
// not look like a browser while serving the real page to a browser; gov.im
// itself refuses this machine after heavy traffic. The reader therefore
// retries once with an ordinary browser profile, then falls back to the
// Internet Archive's latest snapshot, and everything downstream is told which.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicReader, archiveLookupUrl, archiveSnapshot, READER_PROFILES } from "../lib/public-reader.mjs";
import { verifySource } from "../lib/source-verification.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";
import { runLiveTools } from "../lib/live-tools.mjs";
import { renderFocus } from "../lib/brain.mjs";

const noWait = async () => {};
const html = (body) => `<html><head><title>Court Structure</title></head><body><main><h1>Court Structure</h1><p>${body}</p></main></body></html>`;
const page = (body, extra = {}) => ({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(html(body)), ...extra });
const rejected = () => ({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from("<html><head><title>Request Rejected</title></head><body>The requested URL was rejected. Please consult with your administrator.</body></html>") });
const forbidden = () => ({ status: 403, headers: { "content-type": "text/html" }, body: Buffer.from("<html><body>Forbidden</body></html>") });
const LIVE = "https://www.courts.im/court-information/court-structure/";
const CAPTURE = "https://web.archive.org/web/20260806140105id_/" + LIVE;

test("a host that rejects the named reader but serves a browser is read with the browser profile, once, and says so", async () => {
  const calls = [];
  const get = async (url, { profile }) => { calls.push([url, profile]); return profile === "browser" ? page("The High Court of Justice sits in Douglas.") : rejected(); };
  const read = createPublicReader({ get, wait: noWait });
  const r = await read(LIVE);
  assert.equal(r.profile, "browser");
  assert.equal(r.url, LIVE);
  assert.match(String(r.body), /High Court of Justice/);
  assert.deepEqual(calls, [[LIVE, "reader"], [LIVE, "browser"]]);
  assert.match(READER_PROFILES.browser["User-Agent"], /^Mozilla\/5\.0/);
  assert.equal(READER_PROFILES.reader["User-Agent"], "ManninPublicReader/1.1");
});

test("when both profiles are refused, the Internet Archive's latest snapshot stands in and is disclosed as such", async () => {
  const calls = [];
  const get = async (url, { profile }) => {
    calls.push([url, profile]);
    if (url === LIVE) return forbidden();
    if (url === archiveLookupUrl(LIVE)) return { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") };
    if (url === CAPTURE) return page("The High Court of Justice sits in Douglas.");
    throw new Error("unexpected " + url);
  };
  const read = createPublicReader({ get, wait: noWait });
  const r = await read(LIVE);
  assert.equal(r.url, LIVE, "the source remains the live URL");
  assert.deepEqual(r.archived, { snapshotAt: "2026-08-06T14:01:05.000Z", archiveUrl: CAPTURE, liveOutcome: "site_blocked" });
  assert.match(String(r.body), /High Court of Justice/);
  assert.deepEqual(calls.map(([, p]) => p), ["reader", "browser", "browser", "browser"], "one browser retry on the live page, then the archive lookup and its capture");
  assert.deepEqual(archiveSnapshot("https://web.archive.org/web/20250101000000/https://www.gov.im/"), { snapshotAt: "2025-01-01T00:00:00.000Z", original: "https://www.gov.im/" });
  assert.equal(archiveSnapshot("https://www.gov.im/"), null);
});

test("a page that is gone is read from the archive; with no capture the original failure is reported with the archive outcome attached", async () => {
  const gone = async (url) => { if (url === LIVE) return { status: 404, headers: {}, body: Buffer.from("") }; if (url === archiveLookupUrl(LIVE)) return { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") }; return page("The High Court of Justice sits in Douglas."); };
  const r = await createPublicReader({ get: gone, wait: noWait })(LIVE);
  assert.equal(r.archived.liveOutcome, "http_error");
  const none = async (url) => (url === LIVE ? forbidden() : { status: 404, headers: {}, body: Buffer.from("") });
  await assert.rejects(createPublicReader({ get: none, wait: noWait })(LIVE), (error) => error.code === "site_blocked" && error.archive === "http_error");
});

test("the archive fallback can be switched off, is never used for a private link, and an archived refusal page is still a refusal", async () => {
  const get = async (url) => (url === LIVE ? forbidden() : { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") });
  await assert.rejects(createPublicReader({ get, wait: noWait, archiveFallback: false })(LIVE), (error) => error.code === "site_blocked" && !error.archive);
  await assert.rejects(createPublicReader({ get, wait: noWait })("https://www.gov.im/?token=private"), (error) => error.code === "url_not_public");
  const archivedRefusal = async (url) => (url === LIVE ? forbidden() : url === archiveLookupUrl(LIVE) ? { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") } : rejected());
  await assert.rejects(createPublicReader({ get: archivedRefusal, wait: noWait })(LIVE), (error) => error.code === "site_blocked" && error.archive === "site_blocked");
  await assert.rejects(createPublicReader({ get, wait: noWait, browserFallback: false, archiveFallback: false })(LIVE), (error) => error.code === "site_blocked");
});

test("verification records how the page was obtained, and the ledger keeps it", async () => {
  const text = "The High Court of Justice sits in Douglas.";
  const archivedRead = async () => ({ url: LIVE, status: 200, headers: { "content-type": "text/html" }, body: html(text), archived: { snapshotAt: "2026-08-06T14:01:05.000Z", archiveUrl: CAPTURE, liveOutcome: "site_blocked" } });
  const v = await verifySource({ text, url: LIVE, read: archivedRead });
  assert.equal(v.status, "confirmed"); assert.equal(v.via, "archive"); assert.equal(v.snapshotAt, "2026-08-06T14:01:05.000Z"); assert.equal(v.liveOutcome, "site_blocked");
  const browserRead = async () => ({ url: LIVE, status: 200, headers: { "content-type": "text/html" }, body: html(text), profile: "browser" });
  assert.equal((await verifySource({ text, url: LIVE, read: browserRead })).via, "browser");
  const blocked = async () => { throw Object.assign(new Error("This website refused automated reading (HTTP 403)."), { code: "site_blocked", archive: "http_error" }); };
  const b = await verifySource({ text, url: LIVE, read: blocked });
  assert.equal(b.status, "blocked"); assert.match(b.detail, /archive: http_error/);
  const kb = new KnowledgeBase(":memory:");
  const { claim } = kb.upsertClaim({ text, topic: "courts", jurisdiction: "IM", sources: [{ url: LIVE }] });
  const stored = kb.recordSourceVerification(claim.id, LIVE, v).sources[0].verification;
  assert.equal(stored.via, "archive"); assert.equal(stored.snapshotAt, "2026-08-06T14:01:05.000Z"); assert.equal(stored.liveOutcome, "site_blocked");
  kb.close();
});

test("a live read that came from the archive is disclosed on the excerpt, in the tool receipt, in the ledger and in the prompt", async () => {
  const get = async () => ({ url: LIVE, status: 200, headers: { "content-type": "text/html" }, body: html("The High Court of Justice sits in Douglas and hears civil and criminal matters."), archived: { snapshotAt: "2026-08-06T14:01:05.000Z", archiveUrl: CAPTURE, liveOutcome: "site_blocked" } });
  const r = await runLiveTools({ question: "Read " + LIVE, request: { name: "read_page", url: LIVE }, get, useCache: false, allowRecovery: false });
  assert.equal(r.claims.length, 1);
  assert.equal(r.claims[0].sources[0].archived.snapshotAt, "2026-08-06T14:01:05.000Z");
  assert.match(r.calls[0].notice, /Internet Archive snapshot dated 2026-08-06/);
  const kb = new KnowledgeBase(":memory:");
  const { claim } = kb.upsertClaim({ text: r.claims[0].text, topic: r.claims[0].topic, jurisdiction: "IM", kind: "source_excerpt", sources: r.claims[0].sources, provenance: { origin: "public-reader", sourceEvidence: { fetchedAt: r.claims[0].fetchedAt, expiresAt: "2999-01-01T00:00:00.000Z" } } });
  assert.equal(claim.sources[0].archived.archiveUrl, CAPTURE);
  assert.equal(kb.upsertClaim({ text: "x".repeat(20), sources: [{ url: LIVE, archived: { snapshotAt: "nope", archiveUrl: "https://evil.example/" } }] }).claim.sources[0].archived, undefined, "a malformed archive note is dropped");
  const prompt = renderFocus({ coverage: "strong", claims: [{ ...claim, evidenceKind: "source_excerpt", fetchedAt: r.claims[0].fetchedAt, publishedAt: null }] });
  assert.match(prompt, /Internet Archive snapshot dated 2026-08-06, the live page was site_blocked/);
  kb.close();
});

test("official Manx hosts are read slowly, a site that asked us to wait is not sent to the archive, and the capture index is a readable URL", async () => {
  const { readablePage, originPacingMs, archiveIndexUrl } = await import("../lib/public-reader.mjs");
  assert.equal(originPacingMs("https://www.gov.im/x"), 5000); assert.equal(originPacingMs("https://legislation.gov.im/x"), 5000);
  assert.equal(originPacingMs("https://web.archive.org/web/2id_/https://www.gov.im/"), 1000); assert.equal(originPacingMs("https://example.org/"), 500);
  const waits = []; let t = 0;
  const read = createPublicReader({ get: async () => page("The High Court of Justice sits in Douglas."), wait: async (ms) => { waits.push(ms); }, now: () => t });
  await read("https://www.gov.im/a"); await read("https://www.gov.im/b"); await read("https://example.org/a"); await read("https://example.org/b");
  assert.deepEqual(waits, [0, 5000, 0, 500], "the second request to gov.im waits five seconds; an ordinary site half a second");
  let calls = 0;
  const waiting = createPublicReader({ get: async () => { calls++; return { status: 502, headers: { "retry-after": "120" }, body: Buffer.from("Unavailable") }; }, wait: noWait, now: () => Date.parse("2026-09-12T12:00:00Z") });
  await assert.rejects(waiting(LIVE), (e) => e.code === "http_error" && e.retryAt === "2026-09-12T12:02:00.000Z" && !e.archive);
  assert.equal(calls, 1, "a retry deadline is honoured, not routed around");
  assert.equal(readablePage(archiveIndexUrl(LIVE)), archiveIndexUrl(LIVE));
  assert.match(archiveIndexUrl(LIVE), /filter=statuscode%3A200|filter=statuscode:200/); assert.ok(decodeURIComponent(archiveIndexUrl(LIVE)).includes("filter=length:[0-9]{4,}"), "firewall-sized captures are excluded in the index query itself");
});

test("when the latest capture is the firewall page, the reader steps back through the index to an older real capture", async () => {
  const OLD = "https://web.archive.org/web/20260615080000id_/" + LIVE;
  const index = (rows) => ({ status: 200, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify([["timestamp"], ...rows.map((r) => [r])])) });
  const get = async (url) => {
    if (url === LIVE) return forbidden();
    if (url === archiveLookupUrl(LIVE)) return { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") };
    if (url === CAPTURE) return rejected();
    if (url.startsWith("https://web.archive.org/cdx/search/cdx?")) return index(["20260101000000", "20260615080000", "20260806140105"]);
    if (url === OLD) return page("The High Court of Justice sits in Douglas.");
    throw new Error("unexpected " + url);
  };
  const r = await createPublicReader({ get, wait: noWait })(LIVE);
  assert.equal(r.archived.snapshotAt, "2026-06-15T08:00:00.000Z"); assert.equal(r.archived.archiveUrl, OLD); assert.equal(r.url, LIVE);
  const offline = async (url) => url === LIVE ? forbidden() : url === archiveLookupUrl(LIVE) ? { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") } : url === CAPTURE ? rejected() : { status: 200, headers: { "content-type": "text/html" }, body: Buffer.from("<html><title>Internet Archive: Temporarily Offline</title></html>") };
  await assert.rejects(createPublicReader({ get: offline, wait: noWait })(LIVE), (e) => e.code === "site_blocked" && e.archive === "archive_unavailable");
  const allRejected = async (url) => url === LIVE ? forbidden() : url === archiveLookupUrl(LIVE) ? { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") } : url.startsWith("https://web.archive.org/cdx/") ? index(["20260806140105"]) : rejected();
  await assert.rejects(createPublicReader({ get: allRejected, wait: noWait })(LIVE), (e) => e.code === "site_blocked" && e.archive === "no_real_capture");
});

test("a verification pass gives each publisher a bounded share", async () => {
  const { verifyClaimSources } = await import("../lib/source-verification.mjs");
  const kb = new KnowledgeBase(":memory:");
  const text = "The High Court of Justice sits in Douglas.";
  for (const n of [1, 2, 3]) kb.upsertClaim({ text: text + " Note " + n + ".", topic: "courts", jurisdiction: "IM", sources: [{ url: "https://www.gov.im/courts/" + n }] });
  kb.upsertClaim({ text: text + " Tynwald note.", topic: "courts", jurisdiction: "IM", sources: [{ url: "https://tynwald.org.im/courts" }] });
  const seen = [];
  const summary = await verifyClaimSources(kb, { limit: 10, staleMs: 0, maxPerHost: 2, read: async (url) => { seen.push(new URL(url).hostname); return page(text); } });
  assert.equal(summary.checked, 3);
  assert.equal(seen.filter((h) => h === "www.gov.im").length, 2);
  kb.close();
});

// Findings from the 15 September 2026 MOMM review of this reader (codex, grok),
// each reproduced before it was fixed.
test("review: an allowed page keeps its publisher query inside the archive wrapper, and a capture of another page is not accepted", async () => {
  const { readablePage, archiveCaptureUrl, sameResource } = await import("../lib/public-reader.mjs");
  const news = "https://www.gov.im/news/?altTemplate=ViewCategorisedNews";
  assert.equal(readablePage(news), news);
  assert.equal(readablePage(archiveLookupUrl(news)), archiveLookupUrl(news), "the archive wrapper inherits the original's allowlist");
  assert.equal(readablePage(archiveCaptureUrl("20260806140105", news)), archiveCaptureUrl("20260806140105", news));
  assert.equal(readablePage("https://web.archive.org/web/2id_/https://www.gov.im/?token=private"), null, "the wrapper cannot launder a private link");
  assert.ok(sameResource("http://www.courts.im/x/", "https://www.courts.im/x")); assert.ok(!sameResource(LIVE, "https://www.courts.im/other/"));
  const OTHER = "https://web.archive.org/web/20260806140105id_/https://www.courts.im/other/";
  const OLD = "https://web.archive.org/web/20260615080000id_/" + LIVE;
  const get = async (url) => {
    if (url === LIVE) return forbidden();
    if (url === archiveLookupUrl(LIVE)) return { status: 302, headers: { location: OTHER }, body: Buffer.from("") };
    if (url === OTHER) return page("Unrelated homepage content about court opening hours in Douglas.");
    if (url.startsWith("https://web.archive.org/cdx/")) return { status: 200, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify([["timestamp"], ["20260615080000"]])) };
    if (url === OLD) return page("The High Court of Justice sits in Douglas.");
    throw new Error("unexpected " + url);
  };
  const r = await createPublicReader({ get, wait: noWait })(LIVE);
  assert.equal(r.archived.archiveUrl, OLD, "a capture of a different page is refused and the index consulted instead");
  const onlyOther = async (url) => url === LIVE ? forbidden() : url === archiveLookupUrl(LIVE) ? { status: 302, headers: { location: OTHER }, body: Buffer.from("") } : url === OTHER ? page("x") : { status: 404, headers: {}, body: Buffer.from("") };
  await assert.rejects(createPublicReader({ get: onlyOther, wait: noWait })(LIVE), (e) => e.code === "site_blocked" && e.archive === "http_error");
});

test("review: only a server-supplied wait keeps a page from the archive; the reader's own pacing does not, and a refusal body cannot hide a wait", async () => {
  const calls = [];
  const bare = async (url) => { calls.push(url); if (url === LIVE) return { status: 502, headers: {}, body: Buffer.from("bad gateway") }; if (url === archiveLookupUrl(LIVE)) return { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") }; return page("The High Court of Justice sits in Douglas."); };
  const r = await createPublicReader({ get: bare, wait: noWait })(LIVE);
  assert.equal(r.archived.liveOutcome, "http_error", "an exhausted 502 without Retry-After is archived");
  assert.ok(calls.includes(archiveLookupUrl(LIVE)));
  const told = async (url) => { calls.push(url); return { status: 503, headers: { "retry-after": "120" }, body: Buffer.from("Unavailable") }; };
  calls.length = 0;
  await assert.rejects(createPublicReader({ get: told, wait: noWait, now: () => Date.parse("2026-09-12T12:00:00Z") })(LIVE), (e) => e.code === "http_error" && e.retryAt === "2026-09-12T12:02:00.000Z" && !e.archive);
  assert.ok(!calls.some((u) => u.includes("web.archive.org")), "a server-requested wait is honoured");
  calls.length = 0;
  const refusingWait = async (url) => { calls.push(url); return { status: 429, headers: { "retry-after": "120" }, body: Buffer.from("<html><head><title>Request Rejected</title></head><body>The requested URL was rejected. Please consult with your administrator.</body></html>") }; };
  await assert.rejects(createPublicReader({ get: refusingWait, wait: noWait, browserFallback: false, now: () => Date.parse("2026-09-12T12:00:00Z") })(LIVE), (e) => e.code === "rate_limited" && e.retryAt === "2026-09-12T12:02:00.000Z");
  assert.deepEqual(calls, [LIVE], "a 429 that carries a refusal page is still a wait, not an archive trigger");
});

test("review: a capture is disclosed however it was reached, a missing latest capture still consults the index, and two citations resolving to one page are one confirmed route", async () => {
  const redirecting = async (url) => url === LIVE ? { status: 302, headers: { location: CAPTURE }, body: Buffer.from("") } : page("The High Court of Justice sits in Douglas.");
  const r = await createPublicReader({ get: redirecting, wait: noWait })(LIVE);
  assert.equal(r.url, LIVE); assert.equal(r.archived.snapshotAt, "2026-08-06T14:01:05.000Z"); assert.equal(r.archived.liveOutcome, "redirected");
  const direct = await createPublicReader({ get: async () => page("The High Court of Justice sits in Douglas."), wait: noWait })(CAPTURE);
  assert.equal(direct.archived.archiveUrl, CAPTURE, "a capture asked for directly is still labelled a capture");
  const OLD = "https://web.archive.org/web/20260615080000id_/" + LIVE;
  const missingLatest = async (url) => url === LIVE ? forbidden() : url === archiveLookupUrl(LIVE) ? { status: 404, headers: {}, body: Buffer.from("") } : url.startsWith("https://web.archive.org/cdx/") ? { status: 200, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify([["timestamp"], ["20260615080000"]])) } : url === OLD ? page("The High Court of Justice sits in Douglas.") : { status: 404, headers: {}, body: Buffer.from("") };
  assert.equal((await createPublicReader({ get: missingLatest, wait: noWait })(LIVE)).archived.archiveUrl, OLD);
  const { confirmedRoutes, deriveStatus } = await import("../lib/kb.mjs");
  const text = "The High Court of Justice sits in Douglas.";
  const read = async () => ({ url: "https://www.courts.im/canonical", status: 200, headers: { "content-type": "text/plain" }, body: text });
  const sources = await Promise.all(["https://www.gov.im/old", "https://news.example.org/old"].map(async (url) => ({ url, verification: await verifySource({ text, url, read }) })));
  assert.equal(confirmedRoutes(sources).size, 1, "one destination publisher is one confirmed route");
  assert.notEqual(deriveStatus({ sources, support: 2 }), "verified");
});

test("review: a host that refuses three reads in a row is left alone for the rest of the pass", async () => {
  const { verifyClaimSources } = await import("../lib/source-verification.mjs");
  const kb = new KnowledgeBase(":memory:");
  const text = "The High Court of Justice sits in Douglas.";
  for (const n of [1, 2, 3, 4, 5]) kb.upsertClaim({ text: text + " Note " + n + ".", topic: "courts", jurisdiction: "IM", sources: [{ url: "https://www.gov.im/courts/" + n }] });
  kb.upsertClaim({ text: text + " Tynwald note.", topic: "courts", jurisdiction: "IM", sources: [{ url: "https://tynwald.org.im/courts" }] });
  let govHits = 0;
  const read = async (url) => { if (url.includes("gov.im")) { govHits++; throw Object.assign(new Error("refused"), { code: "site_blocked" }); } return page(text); };
  const summary = await verifyClaimSources(kb, { limit: 10, staleMs: 0, read });
  assert.equal(govHits, 3); assert.equal(summary.skipped, 2); assert.deepEqual(summary.refusingHosts, ["gov.im"]);
  assert.equal(summary.byStatus.confirmed, 1, "other hosts are still read");
  assert.equal(kb.sourcesToVerify({ limit: 10, staleMs: 0, statuses: ["unchecked"] }).length, 2, "skipped citations stay unchecked for the next pass");
  kb.close();
});
